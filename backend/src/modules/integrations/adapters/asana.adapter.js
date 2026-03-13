/**
 * Asana Adapter
 * Fetches tasks by completion status and normalises into KPI shape.
 */
async function fetchData({ accessToken, projectId }) {
  const url = `https://app.asana.com/api/1.0/tasks?project=${projectId}&opt_fields=completed,name&limit=100`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Asana API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const tasks = data.data || [];

  let completed = 0, inProgress = 0;
  for (const task of tasks) {
    if (task.completed) completed++;
    else inProgress++;
  }

  return normalise({ completed, inProgress });
}

function normalise({ completed, inProgress }) {
  return [
    { kpiName: 'Tasks Completed', value: completed },
    { kpiName: 'In Progress Count', value: inProgress },
  ];
}

async function testConnection({ accessToken }) {
  const url = 'https://app.asana.com/api/1.0/users/me';

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Connection failed: ${response.status}`);
  }

  const data = await response.json();
  return { success: true, user: data.data?.name };
}

module.exports = { fetchData, testConnection };
