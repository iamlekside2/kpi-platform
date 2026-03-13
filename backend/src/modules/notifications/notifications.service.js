const prisma = require('../../config/db');

async function createNotification({ userId, orgId, type, title, message, link = '' }) {
  return prisma.notification.create({
    data: { userId, orgId, type, title, message, link },
  });
}

async function getUserNotifications(userId, orgId, { limit = 20, offset = 0 } = {}) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, orgId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({
      where: { userId, orgId, read: false },
    }),
  ]);

  return { notifications, unreadCount };
}

async function getUnreadCount(userId, orgId) {
  return prisma.notification.count({
    where: { userId, orgId, read: false },
  });
}

async function markAsRead(notificationId, userId) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

async function markAllAsRead(userId, orgId) {
  return prisma.notification.updateMany({
    where: { userId, orgId, read: false },
    data: { read: true },
  });
}

module.exports = { createNotification, getUserNotifications, getUnreadCount, markAsRead, markAllAsRead };
