const integrationsService = require('./integrations.service');

async function createIntegration(req, res) {
  try {
    const { tool, accessToken, orgUrl, email, fieldMap } = req.body;
    if (!tool || !accessToken) {
      return res.status(400).json({ error: 'tool and accessToken are required' });
    }

    const integration = await integrationsService.createIntegration({
      orgId: req.params.id,
      tool, accessToken, orgUrl, email, fieldMap,
      userId: req.user.userId,
    });

    return res.status(201).json({ ...integration, accessToken: '••••••••' });
  } catch (err) {
    if (err.message === 'Only admins can manage integrations') {
      return res.status(403).json({ error: err.message });
    }
    if (err.message.startsWith('Connection test failed')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Create integration error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getIntegrations(req, res) {
  try {
    const integrations = await integrationsService.getOrgIntegrations(req.params.id, req.user.userId);
    return res.json(integrations);
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }
}

async function deleteIntegration(req, res) {
  try {
    await integrationsService.deleteIntegration({
      integrationId: req.params.integrationId,
      userId: req.user.userId,
    });
    return res.json({ message: 'Integration deleted' });
  } catch (err) {
    if (err.message.includes('Only admins')) return res.status(403).json({ error: err.message });
    if (err.message === 'Integration not found') return res.status(404).json({ error: err.message });
    console.error('Delete integration error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function testConnection(req, res) {
  try {
    const { tool, accessToken, orgUrl, email, project } = req.body;
    const result = await integrationsService.testConnection({ tool, accessToken, orgUrl, email, project });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function syncIntegration(req, res) {
  try {
    const result = await integrationsService.syncIntegration({
      integrationId: req.params.integrationId,
      userId: req.user.userId,
    });
    return res.json(result);
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function getSyncLogs(req, res) {
  try {
    const prisma = require('../../config/db');
    const logs = await prisma.syncLog.findMany({
      where: { orgId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { integration: { select: { tool: true } } },
    });
    return res.json(logs);
  } catch (err) {
    console.error('Sync logs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function syncMemberWorkItems(req, res) {
  try {
    const { periodFrom, periodTo } = req.body;
    if (!periodFrom || !periodTo) {
      return res.status(400).json({ error: 'periodFrom and periodTo are required (YYYY-MM-DD)' });
    }
    const result = await integrationsService.syncMemberWorkItems({
      integrationId: req.params.integrationId,
      userId: req.user.userId,
      periodFrom,
      periodTo,
    });
    return res.json(result);
  } catch (err) {
    console.error('Member work items sync error:', err);
    return res.status(err.message.includes('not supported') ? 400 : 500).json({ error: err.message });
  }
}

async function getMemberWorkItems(req, res) {
  try {
    const result = await integrationsService.getMemberWorkItems({
      orgId: req.params.orgId,
      targetUserId: req.params.userId,
      userId: req.user.userId,
      periodFrom: req.query.periodFrom,
      periodTo: req.query.periodTo,
    });
    return res.json(result);
  } catch (err) {
    if (err.message === 'Not a member of this organisation') {
      return res.status(403).json({ error: err.message });
    }
    if (err.message.includes('only view your own')) {
      return res.status(403).json({ error: err.message });
    }
    console.error('Get member work items error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createIntegration, getIntegrations, deleteIntegration, testConnection, syncIntegration, getSyncLogs, syncMemberWorkItems, getMemberWorkItems };
