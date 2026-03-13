const { Router } = require('express');
const { previewCSV, importCSV } = require('./import.controller');

const router = Router();

router.post('/org/:id/preview', previewCSV);
router.post('/org/:id/confirm', importCSV);

module.exports = router;
