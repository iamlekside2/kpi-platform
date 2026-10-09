const https = require('https');

/**
 * Azure DevOps Adapter
 * Supports multiple projects per integration.
 * `projects` can be a string[] or comma-separated string.
 */

/**
 * Classify a work-item state, tolerant of custom process templates.
 * CalmGlobal boards use: New, In Sprint, In Progress,
 * Confirmed Awaiting QA/Release, Pending Issues, Done, Done Deployed.
 * Returns 'done' | 'blocked' | 'removed' | 'open'.
 */
function classifyState(rawState) {
  const state = (rawState || '').toLowerCase().trim();
  if (!state) return 'open';
  if (state === 'removed') return 'removed';
  if (/^(done|closed|resolved|completed)/.test(state)) return 'done';
  if (state.includes('blocked') || state.includes('pending') || state.includes('on hold')) return 'blocked';
  return 'open'; // new, active, in progress, in sprint, awaiting QA/release, ...
}

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
  let itemsCreated = 0, bugsCreated = 0, bugsFixed = 0, openBugs = 0;
  let storyPointsDone = 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const DETAIL_FIELDS = [
    'System.State',
    'System.WorkItemType',
    'System.CreatedDate',
    'Microsoft.VSTS.Scheduling.StoryPoints',
    'Microsoft.VSTS.Scheduling.Effort',
  ].join(',');

  for (const proj of projects) {
    const wiqlQuery = {
      query: `SELECT [System.Id] FROM workitems WHERE [System.TeamProject] = '${proj}' AND [System.ChangedDate] >= @today - 30`,
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

    if (workItemIds.length > 0) {
      const idsParam = workItemIds.join(',');
      const detailUrl = `${orgUrl}/_apis/wit/workitems?ids=${idsParam}&fields=${DETAIL_FIELDS}&api-version=7.0`;

      const detailRes = await fetch(detailUrl, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!detailRes.ok) continue;

      const detailData = await detailRes.json();
      for (const item of (detailData.value || [])) {
        const f = item.fields || {};
        const cls = classifyState(f['System.State']);
        if (cls === 'removed') continue;

        const type = (f['System.WorkItemType'] || '').toLowerCase();
        const isDone = cls === 'done';
        const createdRecently = f['System.CreatedDate'] && new Date(f['System.CreatedDate']) >= thirtyDaysAgo;

        if (isDone) done++;
        else if (cls === 'blocked') blocked++;
        else inProgress++;

        if (createdRecently) itemsCreated++;

        if (type === 'bug') {
          if (createdRecently) bugsCreated++;
          if (isDone) bugsFixed++;
        }

        if (isDone) {
          const points = f['Microsoft.VSTS.Scheduling.StoryPoints'] || f['Microsoft.VSTS.Scheduling.Effort'] || 0;
          storyPointsDone += Number(points) || 0;
        }
      }
    }

    // Open bugs is a point-in-time count — query it regardless of change date
    const openBugsQuery = {
      query: `SELECT [System.Id] FROM workitems WHERE [System.TeamProject] = '${proj}' AND [System.WorkItemType] = 'Bug' AND [System.State] NOT IN ('Done', 'Done Deployed', 'Closed', 'Resolved', 'Completed', 'Removed')`,
    };
    const bugRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(openBugsQuery),
    });
    if (bugRes.ok) {
      const bugData = await bugRes.json();
      openBugs += (bugData.workItems || []).length;
    }
  }

  return normalise({ done, inProgress, blocked, itemsCreated, bugsCreated, bugsFixed, openBugs, storyPointsDone });
}

// All counts cover the last 30 days, except Open Bugs (current snapshot).
function normalise({ done, inProgress, blocked, itemsCreated, bugsCreated, bugsFixed, openBugs, storyPointsDone }) {
  return [
    { kpiName: 'Tasks Completed', value: done, unit: 'items' },
    { kpiName: 'Open Items', value: inProgress, unit: 'items' },
    { kpiName: 'Blocked Count', value: blocked, unit: 'items' },
    { kpiName: 'Items Created', value: itemsCreated, unit: 'items' },
    { kpiName: 'Bugs Created', value: bugsCreated, unit: 'bugs' },
    { kpiName: 'Bugs Fixed', value: bugsFixed, unit: 'bugs' },
    { kpiName: 'Open Bugs', value: openBugs, unit: 'bugs' },
    { kpiName: 'Story Points Completed', value: storyPointsDone, unit: 'points' },
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

module.exports = { fetchData, fetchMemberWorkItems, testConnection, classifyState };
