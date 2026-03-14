const service = require('./auditLogs.service');
const prisma = require('../../config/db');

// Helper: check org membership + role
async function getUserRole(userId, orgId) {
  const member = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  return member?.role || null;
}

// GET /audit-logs/org/:orgId
async function getOrgLogs(req, res) {
  try {
    const role = await getUserRole(req.user.userId, req.params.orgId);
    if (!role || role === 'member') {
      return res.status(403).json({ error: 'Only admins and leads can view audit logs' });
    }

    const { limit = 50, offset = 0, entityType, action } = req.query;
    const result = await service.getOrgAuditLogs(req.params.orgId, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      entityType,
      action,
    });
    res.json(result);
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
}

// GET /audit-logs/org/:orgId/entity/:entityType/:entityId
async function getEntityLogs(req, res) {
  try {
    const role = await getUserRole(req.user.userId, req.params.orgId);
    if (!role || role === 'member') {
      return res.status(403).json({ error: 'Only admins and leads can view audit logs' });
    }

    const logs = await service.getEntityAuditLogs(
      req.params.orgId,
      req.params.entityType,
      req.params.entityId
    );
    res.json(logs);
  } catch (err) {
    console.error('Get entity audit logs error:', err);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
}

module.exports = { getOrgLogs, getEntityLogs };
