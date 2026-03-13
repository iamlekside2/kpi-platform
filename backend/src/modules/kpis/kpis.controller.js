const kpisService = require('./kpis.service');

async function getOrgKpis(req, res) {
  try {
    const kpis = await kpisService.getOrgKpis(req.params.id, req.user.userId);
    return res.json(kpis);
  } catch (err) {
    if (err.message === 'Not a member of this organisation') {
      return res.status(403).json({ error: err.message });
    }
    console.error('Get KPIs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateKpi(req, res) {
  try {
    const { value, target } = req.body;
    const kpi = await kpisService.updateKpi({
      kpiId: req.params.id,
      value,
      target,
      userId: req.user.userId,
    });
    return res.json(kpi);
  } catch (err) {
    if (err.message === 'KPI not found') return res.status(404).json({ error: err.message });
    if (err.message === 'Not a member of this organisation') return res.status(403).json({ error: err.message });
    console.error('Update KPI error:', err);
    return res.status(500).json({ error: 'Internal server error' });
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
    return res.status(201).json(kpi);
  } catch (err) {
    if (err.message === 'Members cannot create KPIs') return res.status(403).json({ error: err.message });
    console.error('Create KPI error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteKpi(req, res) {
  try {
    await kpisService.deleteKpi({ kpiId: req.params.id, userId: req.user.userId });
    return res.json({ message: 'KPI deleted' });
  } catch (err) {
    if (err.message === 'KPI not found') return res.status(404).json({ error: err.message });
    if (err.message.includes('Only admins')) return res.status(403).json({ error: err.message });
    console.error('Delete KPI error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function bulkUpdate(req, res) {
  try {
    const { updates } = req.body;
    const results = await kpisService.bulkUpdateKpis({ updates, userId: req.user.userId });
    return res.json(results);
  } catch (err) {
    console.error('Bulk update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getOrgKpis, updateKpi, createKpi, deleteKpi, bulkUpdate };
