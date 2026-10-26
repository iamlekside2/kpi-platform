const prisma = require('../../config/db');
const bcrypt = require('bcryptjs');
const { sendStaffInviteEmail } = require('../../utils/mailer');
const { seedDefaultDepartments } = require('../departments/departments.service');

const SALT_ROUNDS = 12;
const STAFF_TYPES = ['permanent', 'contract'];
const MAX_LEVEL = 20;

// Levels arrive from JSON bodies as numbers or strings; '' / null means "not set".
function normaliseLevel(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LEVEL) {
    throw new Error('Invalid level');
  }
  return n;
}

async function createOrg({ name, userId }) {
  // Onboarding is reachable by any signed-in user, so without this an
  // existing member can run it again and stand up a parallel org — which
  // is how a near-duplicate of the company org got created. Colleagues
  // join by invitation from the Staff page, never by self-onboarding.
  const existingMembership = await prisma.orgMember.findFirst({
    where: { userId },
    include: { org: { select: { name: true } } },
  });
  if (existingMembership) {
    throw new Error(`You already belong to ${existingMembership.org.name}`);
  }

  const org = await prisma.organisation.create({
    data: {
      name,
      // The founder signs off appraisals until they hand the job over
      hrOfficerId: userId,
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

  // Seed default departments for the new org
  await seedDefaultDepartments(org.id).catch(() => {});

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

async function inviteToOrg({ orgId, email, name, role = 'member', departmentId, level, staffType = 'permanent', inviterId }) {
  if (!['admin', 'lead', 'member', 'md', 'chairman'].includes(role)) {
    throw new Error('Invalid role');
  }
  if (!STAFF_TYPES.includes(staffType)) throw new Error('Invalid staff type');
  const parsedLevel = normaliseLevel(level);
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
    // Use email prefix as fallback name if none provided
    const staffName = name || email.split('@')[0];

    const defaultPassword = 'Welcome@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

    user = await prisma.user.create({
      data: {
        email,
        name: staffName,
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

  const memberData = { role, userId: user.id, orgId, staffType };
  if (departmentId) memberData.departmentId = departmentId;
  if (parsedLevel !== null) memberData.level = parsedLevel;

  const member = await prisma.orgMember.create({
    data: memberData,
    include: {
      user: { select: { id: true, email: true, name: true } },
      department: { select: { id: true, name: true, slug: true } },
    },
  });

  // Get org name and inviter name for the email
  const [org, inviter] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: inviterId }, select: { name: true } }),
  ]);

  // Send invite email (fire-and-forget)
  const isNewAccount = !existing; // new account was just created
  sendStaffInviteEmail({
    email,
    name: member.user.name,
    orgName: org?.name || 'your organisation',
    inviterName: inviter?.name || 'An admin',
    isNewAccount,
  }).catch(() => {});

  return {
    id: member.id,
    role: member.role,
    level: member.level,
    staffType: member.staffType,
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    department: member.department || null,
    isNewAccount,
  };
}

async function getUserOrgs(userId) {
  const memberships = await prisma.orgMember.findMany({
    where: { userId },
    include: {
      org: {
        include: {
          _count: { select: { members: true, kpis: true } },
          members: { where: { role: 'md' }, select: { id: true } },
          hrOfficer: { select: { id: true, name: true } },
        },
      },
    },
    // Without this the order is whatever Postgres returns, and the client
    // takes the first org — so a second membership could silently swap which
    // org (and which role) the whole app ran as. Oldest first is stable.
    orderBy: { org: { createdAt: 'asc' } },
  });

  return memberships.map((m) => {
    // eslint-disable-next-line no-unused-vars
    const { members, hrOfficer, ...org } = m.org;
    return {
      ...org,
      hrOfficerId: hrOfficer?.id || null,
      hrOfficerName: hrOfficer?.name || null,
      role: m.role,
      // Lets the UI offer the MD section to an admin only where no MD exists
      hasMd: members.length > 0,
      memberCount: m.org._count.members,
      kpiCount: m.org._count.kpis,
    };
  });
}

// ── Get org members ──
async function getOrgMembers(orgId, requesterId) {
  // Verify requester is a member
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');

  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
    select: { hrOfficerId: true },
  });

  const members = await prisma.orgMember.findMany({
    where: { orgId },
    include: {
      user: { select: { id: true, email: true, name: true, createdAt: true } },
      department: { select: { id: true, name: true, slug: true } },
      levelChanges: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { fromLevel: true, toLevel: true, createdAt: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return members.map((m) => ({
    id: m.id,
    role: m.role,
    isHrOfficer: m.userId === org?.hrOfficerId,
    level: m.level,
    staffType: m.staffType,
    lastLevelChange: m.levelChanges[0] || null,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    department: m.department || null,
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
  if (!['admin', 'lead', 'member', 'md', 'chairman'].includes(newRole)) {
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

// ── Update member level ──
// Every change is recorded in LevelChange so the promotion trail survives,
// not just the latest value.
async function updateMemberLevel(orgId, memberId, { level, note = '' }, requesterId) {
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
  });
  if (!requester || requester.role !== 'admin') {
    throw new Error('Only admins can change levels');
  }

  const newLevel = normaliseLevel(level);
  if (newLevel === null) throw new Error('Invalid level');

  const target = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!target) throw new Error('Member not found');
  if (target.orgId !== orgId) throw new Error('Member not found');
  if (target.level === newLevel) throw new Error('Member is already on that level');

  const [updated] = await prisma.$transaction([
    prisma.orgMember.update({
      where: { id: memberId },
      data: { level: newLevel },
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    prisma.levelChange.create({
      data: {
        memberId,
        orgId,
        fromLevel: target.level,
        toLevel: newLevel,
        note,
        changedById: requesterId,
      },
    }),
  ]);

  return {
    id: updated.id,
    role: updated.role,
    level: updated.level,
    staffType: updated.staffType,
    userId: updated.userId,
    name: updated.user.name,
    email: updated.user.email,
    previousLevel: target.level,
  };
}

// ── Name the HR officer ──
// Exactly one per org by construction: setting it replaces whoever held it.
async function setHrOfficer(orgId, userId, requesterId) {
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
  });
  if (!requester || requester.role !== 'admin') {
    throw new Error('Only admins can name the HR officer');
  }

  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
    select: { hrOfficerId: true },
  });
  if (!org) throw new Error('Organisation not found');

  if (userId !== null) {
    const target = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: { user: { select: { name: true } } },
    });
    if (!target) throw new Error('That person is not a member of this organisation');
  }

  const updated = await prisma.organisation.update({
    where: { id: orgId },
    data: { hrOfficerId: userId },
    include: { hrOfficer: { select: { id: true, name: true } } },
  });

  return {
    hrOfficerId: updated.hrOfficer?.id || null,
    hrOfficerName: updated.hrOfficer?.name || null,
    previousHrOfficerId: org.hrOfficerId,
  };
}

// ── Update member staff type (permanent | contract) ──
async function updateMemberStaffType(orgId, memberId, staffType, requesterId) {
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
  });
  if (!requester || requester.role !== 'admin') {
    throw new Error('Only admins can change staff type');
  }
  if (!STAFF_TYPES.includes(staffType)) throw new Error('Invalid staff type');

  const target = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!target || target.orgId !== orgId) throw new Error('Member not found');

  const updated = await prisma.orgMember.update({
    where: { id: memberId },
    data: { staffType },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return {
    id: updated.id,
    role: updated.role,
    level: updated.level,
    staffType: updated.staffType,
    userId: updated.userId,
    name: updated.user.name,
    email: updated.user.email,
    previousStaffType: target.staffType,
  };
}

// ── Level history for one member ──
async function getMemberLevelHistory(orgId, memberId, requesterId) {
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
  });
  if (!requester) throw new Error('Not a member of this organisation');

  const target = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!target || target.orgId !== orgId) throw new Error('Member not found');

  // Staff can see their own trail; everyone above member level sees anyone's
  if (requester.role === 'member' && target.userId !== requesterId) {
    throw new Error('You can only view your own level history');
  }

  const changes = await prisma.levelChange.findMany({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
    include: { changedBy: { select: { name: true } } },
  });

  return changes.map((c) => ({
    id: c.id,
    fromLevel: c.fromLevel,
    toLevel: c.toLevel,
    note: c.note,
    changedBy: c.changedBy?.name || 'Unknown',
    createdAt: c.createdAt,
  }));
}

