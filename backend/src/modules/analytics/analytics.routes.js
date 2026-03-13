const { Router } = require('express');
const { getSummary } = require('./analytics.controller');

const router = Router();

router.get('/org/:orgId', getSummary);

module.exports = router;
