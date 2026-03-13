const { Router } = require('express');
const { getNotifications, markRead, markAllRead } = require('./notifications.controller');

const router = Router();

router.get('/org/:orgId', getNotifications);
router.patch('/:id/read', markRead);
router.patch('/org/:orgId/read-all', markAllRead);

module.exports = router;
