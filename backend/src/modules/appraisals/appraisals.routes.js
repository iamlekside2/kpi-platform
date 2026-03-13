const { Router } = require('express');
const ctrl = require('./appraisals.controller');

const router = Router();

// Form structure (questions/attributes definitions)
router.get('/form-structure', ctrl.getFormStructure);

// CRUD for org appraisals
router.get('/org/:orgId', ctrl.getAll);
router.get('/org/:orgId/my', ctrl.getMine);
router.post('/org/:orgId', ctrl.create);

// Single appraisal operations
router.get('/:id', ctrl.getOne);
router.patch('/:id/employee', ctrl.updateEmployee);
router.post('/:id/submit', ctrl.submit);
router.patch('/:id/unit-head', ctrl.updateUnitHead);
router.patch('/:id/admin', ctrl.updateAdmin);
router.patch('/:id/md', ctrl.updateMd);
router.delete('/:id', ctrl.remove);

module.exports = router;
