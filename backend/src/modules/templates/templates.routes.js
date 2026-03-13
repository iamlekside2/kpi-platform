const { Router } = require('express');
const { listTemplates, applyTemplate } = require('./templates.controller');

const router = Router();

router.get('/', listTemplates);
// Apply template to an org — uses org ID from URL
router.post('/apply/:id', applyTemplate);

module.exports = router;
