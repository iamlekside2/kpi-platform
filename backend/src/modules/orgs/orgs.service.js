const prisma = require('../../config/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

async function createOrg({ name, userId }) {
  const org = await prisma.organisation.create({
    data: {
      name,
      members: {
        create: {
          role: 'admin',
          userId,
        },
      },
    },
    include: {
      members: { include: { user: { select: { id: true, email: true, name: true } } } },
    },
  });

  return org;
}

async function getOrgById(orgId, userId) {
  // Verify user is a member
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });

  if (!membership) {
    throw new Error('Not a member of this organisation');
  }

  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
    include: {
      members: { include: { user: { select: { id: true, email: true, name: true } } } },
      kpis: true,
    },
  });

  if (!org) {
    throw new Error('Organisation not found');
  }

  return org;
}

async function inviteToOrg({ orgId, email, name, role = 'member', inviterId }) {
  // Verify inviter is admin
  const inviterMembership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: inviterId, orgId } },
  });

  if (!inviterMembership || inviterMembership.role !== 'admin') {
    throw new Error('Only admins can invite members');
  }

  // Find or create user by email
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Auto-create account for the staff member with a default password
    if (!name) throw new Error('Name is required when adding a new staff member');

    const defaultPassword = 'Welcome@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

    user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });
  }

  // Check if already a member
  const existing = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: user.id, orgId } },
  });

  if (existing) {
    throw new Error('User is already a member');
  }

  const member = await prisma.orgMember.create({
    data: { role, userId: user.id, orgId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return {
    id: member.id,
    role: member.role,
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    isNewAccount: !user.createdAt || true, // flag for frontend
  };
}

async function getUserOrgs(userId) {
  const memberships = await prisma.orgMember.findMany({
    where: { userId },
    include: {
      org: {
        include: {
          _count: { select: { members: true, kpis: true } },
        },
      },
    },
  });

  return memberships.map((m) => ({
    ...m.org,
    role: m.role,
    memberCount: m.org._count.members,
    kpiCount: m.org._count.kpis,
  }));
}

// ── Get org members ──
async function getOrgMembers(orgId, requesterId) {
  // Verify requester is a member
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');

  const members = await prisma.orgMember.findMany({
    where: { orgId },
    include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
    orderBy: { user: { name: 'asc' } },
  });

  return members.map((m) => ({
    id: m.id,
    role: m.role,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    joinedAt: m.user.createdAt,
  }));
}

// ── Update member role ──
async function updateMemberRole(orgId, memberId, newRole, requesterId) {
  // Verify requester is admin
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
  });
  if (!requester || requester.role !== 'admin') {
    throw new Error('Only admins can change roles');
  }

  // Can't change your own role
  const target = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!target) throw new Error('Member not found');
  if (target.userId === requesterId) throw new Error('Cannot change your own role');

  // Valid roles
  if (!['admin', 'lead', 'member'].includes(newRole)) {
    throw new Error('Invalid role');
  }

  const updated = await prisma.orgMember.update({
    where: { id: memberId },
    data: { role: newRole },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return { id: updated.id, role: updated.role, userId: updated.userId, name: updated.user.name, email: updated.user.email };
}

// ── Remove member ──
async function removeMember(orgId, memberId, requesterId) {
  // Verify requester is admin
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
  });
  if (!requester || requester.role !== 'admin') {
    throw new Error('Only admins can remove members');
  }

  const target = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!target) throw new Error('Member not found');
  if (target.userId === requesterId) throw new Error('Cannot remove yourself');

  await prisma.orgMember.delete({ where: { id: memberId } });
  return { success: true };
}

module.exports = { createOrg, getOrgById, inviteToOrg, getUserOrgs, getOrgMembers, updateMemberRole, removeMember };
