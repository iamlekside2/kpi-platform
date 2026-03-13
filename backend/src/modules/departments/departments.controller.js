const prisma = require('../../config/db');
const service = require('./departments.service');

// Helper: get user's org role
async function getUserRole(userId, orgId) {
  const member = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  return member?.role || null;
}

// POST /departments/org/:orgId
async function create(req, res) {
  try {
    const role = await getUserRole(req.user.userId, req.params.orgId);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create departments' });
    }

    const dept = await service.createDepartment(req.params.orgId, req.body);
    res.status(201).json(dept);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A department with that slug already exists' });
    }
    console.error('Create department error:', err);
    res.status(500).json({ error: 'Failed to create department' });
  }
}

// GET /departments/org/:orgId
async function getAll(req, res) {
  try {
    const role = await getUserRole(req.user.userId, req.params.orgId);
    if (!role) {
      return res.status(403).json({ error: 'Not a member of this org' });
    }

    const departments = await service.getOrgDepartments(req.params.orgId);
    res.json(departments);
  } catch (err) {
    console.error('Get departments error:', err);
    res.status(500).json({ error: 'Failed to get departments' });
  }
}

// PATCH /departments/:id
async function update(req, res) {
  try {
    const dept = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const role = await getUserRole(req.user.userId, dept.orgId);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update departments' });
    }

    const updated = await service.updateDepartment(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    console.error('Update department error:', err);
    res.status(500).json({ error: 'Failed to update department' });
  }
}

// DELETE /departments/:id
async function remove(req, res) {
  try {
    const dept = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!dept) return res.status(404).json({ error: 'Department not found' });

    const role = await getUserRole(req.user.userId, dept.orgId);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete departments' });
    }

    await service.deleteDepartment(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete department error:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
}

module.exports = { create, getAll, update, remove };
