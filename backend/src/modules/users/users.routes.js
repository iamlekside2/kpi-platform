const { Router } = require('express');
const { getProfile, updateProfile, changePassword } = require('./users.controller');

const router = Router();

router.get('/', getProfile);
router.patch('/', updateProfile);
router.patch('/password', changePassword);

module.exports = router;
