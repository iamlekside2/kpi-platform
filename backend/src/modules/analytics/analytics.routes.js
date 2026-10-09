const { Router } = require('express');
const { getSummary, getTeam, getStaffPerformance } = require('./analytics.controller');

const router = Router();

router.get('/org/:orgId', getSummary);
router.get('/org/:orgId/team', getTeam);
router.get('/org/:orgId/staff-performance', getStaffPerformance);

module.exports = router;
