const bcrypt = require('bcryptjs');
const prisma = require('../../config/db');

const SALT_ROUNDS = 12;

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      orgs: {
        select: {
          role: true,
          org: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Flatten orgs for cleaner response
  const orgs = user.orgs.map((m) => ({
    id: m.org.id,
    name: m.org.name,
    role: m.role,
  }));

  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt, orgs };
}

async function updateProfile(userId, { name }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return user;
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    throw new Error('Current password is incorrect');
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { success: true };
}

module.exports = { getProfile, updateProfile, changePassword };
