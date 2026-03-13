const notificationsService = require('./notifications.service');

async function getNotifications(req, res) {
  try {
    const { orgId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await notificationsService.getUserNotifications(req.user.userId, orgId, { limit, offset });
    return res.json(result);
  } catch (err) {
    console.error('Get notifications error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function markRead(req, res) {
  try {
    const { id } = req.params;
    await notificationsService.markAsRead(id, req.user.userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function markAllRead(req, res) {
  try {
    const { orgId } = req.params;
    await notificationsService.markAllAsRead(req.user.userId, orgId);
    return res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getNotifications, markRead, markAllRead };
