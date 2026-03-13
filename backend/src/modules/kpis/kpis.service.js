const prisma = require('../../config/db');

async function getOrgKpis(orgId, userId) {
  // Verify membership
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');

  return prisma.kPI.findMany({
    where: { orgId },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

async function updateKpi({ kpiId, value, target, userId }) {
  const kpi = await prisma.kPI.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new Error('KPI not found');

  // Verify membership
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: kpi.orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');

  const data = {};
  if (value !== undefined) data.value = parseFloat(value);
  if (target !== undefined) data.target = parseFloat(target);

  return prisma.kPI.update({ where: { id: kpiId }, data });
}

async function createKpi({ orgId, name, unit, target, category, description, userId }) {
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');
  if (membership.role === 'member') throw new Error('Members cannot create KPIs');

  return prisma.kPI.create({
    data: {
      name,
      unit,
      target: target ? parseFloat(target) : null,
      category: category || 'General',
      description: description || '',
      orgId,
    },
  });
}

async function deleteKpi({ kpiId, userId }) {
  const kpi = await prisma.kPI.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new Error('KPI not found');

  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: kpi.orgId } },
  });
  if (!membership || membership.role === 'member') {
    throw new Error('Only admins and leads can delete KPIs');
  }

  return prisma.kPI.delete({ where: { id: kpiId } });
}

async function bulkUpdateKpis({ updates, userId }) {
  // updates: [{ id, value }]
  if (!updates || updates.length === 0) return [];

  const results = [];
  for (const update of updates) {
    const kpi = await prisma.kPI.findUnique({ where: { id: update.id } });
    if (!kpi) continue;

    const membership = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId: kpi.orgId } },
    });
    if (!membership) continue;

    const updated = await prisma.kPI.update({
      where: { id: update.id },
      data: { value: parseFloat(update.value) },
    });
    results.push(updated);
  }
  return results;
}

module.exports = { getOrgKpis, updateKpi, createKpi, deleteKpi, bulkUpdateKpis };