// ── Update member department ──
async function updateMemberDepartment(orgId, memberId, departmentId, requesterId) {
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
  });
  if (!requester || requester.role !== 'admin') {
    throw new Error('Only admins can change departments');
  }

  const target = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!target) throw new Error('Member not found');

  const updated = await prisma.orgMember.update({
    where: { id: memberId },
    data: { departmentId: departmentId || null },
    include: {
      user: { select: { id: true, email: true, name: true } },
      department: { select: { id: true, name: true, slug: true } },
    },
  });

  return {
    id: updated.id,
    role: updated.role,
    userId: updated.userId,
    name: updated.user.name,
    email: updated.user.email,
    department: updated.department || null,
  };
}

// ── Update theme colour ──
async function updateThemeColor(orgId, themeColor, requesterId) {
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
  });
  if (!requester || requester.role !== 'admin') {
    throw new Error('Only admins can change theme');
  }

  const org = await prisma.organisation.update({
    where: { id: orgId },
    data: { themeColor },
  });

  return { themeColor: org.themeColor };
}

module.exports = {
  createOrg,
  getOrgById,
  inviteToOrg,
  getUserOrgs,
  getOrgMembers,
  updateMemberRole,
  updateMemberDepartment,
  updateMemberLevel,
  updateMemberStaffType,
  setHrOfficer,
  getMemberLevelHistory,
  removeMember,
  updateThemeColor,
  STAFF_TYPES,
  MAX_LEVEL,
};
