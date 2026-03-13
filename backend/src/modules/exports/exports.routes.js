const { Router } = require('express');
const { exportAppraisalPDF, exportAppraisalsExcel, exportKPIsExcel } = require('./exports.controller');

const router = Router();

// PDF — single appraisal
router.get('/appraisals/:id/pdf', exportAppraisalPDF);

// Excel — all appraisals for an org
router.get('/org/:orgId/appraisals/excel', exportAppraisalsExcel);

// Excel — all KPIs for an org
router.get('/org/:orgId/kpis/excel', exportKPIsExcel);

module.exports = router;
