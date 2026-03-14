const https = require('https');

/**
 * Azure DevOps Adapter
 * Fetches work items by state and normalises into KPI shape.
 */
async function fetchData({ orgUrl, accessToken, project }) {
  // orgUrl: e.g. "https://dev.azure.com/myorg"
  // accessToken: PAT
  const wiqlQuery = {
    query: `SELECT [System.Id], [System.State], [System.WorkItemType] FROM workitems WHERE [System.TeamProject] = '${project}' AND [System.ChangedDate] >= @today - 30`,
  };

  const url = `${orgUrl}/${project}/_apis/wit/wiql?api-version=7.0`;
  const auth = Buffer.from(`:${accessToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(wiqlQuery),
  });

  if (!response.ok) {
    throw new Error(`ADO API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const workItemIds = (data.workItems || []).map((wi) => wi.id).slice(0, 200);

  if (workItemIds.length === 0) {
    return normalise({ done: 0, inProgress: 0, blocked: 0 });
  }

  // Fetch work item details in batches
  const idsParam = workItemIds.join(',');
  const detailUrl = `${orgUrl}/_apis/wit/workitems?ids=${idsParam}&fields=System.State&api-version=7.0`;

  const detailRes = await fetch(detailUrl, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!detailRes.ok) {
    throw new Error(`ADO detail API error: ${detailRes.status}`);
  }

  const detailData = await detailRes.json();
  const items = detailData.value || [];

  let done = 0, inProgress = 0, blocked = 0;
  for (const item of items) {
    const state = (item.fields?.['System.State'] || '').toLowerCase();
    if (state === 'done' || state === 'closed' || state === 'resolved') done++;
    else if (state === 'active' || state === 'in progress') inProgress++;
    else if (state === 'blocked') blocked++;
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

async function testConnection({ orgUrl, accessToken }) {
  const auth = Buffer.from(`:${accessToken}`).toString('base64');
  const url = `${orgUrl}/_apis/projects?api-version=7.0`;

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error(`Connection failed: ${response.status}`);
  }

  const data = await response.json();
  return { success: true, projects: (data.value || []).map((p) => p.name) };
}

/**
 * Fetch work items grouped by assigned member for a date range.
 * Returns: { [email]: { displayName, email, items: [...] } }
 */
async function fetchMemberWorkItems({ orgUrl, accessToken, project, fromDate, toDate }) {
  const auth = Buffer.from(`:${accessToken}`).toString('base64');

  const wiqlQuery = {
    query: `SELECT [System.Id] FROM workitems WHERE [System.TeamProject] = '${project}' AND [System.ChangedDate] >= '${fromDate}' AND [System.ChangedDate] <= '${toDate}' AND [System.AssignedTo] <> '' ORDER BY [System.AssignedTo] ASC`,
  };

  const url = `${orgUrl}/${project}/_apis/wit/wiql?api-version=7.0`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(wiqlQuery),
  });

  if (!response.ok) {
    throw new Error(`ADO WIQL error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const workItemIds = (data.workItems || []).map((wi) => wi.id).slice(0, 500);

  if (workItemIds.length === 0) return {};

  // Fetch details in batches of 200 (ADO API limit)
  const fields = [
    'System.Title',
    'System.State',
    'System.WorkItemType',
    'System.AssignedTo',
    'System.ChangedDate',
    'System.CreatedDate',
    'Microsoft.VSTS.Scheduling.StoryPoints',
    'Microsoft.VSTS.Scheduling.Effort',
  ].join(',');

  const allItems = [];
  for (let i = 0; i < workItemIds.length; i += 200) {
    const batch = workItemIds.slice(i, i + 200);
    const idsParam = batch.join(',');
    const detailUrl = `${orgUrl}/_apis/wit/workitems?ids=${idsParam}&fields=${fields}&api-version=7.0`;

    const detailRes = await fetch(detailUrl, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!detailRes.ok) {
      throw new Error(`ADO detail error: ${detailRes.status}`);
    }

    const detailData = await detailRes.json();
    allItems.push(...(detailData.value || []));
  }

  // Group by assigned-to email
  const memberMap = {};
  for (const item of allItems) {
    const assignedTo = item.fields?.['System.AssignedTo'] || {};
    // ADO returns assignedTo as { displayName, uniqueName, ... }
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
