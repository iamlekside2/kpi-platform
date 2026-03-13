const { Router } = require('express');
const { create, getAll, update, remove } = require('./departments.controller');

const router = Router();

router.post('/org/:orgId', create);
router.get('/org/:orgId', getAll);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
