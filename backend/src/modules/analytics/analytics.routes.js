const { Router } = require('express');
const { getSummary, getTeam, getStaffPerformance, getEmployeePerformance, getAdminSummary } = require('./analytics.controller');

const router = Router();

router.get('/org/:orgId', getSummary);
router.get('/org/:orgId/team', getTeam);
router.get('/org/:orgId/staff-performance', getStaffPerformance);
router.get('/org/:orgId/staff/:userId', getEmployeePerformance);
router.get('/org/:orgId/admin-summary', getAdminSummary);

module.exports = router;
