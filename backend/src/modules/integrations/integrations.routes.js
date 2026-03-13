const { Router } = require('express');
const {
  createIntegration, getIntegrations, deleteIntegration,
  testConnection, syncIntegration, getSyncLogs,
} = require('./integrations.controller');

const router = Router();

router.post('/test', testConnection);
router.get('/org/:id', getIntegrations);
router.post('/org/:id', createIntegration);
router.get('/org/:id/logs', getSyncLogs);
router.delete('/:integrationId', deleteIntegration);
router.post('/:integrationId/sync', syncIntegration);

module.exports = router;
