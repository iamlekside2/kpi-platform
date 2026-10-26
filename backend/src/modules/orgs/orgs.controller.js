const orgsService = require('./orgs.service');
const prisma = require('../../config/db');
const { auditMemberInvited, auditMemberRoleChanged, auditMemberDepartmentChanged, auditMemberLevelChanged, auditMemberStaffTypeChanged, auditHrOfficerChanged, auditMemberUserUpdated, auditMemberPasswordReset, auditMemberRemoved } = require('../auditLogs/audit');

async function createOrg(req, res) {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Organisation name is required' });
    }

    const org = await orgsService.createOrg({ name, userId: req.user.userId });
    return res.status(201).json(org);
  } catch (err) {
    if (err.message.startsWith('You already belong to')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Create org error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getOrg(req, res) {
  try {
    const org = await orgsService.getOrgById(req.params.id, req.user.userId);
    return res.json(org);
  } catch (err) {
    if (err.message === 'Not a member of this organisation' || err.message === 'Organisation not found') {
      return res.status(404).json({ error: err.message });
    }
    console.error('Get org error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function inviteToOrg(req, res) {
  try {
    const { email, name, role, departmentId, level, staffType } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const member = await orgsService.inviteToOrg({
      orgId: req.params.id,
      email,
      name,
      role,
      departmentId,
      level,
      staffType,
      inviterId: req.user.userId,
    });

    auditMemberInvited(member, req.user.userId).catch(() => {});
    return res.status(201).json(member);
  } catch (err) {
    const clientErrors = ['Only admins can invite members', 'User is already a member', 'Name is required when adding a new staff member', 'Invalid role', 'Invalid level', 'Invalid staff type'];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Invite error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUserOrgs(req, res) {
  try {
    const orgs = await orgsService.getUserOrgs(req.user.userId);
    return res.json(orgs);
  } catch (err) {
    console.error('Get user orgs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMembers(req, res) {
  try {
    const members = await orgsService.getOrgMembers(req.params.id, req.user.userId);
    return res.json(members);
  } catch (err) {
    if (err.message === 'Not a member of this organisation'
      || err.message === 'Only staff with a management role can view the staff list') {
      return res.status(403).json({ error: err.message });
    }
    console.error('Get members error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateMemberRole(req, res) {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'Role is required' });

    // Capture old role before update
    const oldMember = await prisma.orgMember.findUnique({
      where: { id: req.params.memberId },
      include: { user: { select: { name: true, email: true } } },
    });
    const oldRole = oldMember?.role;

    const member = await orgsService.updateMemberRole(
      req.params.id,
      req.params.memberId,
      role,
      req.user.userId
    );

    if (oldRole && oldRole !== role) {
      // Enrich member with user info for audit description
      const enriched = { ...member, user: oldMember?.user, orgId: req.params.id };
      auditMemberRoleChanged(enriched, oldRole, req.user.userId).catch(() => {});
    }

    return res.json(member);
  } catch (err) {
    const clientErrors = ['Only admins can change roles', 'Member not found', 'Cannot change your own role', 'Invalid role'];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Update role error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function removeMember(req, res) {
  try {
    // Capture member info before removal for audit
    const memberToRemove = await prisma.orgMember.findUnique({
      where: { id: req.params.memberId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (memberToRemove) {
      const enriched = { ...memberToRemove, orgId: req.params.id };
      auditMemberRemoved(enriched, req.user.userId).catch(() => {});
    }

    const result = await orgsService.removeMember(req.params.id, req.params.memberId, req.user.userId);
    return res.json(result);
  } catch (err) {
    const clientErrors = ['Only admins can remove members', 'Member not found', 'Cannot remove yourself'];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Remove member error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateMemberDepartment(req, res) {
  try {
    const { departmentId } = req.body;

    // Capture old department before update
    const oldMember = await prisma.orgMember.findUnique({
      where: { id: req.params.memberId },
      include: { user: { select: { name: true, email: true } } },
    });
    const oldDeptId = oldMember?.departmentId;

    const member = await orgsService.updateMemberDepartment(
      req.params.id,
      req.params.memberId,
      departmentId,
      req.user.userId
    );

    // Enrich for audit
    const enriched = { ...member, user: oldMember?.user, orgId: req.params.id };
    auditMemberDepartmentChanged(enriched, oldDeptId, req.user.userId).catch(() => {});

    return res.json(member);
  } catch (err) {
    const clientErrors = ['Only admins can change departments', 'Member not found'];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Update department error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateMemberLevel(req, res) {
  try {
    const { level, note } = req.body;

    const member = await orgsService.updateMemberLevel(
      req.params.id,
      req.params.memberId,
      { level, note },
      req.user.userId
    );

    const enriched = { ...member, orgId: req.params.id };
    auditMemberLevelChanged(enriched, member.previousLevel, req.user.userId).catch(() => {});

    return res.json(member);
  } catch (err) {
    const clientErrors = ['Only admins can change levels', 'Member not found', 'Invalid level', 'Member is already on that level'];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Update level error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateMemberStaffType(req, res) {
  try {
    const { staffType } = req.body;

    const member = await orgsService.updateMemberStaffType(
      req.params.id,
      req.params.memberId,
      staffType,
      req.user.userId
    );

    if (member.previousStaffType !== member.staffType) {
      const enriched = { ...member, orgId: req.params.id };
      auditMemberStaffTypeChanged(enriched, member.previousStaffType, req.user.userId).catch(() => {});
    }

    return res.json(member);
  } catch (err) {
    const clientErrors = ['Only admins can change staff type', 'Member not found', 'Invalid staff type'];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Update staff type error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateMemberUser(req, res) {
  try {
    const { name, email, integrationEmail } = req.body;
    const result = await orgsService.updateMemberUser(
      req.params.id,
      req.params.memberId,
      { name, email, integrationEmail },
      req.user.userId
    );

    if (result.changed.length > 0) {
      auditMemberUserUpdated(req.params.id, result, req.user.userId).catch(() => {});
    }

    return res.json(result);
  } catch (err) {
    const clientErrors = [
      'Only admins can edit staff details',
      'Member not found',
      'Name cannot be empty',
      'That email address is not valid',
      'That integration email is not valid',
      'Another account already uses that email',
    ];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Update member user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function resetMemberPassword(req, res) {
  try {
    const result = await orgsService.resetMemberPassword(
      req.params.id,
      req.params.memberId,
      req.user.userId
    );
    auditMemberPasswordReset(req.params.id, result, req.user.userId).catch(() => {});
    return res.json(result);
  } catch (err) {
    const clientErrors = [
      'Only admins can reset passwords',
      'Member not found',
      'Change your own password from Settings',
    ];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function setHrOfficer(req, res) {
  try {
    const { userId } = req.body;
    const result = await orgsService.setHrOfficer(
      req.params.id,
      userId || null,
      req.user.userId
    );

    if (result.previousHrOfficerId !== result.hrOfficerId) {
      auditHrOfficerChanged(req.params.id, result, req.user.userId).catch(() => {});
    }

    return res.json(result);
  } catch (err) {
    const clientErrors = [
      'Only admins can name the HR officer',
      'Organisation not found',
      'That person is not a member of this organisation',
    ];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Set HR officer error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMemberLevelHistory(req, res) {
  try {
    const history = await orgsService.getMemberLevelHistory(
      req.params.id,
      req.params.memberId,
      req.user.userId
    );
    return res.json(history);
  } catch (err) {
    const clientErrors = ['Not a member of this organisation', 'Member not found', 'You can only view your own level history'];
    if (clientErrors.includes(err.message)) {
      return res.status(403).json({ error: err.message });
    }
    console.error('Level history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateThemeColor(req, res) {
  try {
    const { themeColor } = req.body;
    const VALID_COLORS = ['indigo', 'blue', 'cyan', 'emerald', 'amber', 'rose', 'purple', 'pink', 'violet', 'teal'];
    if (!themeColor || !VALID_COLORS.includes(themeColor)) {
      return res.status(400).json({ error: 'Invalid theme colour' });
    }
    const result = await orgsService.updateThemeColor(req.params.id, themeColor, req.user.userId);
    return res.json(result);
  } catch (err) {
    if (err.message === 'Only admins can change theme') {
      return res.status(403).json({ error: err.message });
    }
    console.error('Update theme error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createOrg, getOrg, inviteToOrg, getUserOrgs, getMembers, updateMemberRole, updateMemberDepartment, updateMemberLevel, updateMemberStaffType, updateMemberUser, resetMemberPassword, setHrOfficer, getMemberLevelHistory, removeMember, updateThemeColor };
