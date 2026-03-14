const prisma = require('../../config/db');

async function createAuditLog({ userId, orgId, action, entityType, entityId, description, oldValues, newValues }) {
  return prisma.auditLog.create({
    data: { userId, orgId, action, entityType, entityId, description, oldValues, newValues },
  });
}

async function getOrgAuditLogs(orgId, { limit = 50, offset = 0, entityType, action } = {}) {
  const where = { orgId };
  if (entityType) where.entityType = entityType;
  if (action) where.action = action;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

async function getEntityAuditLogs(orgId, entityType, entityId) {
  return prisma.auditLog.findMany({
    where: { orgId, entityType, entityId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

module.exports = { createAuditLog, getOrgAuditLogs, getEntityAuditLogs };
