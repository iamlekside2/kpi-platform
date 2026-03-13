const prisma = require('../../config/db');
const { encrypt, decrypt } = require('./crypto');
const adoAdapter = require('./adapters/ado.adapter');
const jiraAdapter = require('./adapters/jira.adapter');
const asanaAdapter = require('./adapters/asana.adapter');

const adapters = {
  ado: adoAdapter,
  jira: jiraAdapter,
  asana: asanaAdapter,
};

async function createIntegration({ orgId, tool, accessToken, orgUrl, email, fieldMap, userId }) {
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!membership || membership.role !== 'admin') {
    throw new Error('Only admins can manage integrations');
  }

  return prisma.integration.create({
    data: {
      tool,
      accessToken: encrypt(accessToken),
      orgUrl: orgUrl || '',
      email: email || '',
      fieldMap: fieldMap || {},
      orgId,
    },
  });
}

async function getOrgIntegrations(orgId, userId) {
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');

  const integrations = await prisma.integration.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });

  // Don't expose the encrypted token
  return integrations.map((i) => ({
    ...i,
    accessToken: '••••••••',
  }));
}

async function deleteIntegration({ integrationId, userId }) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw new Error('Integration not found');

  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: integration.orgId } },
  });
  if (!membership || membership.role !== 'admin') {
    throw new Error('Only admins can delete integrations');
  }

  return prisma.integration.delete({ where: { id: integrationId } });
}

async function testConnection({ tool, accessToken, orgUrl, email }) {
  const adapter = adapters[tool];
  if (!adapter) throw new Error(`Unsupported tool: ${tool}`);

  if (tool === 'ado') {
    return adapter.testConnection({ orgUrl, accessToken });
  } else if (tool === 'jira') {
    return adapter.testConnection({ domain: orgUrl, email, accessToken });
  } else if (tool === 'asana') {
    return adapter.testConnection({ accessToken });
  }
}

async function syncIntegration({ integrationId, userId }) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw new Error('Integration not found');

  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: integration.orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');

  const adapter = adapters[integration.tool];
  if (!adapter) throw new Error(`Unsupported tool: ${integration.tool}`);

  const decryptedToken = decrypt(integration.accessToken);
  let kpiData;

  try {
    if (integration.tool === 'ado') {
      const project = integration.fieldMap?.project || '';
      kpiData = await adapter.fetchData({
        orgUrl: integration.orgUrl,
        accessToken: decryptedToken,
        project,
      });
    } else if (integration.tool === 'jira') {
      kpiData = await adapter.fetchData({
        domain: integration.orgUrl,
        email: integration.email,
        accessToken: decryptedToken,
      });
    } else if (integration.tool === 'asana') {
      const projectId = integration.fieldMap?.projectId || '';
      kpiData = await adapter.fetchData({
        accessToken: decryptedToken,
        projectId,
      });
    }
  } catch (err) {
    // Log failure
    await prisma.syncLog.create({
      data: {
        status: 'failure',
        errorMessage: err.message,
        integrationId,
        orgId: integration.orgId,
      },
    });
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'error' },
    });
    throw err;
  }

  // Apply fetched data to KPIs using fieldMap
  const fieldMap = integration.fieldMap || {};
  let rowsUpdated = 0;

  for (const item of kpiData) {
    // Check if there's a mapping for this KPI name, or try to match by name
    const kpiId = fieldMap[item.kpiName];
    if (kpiId) {
      await prisma.kPI.update({
        where: { id: kpiId },
        data: { value: item.value },
      });
      rowsUpdated++;
    } else {
      // Try to match by name
      const kpi = await prisma.kPI.findFirst({
        where: { orgId: integration.orgId, name: item.kpiName },
      });
      if (kpi) {
        await prisma.kPI.update({
          where: { id: kpi.id },
          data: { value: item.value },
        });
        rowsUpdated++;
      }
    }
  }

  // Log success
  await prisma.syncLog.create({
    data: {
      status: 'success',
      rowsUpdated,
      integrationId,
      orgId: integration.orgId,
    },
  });

  await prisma.integration.update({
    where: { id: integrationId },
    data: { status: 'connected', lastSyncedAt: new Date() },
  });

  return { rowsUpdated, data: kpiData };
}

module.exports = {
  createIntegration,
  getOrgIntegrations,
  deleteIntegration,
  testConnection,
  syncIntegration,
};
