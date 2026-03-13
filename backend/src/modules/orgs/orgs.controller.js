const orgsService = require('./orgs.service');

async function createOrg(req, res) {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Organisation name is required' });
    }

    const org = await orgsService.createOrg({ name, userId: req.user.userId });
    return res.status(201).json(org);
  } catch (err) {
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
    const { email, name, role, departmentId } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const member = await orgsService.inviteToOrg({
      orgId: req.params.id,
      email,
      name,
      role,
      departmentId,
      inviterId: req.user.userId,
    });

    return res.status(201).json(member);
  } catch (err) {
    const clientErrors = ['Only admins can invite members', 'User is already a member', 'Name is required when adding a new staff member'];
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
    if (err.message === 'Not a member of this organisation') {
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

    const member = await orgsService.updateMemberRole(
      req.params.id,
      req.params.memberId,
      role,
      req.user.userId
    );
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
    const member = await orgsService.updateMemberDepartment(
      req.params.id,
      req.params.memberId,
      departmentId,
      req.user.userId
    );
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

module.exports = { createOrg, getOrg, inviteToOrg, getUserOrgs, getMembers, updateMemberRole, updateMemberDepartment, removeMember, updateThemeColor };
