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

  // Validate credentials against the real API before saving
  const adapter = adapters[tool];
  if (!adapter) throw new Error(`Unsupported tool: ${tool}`);

  try {
    await testConnection({ tool, accessToken, orgUrl, email });
  } catch (err) {
    throw new Error(`Connection test failed: ${err.message}`);
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

async function syncMemberWorkItems({ integrationId, userId, periodFrom, periodTo }) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw new Error('Integration not found');
  if (integration.tool !== 'ado') throw new Error('Staff task sync is only supported for Azure DevOps');

  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: integration.orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');

  const decryptedToken = decrypt(integration.accessToken);
  const project = integration.fieldMap?.project || '';

  // Fetch per-member work items from ADO
  const memberMap = await adoAdapter.fetchMemberWorkItems({
    orgUrl: integration.orgUrl,
    accessToken: decryptedToken,
    project,
    fromDate: periodFrom,
    toDate: periodTo,
  });

  // Get all org members with their emails
  const orgMembers = await prisma.orgMember.findMany({
    where: { orgId: integration.orgId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  // Build email → userId lookup
  const emailToUser = {};
  for (const m of orgMembers) {
    emailToUser[m.user.email.toLowerCase()] = m.user.id;
  }

  let matched = 0;
  let unmatched = 0;
  const unmatchedEmails = [];

  for (const [adoEmail, data] of Object.entries(memberMap)) {
    const platformUserId = emailToUser[adoEmail.toLowerCase()];
    if (!platformUserId) {
      unmatched++;
      unmatchedEmails.push(adoEmail);
      continue;
    }

    const items = data.items || [];
    const completedItems = items.filter((i) => {
      const s = i.state.toLowerCase();
      return s === 'done' || s === 'closed' || s === 'resolved';
    }).length;
    const activeItems = items.filter((i) => {
      const s = i.state.toLowerCase();
      return s === 'active' || s === 'in progress';
    }).length;
    const totalStoryPoints = items.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

    await prisma.memberWorkItems.upsert({
      where: {
        userId_orgId_integrationId_periodFrom_periodTo: {
          userId: platformUserId,
          orgId: integration.orgId,
          integrationId: integration.id,
          periodFrom: new Date(periodFrom),
          periodTo: new Date(periodTo),
        },
      },
      create: {
        userId: platformUserId,
        orgId: integration.orgId,
        externalEmail: adoEmail,
        items,
        totalItems: items.length,
        completedItems,
        activeItems,
        totalStoryPoints: totalStoryPoints || null,
        periodFrom: new Date(periodFrom),
        periodTo: new Date(periodTo),
        integrationId: integration.id,
      },
      update: {
        externalEmail: adoEmail,
        items,
        totalItems: items.length,
        completedItems,
        activeItems,
        totalStoryPoints: totalStoryPoints || null,
        syncedAt: new Date(),
      },
    });

    matched++;
  }

  return { matched, unmatched, unmatchedEmails, totalAdoUsers: Object.keys(memberMap).length };
}

async function getMemberWorkItems({ orgId, targetUserId, userId, periodFrom, periodTo }) {
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');

  // Members can only view their own, leads/admins can view anyone
  if (membership.role === 'member' && targetUserId !== userId) {
    throw new Error('You can only view your own work items');
  }

  const where = { userId: targetUserId, orgId };
  if (periodFrom && periodTo) {
    where.periodFrom = { gte: new Date(periodFrom) };
    where.periodTo = { lte: new Date(periodTo) };
  }

  const records = await prisma.memberWorkItems.findMany({
    where,
    orderBy: { syncedAt: 'desc' },
    take: 1,
  });

  return records[0] || null;
}

module.exports = {
  createIntegration,
  getOrgIntegrations,
  deleteIntegration,
  testConnection,
  syncIntegration,
  syncMemberWorkItems,
  getMemberWorkItems,
};
