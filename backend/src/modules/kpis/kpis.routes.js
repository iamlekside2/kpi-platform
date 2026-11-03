const { Router } = require('express');
const {
  getOrgKpis,
  getReadings,
  recordReading,
  deleteReading,
  updateKpi,
  createKpi,
  deleteKpi,
  bulkUpdate,
} = require('./kpis.controller');

const router = Router();

// Org-scoped routes
router.get('/org/:id', getOrgKpis);
router.post('/org/:id', createKpi);
router.post('/org/:id/bulk', bulkUpdate);

// Readings. The literal path has to be declared before '/:id', or Express
// would read "readings" as a KPI id.
router.delete('/readings/:readingId', deleteReading);
router.get('/:id/readings', getReadings);
router.post('/:id/readings', recordReading);

// KPI-level routes
router.patch('/:id', updateKpi);
router.delete('/:id', deleteKpi);

module.exports = router;
