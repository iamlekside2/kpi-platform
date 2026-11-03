const prisma = require('../../config/db');

// How many readings travel with a KPI. Enough for three years of monthly
// figures, which is more than any card or chart shows at once.
const READING_WINDOW = 36;

const READING_INCLUDE = {
  orderBy: { recordedFor: 'desc' },
  take: READING_WINDOW,
  include: { recordedBy: { select: { id: true, name: true } } },
};

async function requireMembership(userId, orgId) {
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');
  return membership;
}

// KPIs are the organisation's own numbers, so recording them is a job for
// whoever runs the organisation. Everyone else reads.
async function requireKpiManager(userId, orgId, action) {
  const membership = await requireMembership(userId, orgId);
  if (membership.role !== 'admin' && membership.role !== 'lead') {
    throw new Error(`Only admins and leads can ${action}`);
  }
  return membership;
}

// A reading describes a period, not an instant: everything is stored at
// midnight UTC so two people entering "September" agree on the same row.
function toPeriod(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) throw new Error('That is not a valid date');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// `KPI.value` mirrors the newest reading. It is recomputed rather than
// assumed, so back-dating an old figure does not overwrite a newer one.
async function syncLatestValue(kpiId) {
  const latest = await prisma.kpiReading.findFirst({
    where: { kpiId },
    orderBy: { recordedFor: 'desc' },
  });
  await prisma.kPI.update({
    where: { id: kpiId },
    data: { value: latest ? latest.value : null },
  });
  return latest;
}

async function getOrgKpis(orgId, userId) {
  await requireMembership(userId, orgId);

  return prisma.kPI.findMany({
    where: { orgId },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: { readings: READING_INCLUDE },
  });
}

async function getKpiReadings({ kpiId, userId }) {
  const kpi = await prisma.kPI.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new Error('KPI not found');
  await requireMembership(userId, kpi.orgId);

  return prisma.kpiReading.findMany({
    where: { kpiId },
    orderBy: { recordedFor: 'desc' },
    include: { recordedBy: { select: { id: true, name: true } } },
  });
}

async function recordKpiReading({ kpiId, value, recordedFor, note, userId }) {
  const kpi = await prisma.kPI.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new Error('KPI not found');
  await requireKpiManager(userId, kpi.orgId, 'record KPI values');

  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) throw new Error('Enter a number for the value');

  const period = toPeriod(recordedFor);

  const reading = await prisma.kpiReading.upsert({
    where: { kpiId_recordedFor: { kpiId, recordedFor: period } },
    create: {
      kpiId,
      value: parsed,
      recordedFor: period,
      note: note || '',
      recordedById: userId,
    },
    update: { value: parsed, note: note || '', recordedById: userId },
    include: { recordedBy: { select: { id: true, name: true } } },
  });

  await syncLatestValue(kpiId);

  return reading;
}

async function deleteKpiReading({ readingId, userId }) {
  const reading = await prisma.kpiReading.findUnique({
    where: { id: readingId },
    include: { kpi: { select: { id: true, orgId: true } } },
  });
  if (!reading) throw new Error('Reading not found');
  await requireKpiManager(userId, reading.kpi.orgId, 'remove KPI values');

  await prisma.kpiReading.delete({ where: { id: readingId } });
  await syncLatestValue(reading.kpi.id);

  return { id: readingId };
}

// Editing the number on a card is the same act as recording today's reading,
// so it goes through the same path and leaves the same trail.
async function updateKpi({ kpiId, value, target, userId }) {
  const kpi = await prisma.kPI.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new Error('KPI not found');
  await requireKpiManager(userId, kpi.orgId, 'change KPIs');

  if (value !== undefined && value !== null && value !== '') {
    await recordKpiReading({ kpiId, value, recordedFor: null, userId });
  }

  if (target !== undefined) {
    const parsedTarget = target === null || target === '' ? null : parseFloat(target);
    if (parsedTarget !== null && !Number.isFinite(parsedTarget)) {
      throw new Error('Enter a number for the target');
    }
    await prisma.kPI.update({ where: { id: kpiId }, data: { target: parsedTarget } });
  }

  return prisma.kPI.findUnique({
    where: { id: kpiId },
    include: { readings: READING_INCLUDE },
  });
}

async function createKpi({ orgId, name, unit, target, category, description, userId }) {
  await requireKpiManager(userId, orgId, 'create KPIs');

  const created = await prisma.kPI.create({
    data: {
      name,
      unit,
      target: target ? parseFloat(target) : null,
      category: category || 'General',
      description: description || '',
      orgId,
    },
  });

  return { ...created, readings: [] };
}

async function deleteKpi({ kpiId, userId }) {
  const kpi = await prisma.kPI.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new Error('KPI not found');
  await requireKpiManager(userId, kpi.orgId, 'delete KPIs');

  // Readings cascade with the KPI — see the relation in schema.prisma.
  return prisma.kPI.delete({ where: { id: kpiId } });
}

async function bulkUpdateKpis({ updates, userId }) {
  // updates: [{ id, value, recordedFor? }] — one month's figures at a time.
  if (!updates || updates.length === 0) return [];

  const results = [];
  for (const update of updates) {
    if (update.value === undefined || update.value === null || update.value === '') continue;
    // One bad row must not silently drop the rest, nor take them down with it.
    try {
      await recordKpiReading({
        kpiId: update.id,
        value: update.value,
        recordedFor: update.recordedFor || null,
        note: update.note,
        userId,
      });
      results.push(
        await prisma.kPI.findUnique({
          where: { id: update.id },
          include: { readings: READING_INCLUDE },
        })
      );
    } catch (err) {
      results.push({ id: update.id, error: err.message });
    }
  }
  return results;
}

module.exports = {
  getOrgKpis,
  getKpiReadings,
  recordKpiReading,
  deleteKpiReading,
  updateKpi,
  createKpi,
  deleteKpi,
  bulkUpdateKpis,
};
