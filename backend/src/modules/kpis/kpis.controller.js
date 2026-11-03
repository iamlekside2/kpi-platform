const kpisService = require('./kpis.service');
const prisma = require('../../config/db');
const {
  auditKpiCreated,
  auditKpiUpdated,
  auditKpiDeleted,
  auditKpiReadingRecorded,
  auditKpiReadingDeleted,
} = require('../auditLogs/audit');

// The service raises a handful of refusals by name; everything else is a
// fault. Mapping them in one place keeps each handler to its own job.
function sendKpiError(res, err, context) {
  if (err.message === 'KPI not found' || err.message === 'Reading not found') {
    return res.status(404).json({ error: err.message });
  }
  if (err.message === 'Not a member of this organisation' || err.message.startsWith('Only admins')) {
    return res.status(403).json({ error: err.message });
  }
  if (err.message.startsWith('Enter a number') || err.message === 'That is not a valid date') {
    return res.status(400).json({ error: err.message });
  }
  console.error(`${context} error:`, err);
  return res.status(500).json({ error: 'Internal server error' });
}

async function getOrgKpis(req, res) {
  try {
    const kpis = await kpisService.getOrgKpis(req.params.id, req.user.userId);
    return res.json(kpis);
  } catch (err) {
    return sendKpiError(res, err, 'Get KPIs');
  }
}

async function getReadings(req, res) {
  try {
    const readings = await kpisService.getKpiReadings({
      kpiId: req.params.id,
      userId: req.user.userId,
    });
    return res.json(readings);
  } catch (err) {
    return sendKpiError(res, err, 'Get KPI readings');
  }
}

async function recordReading(req, res) {
  try {
    const { value, recordedFor, note } = req.body;
    if (value === undefined || value === null || value === '') {
      return res.status(400).json({ error: 'Enter a number for the value', field: 'value' });
    }

    const reading = await kpisService.recordKpiReading({
      kpiId: req.params.id,
      value,
      recordedFor,
      note,
      userId: req.user.userId,
    });

    const kpi = await prisma.kPI.findUnique({
      where: { id: req.params.id },
      include: { readings: { orderBy: { recordedFor: 'desc' }, take: 36, include: { recordedBy: { select: { id: true, name: true } } } } },
    });

    auditKpiReadingRecorded(kpi, reading, req.user.userId).catch(() => {});

    return res.status(201).json({ reading, kpi });
  } catch (err) {
    return sendKpiError(res, err, 'Record KPI reading');
  }
}

async function deleteReading(req, res) {
  try {
    const existing = await prisma.kpiReading.findUnique({
      where: { id: req.params.readingId },
      include: { kpi: true },
    });

    await kpisService.deleteKpiReading({
      readingId: req.params.readingId,
      userId: req.user.userId,
    });

    // Audited only once the removal succeeded, so a refused attempt does not
    // leave the log claiming something was deleted.
    if (existing) {
      auditKpiReadingDeleted(existing.kpi, existing, req.user.userId).catch(() => {});
    }

    const kpi = await prisma.kPI.findUnique({
      where: { id: existing.kpi.id },
      include: { readings: { orderBy: { recordedFor: 'desc' }, take: 36, include: { recordedBy: { select: { id: true, name: true } } } } },
    });

    return res.json({ id: req.params.readingId, kpi });
  } catch (err) {
    return sendKpiError(res, err, 'Delete KPI reading');
  }
}

async function updateKpi(req, res) {
  try {
    const oldKpi = await prisma.kPI.findUnique({ where: { id: req.params.id } });

    const { value, target } = req.body;
    const kpi = await kpisService.updateKpi({
      kpiId: req.params.id,
      value,
      target,
      userId: req.user.userId,
    });

    if (oldKpi) {
      auditKpiUpdated(kpi, { value: oldKpi.value, target: oldKpi.target }, req.user.userId).catch(() => {});
    }

    return res.json(kpi);
  } catch (err) {
    return sendKpiError(res, err, 'Update KPI');
  }
}

async function createKpi(req, res) {
  try {
    const { name, unit, target, category, description } = req.body;
    if (!name || !unit) {
      return res.status(400).json({ error: 'name and unit are required' });
    }
    const kpi = await kpisService.createKpi({
      orgId: req.params.id,
      name, unit, target, category, description,
      userId: req.user.userId,
    });
    auditKpiCreated(kpi, req.user.userId).catch(() => {});
    return res.status(201).json(kpi);
  } catch (err) {
    return sendKpiError(res, err, 'Create KPI');
  }
}

async function deleteKpi(req, res) {
  try {
    const kpi = await prisma.kPI.findUnique({ where: { id: req.params.id } });

    await kpisService.deleteKpi({ kpiId: req.params.id, userId: req.user.userId });

    // After the delete, not before — the previous order logged a deletion
    // even when the permission check went on to refuse it.
    if (kpi) {
      auditKpiDeleted(kpi, req.user.userId).catch(() => {});
    }

    return res.json({ message: 'KPI deleted' });
  } catch (err) {
    return sendKpiError(res, err, 'Delete KPI');
  }
}

async function bulkUpdate(req, res) {
  try {
    const { updates } = req.body;
    const results = await kpisService.bulkUpdateKpis({ updates, userId: req.user.userId });
    return res.json(results);
  } catch (err) {
    return sendKpiError(res, err, 'Bulk update');
  }
}

module.exports = {
  getOrgKpis,
  getReadings,
  recordReading,
  deleteReading,
  updateKpi,
  createKpi,
  deleteKpi,
  bulkUpdate,
};
