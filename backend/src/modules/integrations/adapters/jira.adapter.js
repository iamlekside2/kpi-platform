/**
 * Jira Adapter
 * Fetches issues by status and normalises into KPI shape.
 */
async function fetchData({ domain, email, accessToken }) {
  const auth = Buffer.from(`${email}:${accessToken}`).toString('base64');
  const url = `https://${domain}.atlassian.net/rest/api/3/search?jql=updated>=-30d&maxResults=100&fields=status,story_points,customfield_10016`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const issues = data.issues || [];

  let done = 0, inProgress = 0, bugs = 0, totalPoints = 0;
  for (const issue of issues) {
    const status = (issue.fields?.status?.statusCategory?.name || '').toLowerCase();
    const type = (issue.fields?.issuetype?.name || '').toLowerCase();
    const points = issue.fields?.customfield_10016 || issue.fields?.story_points || 0;

    if (status === 'done') { done++; totalPoints += points; }
    else if (status === 'in progress') inProgress++;
    if (type === 'bug') bugs++;
  }

  return normalise({ done, inProgress, bugs, velocity: totalPoints });
}

function normalise({ done, inProgress, bugs, velocity }) {
  return [
    { kpiName: 'Sprint Velocity', value: velocity },
    { kpiName: 'Open Bugs', value: bugs },
    { kpiName: 'Tasks Completed', value: done },
    { kpiName: 'Open Items', value: inProgress },
  ];
}

async function testConnection({ domain, email, accessToken }) {
  const auth = Buffer.from(`${email}:${accessToken}`).toString('base64');
  const url = `https://${domain}.atlassian.net/rest/api/3/myself`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Connection failed: ${response.status}`);
  }

  const data = await response.json();
  return { success: true, user: data.displayName };
}

module.exports = { fetchData, testConnection };
