const { Router } = require('express');
const controller = require('./auditLogs.controller');

const router = Router();

router.get('/org/:orgId', controller.getOrgLogs);
router.get('/org/:orgId/entity/:entityType/:entityId', controller.getEntityLogs);

module.exports = router;
