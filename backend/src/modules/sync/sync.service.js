const prisma = require('../../config/db');
const { syncIntegration } = require('../integrations/integrations.service');

/**
 * Runs sync for all active integrations for a given org.
 * Called by the scheduler.
 */
async function syncOrg(orgId) {
  const integrations = await prisma.integration.findMany({
    where: { orgId, status: { not: 'disabled' } },
  });

  const results = [];
  for (const integration of integrations) {
    try {
      // We pass a fake userId since this is a system action.
      // The syncIntegration function checks membership — we need to bypass that for cron.
      const result = await syncIntegrationDirect(integration);
      results.push({ integrationId: integration.id, tool: integration.tool, ...result });
    } catch (err) {
      results.push({ integrationId: integration.id, tool: integration.tool, error: err.message });
    }
  }

  return results;
}

/**
 * Direct sync that bypasses user auth check (for cron jobs).
 */
async function syncIntegrationDirect(integration) {
  const { decrypt } = require('../integrations/crypto');
  const adapters = {
    ado: require('../integrations/adapters/ado.adapter'),
    jira: require('../integrations/adapters/jira.adapter'),
    asana: require('../integrations/adapters/asana.adapter'),
  };

  const adapter = adapters[integration.tool];
  if (!adapter) throw new Error(`Unsupported tool: ${integration.tool}`);

  const decryptedToken = decrypt(integration.accessToken);
  let kpiData;

  try {
    if (integration.tool === 'ado') {
      kpiData = await adapter.fetchData({
        orgUrl: integration.orgUrl,
        accessToken: decryptedToken,
        project: integration.fieldMap?.project || '',
      });
    } else if (integration.tool === 'jira') {
      kpiData = await adapter.fetchData({
        domain: integration.orgUrl,
        email: integration.email,
        accessToken: decryptedToken,
      });
    } else if (integration.tool === 'asana') {
      kpiData = await adapter.fetchData({
        accessToken: decryptedToken,
        projectId: integration.fieldMap?.projectId || '',
      });
    }
  } catch (err) {
    await prisma.syncLog.create({
      data: {
        status: 'failure',
        errorMessage: err.message,
        integrationId: integration.id,
        orgId: integration.orgId,
      },
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: 'error' },
    });
    throw err;
  }

  // Apply data
  let rowsUpdated = 0;
  const fieldMap = integration.fieldMap || {};

  for (const item of kpiData) {
    const kpiId = fieldMap[item.kpiName];
    if (kpiId) {
      await prisma.kPI.update({ where: { id: kpiId }, data: { value: item.value } });
      rowsUpdated++;
    } else {
      const kpi = await prisma.kPI.findFirst({
        where: { orgId: integration.orgId, name: item.kpiName },
      });
      if (kpi) {
        await prisma.kPI.update({ where: { id: kpi.id }, data: { value: item.value } });
        rowsUpdated++;
      }
    }
  }

  await prisma.syncLog.create({
    data: {
      status: 'success',
      rowsUpdated,
      integrationId: integration.id,
      orgId: integration.orgId,
    },
  });

  await prisma.integration.update({
    where: { id: integration.id },
    data: { status: 'connected', lastSyncedAt: new Date() },
  });

  return { rowsUpdated };
}

module.exports = { syncOrg, syncIntegrationDirect };
