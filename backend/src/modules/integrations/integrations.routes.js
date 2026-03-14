const { Router } = require('express');
const {
  createIntegration, getIntegrations, deleteIntegration,
  testConnection, syncIntegration, getSyncLogs,
  syncMemberWorkItems, getMemberWorkItems,
} = require('./integrations.controller');

const router = Router();

router.post('/test', testConnection);
router.get('/org/:id', getIntegrations);
router.post('/org/:id', createIntegration);
router.get('/org/:id/logs', getSyncLogs);
router.get('/org/:orgId/member/:userId/work-items', getMemberWorkItems);
router.delete('/:integrationId', deleteIntegration);
router.post('/:integrationId/sync', syncIntegration);
router.post('/:integrationId/sync-members', syncMemberWorkItems);

module.exports = router;
