const { Router } = require('express');
const { getOrgKpis, updateKpi, createKpi, deleteKpi, bulkUpdate } = require('./kpis.controller');

const router = Router();

// Org-scoped routes
router.get('/org/:id', getOrgKpis);
router.post('/org/:id', createKpi);
router.post('/org/:id/bulk', bulkUpdate);

// KPI-level routes
router.patch('/:id', updateKpi);
router.delete('/:id', deleteKpi);

module.exports = router;
