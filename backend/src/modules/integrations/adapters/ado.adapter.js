const https = require('https');

/**
 * Azure DevOps Adapter
 * Supports multiple projects per integration.
 * `projects` can be a string[] or comma-separated string.
 */

function parseProjects(project) {
  // Accept: string[], comma-separated string, or single project string
  if (Array.isArray(project)) return project.filter(Boolean);
  if (typeof project === 'string' && project.trim()) {
    return project.split(',').map((p) => p.trim()).filter(Boolean);
  }
  return [];
}

async function fetchData({ orgUrl, accessToken, project }) {
  const auth = Buffer.from(`:${accessToken}`).toString('base64');
  const projects = parseProjects(project);

  if (projects.length === 0) {
    // If no projects specified, fetch all and use them
    const { projects: allProjects } = await testConnection({ orgUrl, accessToken });
    projects.push(...allProjects);
  }

  let done = 0, inProgress = 0, blocked = 0;

  for (const proj of projects) {
    const wiqlQuery = {
      query: `SELECT [System.Id], [System.State], [System.WorkItemType] FROM workitems WHERE [System.TeamProject] = '${proj}' AND [System.ChangedDate] >= @today - 30`,
    };

    const url = `${orgUrl}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.0`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(wiqlQuery),
    });

    if (!response.ok) continue; // Skip project on error

    const data = await response.json();
    const workItemIds = (data.workItems || []).map((wi) => wi.id).slice(0, 200);
    if (workItemIds.length === 0) continue;

    const idsParam = workItemIds.join(',');
    const detailUrl = `${orgUrl}/_apis/wit/workitems?ids=${idsParam}&fields=System.State&api-version=7.0`;

    const detailRes = await fetch(detailUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!detailRes.ok) continue;

    const detailData = await detailRes.json();
    for (const item of (detailData.value || [])) {
      const state = (item.fields?.['System.State'] || '').toLowerCase();
      if (state === 'done' || state === 'closed' || state === 'resolved') done++;
      else if (state === 'active' || state === 'in progress') inProgress++;
      else if (state === 'blocked') blocked++;
    }
  }

  return normalise({ done, inProgress, blocked });
}

function normalise({ done, inProgress, blocked }) {
  return [
    { kpiName: 'Tasks Completed', value: done },
    { kpiName: 'Open Items', value: inProgress },
    { kpiName: 'Blocked Count', value: blocked },
  ];
}

async function testConnection({ orgUrl, accessToken, project }) {
  const auth = Buffer.from(`:${accessToken}`).toString('base64');

  // 1. Validate org URL + credentials
  const url = `${orgUrl}/_apis/projects?api-version=7.0`;
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error(`Connection failed: ${response.status}. Check your Organisation URL and Access Token.`);
  }

  const data = await response.json();
  const projectNames = (data.value || []).map((p) => p.name);

  // 2. Validate specific project names if provided
  const requestedProjects = parseProjects(project);
  if (requestedProjects.length > 0) {
    for (const p of requestedProjects) {
      const match = projectNames.find((name) => name.toLowerCase() === p.toLowerCase());
      if (!match) {
        throw new Error(`Project "${p}" not found. Available projects: ${projectNames.join(', ')}`);
      }
    }
  }

  return { success: true, projects: projectNames };
}

/**
 * Fetch work items grouped by assigned member for a date range.
 * Queries across all specified projects (or all projects if none specified).
 * Returns: { [email]: { displayName, email, items: [...] } }
 */
async function fetchMemberWorkItems({ orgUrl, accessToken, project, fromDate, toDate }) {
  const auth = Buffer.from(`:${accessToken}`).toString('base64');
  let projects = parseProjects(project);

  if (projects.length === 0) {
    // No project specified — fetch all projects from the org
    const { projects: allProjects } = await testConnection({ orgUrl, accessToken });
    projects = allProjects;
  }

  const fields = [
    'System.Title',
    'System.State',
    'System.WorkItemType',
    'System.AssignedTo',
    'System.ChangedDate',
    'System.CreatedDate',
    'System.TeamProject',
    'Microsoft.VSTS.Scheduling.StoryPoints',
    'Microsoft.VSTS.Scheduling.Effort',
  ].join(',');

  const allItems = [];

  for (const proj of projects) {
    const wiqlQuery = {
      query: `SELECT [System.Id] FROM workitems WHERE [System.TeamProject] = '${proj}' AND [System.ChangedDate] >= '${fromDate}' AND [System.ChangedDate] <= '${toDate}' AND [System.AssignedTo] <> '' ORDER BY [System.AssignedTo] ASC`,
    };

    const wiqlUrl = `${orgUrl}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.0`;
    const response = await fetch(wiqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(wiqlQuery),
    });

    if (!response.ok) {
      console.error(`ADO WIQL error for project "${proj}": ${response.status} ${response.statusText}`);
      continue; // Skip this project, try the rest
    }

    const data = await response.json();
    const workItemIds = (data.workItems || []).map((wi) => wi.id).slice(0, 500);
    if (workItemIds.length === 0) continue;

    // Fetch details in batches of 200
    for (let i = 0; i < workItemIds.length; i += 200) {
      const batch = workItemIds.slice(i, i + 200);
      const idsParam = batch.join(',');
      const detailUrl = `${orgUrl}/_apis/wit/workitems?ids=${idsParam}&fields=${fields}&api-version=7.0`;

      const detailRes = await fetch(detailUrl, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!detailRes.ok) {
        console.error(`ADO detail error for project "${proj}": ${detailRes.status}`);
        continue;
      }

      const detailData = await detailRes.json();
      allItems.push(...(detailData.value || []));
    }
  }

  // Group by assigned-to email
  const memberMap = {};
  for (const item of allItems) {
    const assignedTo = item.fields?.['System.AssignedTo'] || {};
    const email = (assignedTo.uniqueName || assignedTo.displayName || '').toLowerCase();
    const displayName = assignedTo.displayName || email;

    if (!email) continue;

    if (!memberMap[email]) {
      memberMap[email] = { displayName, email, items: [] };
    }

    memberMap[email].items.push({
      id: item.id,
      title: item.fields?.['System.Title'] || '',
      state: item.fields?.['System.State'] || '',
      type: item.fields?.['System.WorkItemType'] || '',
      project: item.fields?.['System.TeamProject'] || '',
      storyPoints: item.fields?.['Microsoft.VSTS.Scheduling.StoryPoints']
        || item.fields?.['Microsoft.VSTS.Scheduling.Effort']
        || null,
      changedDate: item.fields?.['System.ChangedDate'] || '',
      createdDate: item.fields?.['System.CreatedDate'] || '',
    });
  }

  return memberMap;
}

module.exports = { fetchData, fetchMemberWorkItems, testConnection };
