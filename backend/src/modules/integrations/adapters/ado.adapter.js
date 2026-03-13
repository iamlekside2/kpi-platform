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

module.exports = { fetchData, testConnection };
