const service = require('./appraisals.service');
const prisma = require('../../config/db');
const { notifyAppraisalCreated, notifyAppraisalSubmitted, notifyAppraisalReviewed, notifyAppraisalCompleted } = require('../notifications/notify');
const { auditAppraisalCreated, auditAppraisalUpdated, auditAppraisalStatusChanged, auditAppraisalDeleted } = require('../auditLogs/audit');

// ── Helper: get user's org role ──
async function getUserRole(userId, orgId) {
  const member = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  return member?.role || null;
}

// Only the org's named HR officer signs off the HR comment. Not every
// admin, and not everyone in the HR department — one person, set on the
// organisation. Admins can still read the section.
async function isHrOfficer(userId, orgId) {
  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
    select: { hrOfficerId: true },
  });
  return Boolean(org?.hrOfficerId && org.hrOfficerId === userId);
}

// GET /appraisals/form-structure?department=tech&orgId=...
// orgId is optional; with it the selectable departments and the section
// label come from the org's own departments rather than the built-in three.
async function getFormStructure(req, res) {
  const department = req.query.department || 'tech';
  let orgDepartments = null;

  if (req.query.orgId) {
    const member = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: req.user.userId, orgId: req.query.orgId } },
    });
    if (member) {
      orgDepartments = await prisma.department.findMany({
        where: { orgId: req.query.orgId },
        select: { slug: true, name: true },
        orderBy: { createdAt: 'asc' },
      });
    }
  }

  res.json(service.getFormStructure(department, orgDepartments));
}

// POST /appraisals/org/:orgId — only admin/lead can create appraisals
async function create(req, res) {
  try {
    const role = await getUserRole(req.user.userId, req.params.orgId);
    if (!role || role === 'member' || role === 'chairman') {
      return res.status(403).json({ error: 'Only admins and unit heads can create appraisals' });
    }

    const appraisal = await service.createAppraisal(
      req.params.orgId,
      req.body.employeeId || req.user.userId, // admin can create for another employee
      req.body
    );
    notifyAppraisalCreated(appraisal).catch(() => {});
    auditAppraisalCreated(appraisal, req.user.userId).catch(() => {});
    res.status(201).json(appraisal);
  } catch (err) {
    console.error('Create appraisal error:', err);
    res.status(500).json({ error: 'Failed to create appraisal' });
  }
}

// GET /appraisals/org/:orgId — admin/lead see all, member sees only own
async function getAll(req, res) {
  try {
    const role = await getUserRole(req.user.userId, req.params.orgId);
    if (!role) return res.status(403).json({ error: 'Not a member of this org' });

    if (role === 'member') {
      const appraisals = await service.getEmployeeAppraisals(req.params.orgId, req.user.userId);
      return res.json(appraisals);
    }

    // A unit head reviews their own department and sees only that
    if (role === 'lead') {
      const me = await prisma.orgMember.findUnique({
        where: { userId_orgId: { userId: req.user.userId, orgId: req.params.orgId } },
        select: { departmentId: true },
      });
      if (me?.departmentId) {
        const scoped = await service.getDepartmentAppraisals(req.params.orgId, me.departmentId);
        return res.json(scoped);
      }
    }

    const appraisals = await service.getOrgAppraisals(req.params.orgId);
    res.json(appraisals);
  } catch (err) {
    console.error('Get appraisals error:', err);
    res.status(500).json({ error: 'Failed to get appraisals' });
  }
}

// GET /appraisals/:id — role-based: members can only see their own
async function getOne(req, res) {
  try {
    const appraisal = await service.getAppraisalById(req.params.id);
    if (!appraisal) return res.status(404).json({ error: 'Appraisal not found' });

    const role = await getUserRole(req.user.userId, appraisal.orgId);
    if (!role) return res.status(403).json({ error: 'Not a member of this org' });

    // Members can only view their own appraisals
    if (role === 'member' && appraisal.employeeId !== req.user.userId) {
      return res.status(403).json({ error: 'You can only view your own appraisals' });
    }

    res.json(appraisal);
  } catch (err) {
    console.error('Get appraisal error:', err);
    res.status(500).json({ error: 'Failed to get appraisal' });
  }
}

// GET /appraisals/org/:orgId/my
async function getMine(req, res) {
  try {
    const appraisals = await service.getEmployeeAppraisals(req.params.orgId, req.user.userId);
    res.json(appraisals);
  } catch (err) {
    console.error('Get my appraisals error:', err);
    res.status(500).json({ error: 'Failed to get appraisals' });
  }
}

// PATCH /appraisals/:id/employee — only the employee themselves, while status=draft
async function updateEmployee(req, res) {
  try {
    const appraisal = await service.getAppraisalById(req.params.id);
    if (!appraisal) return res.status(404).json({ error: 'Appraisal not found' });

    if (appraisal.employeeId !== req.user.userId) {
      return res.status(403).json({ error: 'Only the assigned employee can edit this section' });
    }
    if (appraisal.status !== 'draft') {
      return res.status(400).json({ error: 'Appraisal has already been submitted' });
    }

    const updated = await service.updateEmployeeSection(req.params.id, req.body);
    auditAppraisalUpdated(updated, req.body, req.user.userId).catch(() => {});
    res.json(updated);
  } catch (err) {
    console.error('Update employee section error:', err);
    res.status(500).json({ error: 'Failed to update appraisal' });
  }
}

// POST /appraisals/:id/submit — only the employee, while status=draft
async function submit(req, res) {
  try {
    const appraisal = await service.getAppraisalById(req.params.id);
    if (!appraisal) return res.status(404).json({ error: 'Appraisal not found' });

    if (appraisal.employeeId !== req.user.userId) {
      return res.status(403).json({ error: 'Only the assigned employee can submit' });
    }
    if (appraisal.status !== 'draft') {
      return res.status(400).json({ error: 'Appraisal has already been submitted' });
    }

    // Submitting locks the appraisal, and anything unrated counts as zero
    const { missing, invalid } = service.validateSelfRatings(appraisal.selfRatings);
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Out of range: ${invalid.join(', ')}` });
    }
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Rate every attribute before submitting. ${missing.length} still unrated: ${missing.join(', ')}`,
        missing,
      });
    }

    const updated = await service.submitAppraisal(req.params.id);
    notifyAppraisalSubmitted(updated).catch(() => {});
    auditAppraisalStatusChanged(updated, 'draft', 'submitted', req.user.userId).catch(() => {});
    res.json(updated);
  } catch (err) {
    console.error('Submit appraisal error:', err);
    res.status(500).json({ error: 'Failed to submit appraisal' });
  }
}

// PATCH /appraisals/:id/unit-head — only lead role, after employee submits
async function updateUnitHead(req, res) {
  try {
    const appraisal = await service.getAppraisalById(req.params.id);
    if (!appraisal) return res.status(404).json({ error: 'Appraisal not found' });

    const role = await getUserRole(req.user.userId, appraisal.orgId);
    // Role alone was enough, so any unit head could score any department's
    // staff. A lead must lead the department the employee is in.
    if (role === 'lead') {
      const [me, them] = await Promise.all([
        prisma.orgMember.findUnique({
          where: { userId_orgId: { userId: req.user.userId, orgId: appraisal.orgId } },
          select: { departmentId: true },
        }),
        prisma.orgMember.findUnique({
          where: { userId_orgId: { userId: appraisal.employeeId, orgId: appraisal.orgId } },
          select: { departmentId: true },
        }),
      ]);
      if (me?.departmentId && me.departmentId !== them?.departmentId) {
        return res.status(403).json({ error: 'You can only review your own department' });
      }
    }
    if (role !== 'lead' && role !== 'admin') {
      return res.status(403).json({ error: 'Only unit heads can score appraisals' });
    }
    const scores = req.body.unitHeadScores;
    const { missing, invalid } = service.validateUnitHeadScores(scores);
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Out of range: ${invalid.join(', ')}` });
    }
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Score every attribute before saving. ${missing.length} still unscored: ${missing.join(', ')}`,
        missing,
      });
    }

    if (appraisal.status !== 'submitted') {
      return res.status(400).json({ error: 'Appraisal must be submitted before unit head review' });
    }

    const updated = await service.updateUnitHeadReview(req.params.id, req.user.userId, req.body);
    notifyAppraisalReviewed(updated, 'unit_head').catch(() => {});
    auditAppraisalStatusChanged(updated, 'submitted', 'unit_reviewed', req.user.userId).catch(() => {});
    res.json(updated);
  } catch (err) {
    console.error('Unit head review error:', err);
    res.status(500).json({ error: 'Failed to update unit head review' });
  }
}

// PATCH /appraisals/:id/admin — only admin role, after unit head review
async function updateAdmin(req, res) {
  try {
    const appraisal = await service.getAppraisalById(req.params.id);
    if (!appraisal) return res.status(404).json({ error: 'Appraisal not found' });

    if (!(await isHrOfficer(req.user.userId, appraisal.orgId))) {
      return res.status(403).json({ error: 'Only the named HR officer can add the HR comment' });
    }
    if (appraisal.status !== 'unit_reviewed' && appraisal.status !== 'admin_reviewed') {
      return res.status(400).json({ error: 'Appraisal must be unit-head reviewed first' });
    }

    await service.updateAdminComment(req.params.id, req.body.adminComment);
    // Return the full record: updateAdminComment omits the employee relation,
    // and the page writes the response straight into state
    const full = await service.getAppraisalById(req.params.id);
    notifyAppraisalReviewed(full, 'admin').catch(() => {});
    auditAppraisalStatusChanged(full, 'unit_reviewed', 'admin_reviewed', req.user.userId).catch(() => {});
    res.json(full);
  } catch (err) {
    console.error('Admin comment error:', err);
    res.status(500).json({ error: 'Failed to update admin comment' });
  }
}

// PATCH /appraisals/:id/md — only admin role, after admin review
async function updateMd(req, res) {
  try {
    const appraisal = await service.getAppraisalById(req.params.id);
    if (!appraisal) return res.status(404).json({ error: 'Appraisal not found' });

    const role = await getUserRole(req.user.userId, appraisal.orgId);
    // The MD's own section. An admin may stand in only where the org has
    // nobody holding the MD role, so a Tech admin can't overwrite a real MD.
    let allowed = role === 'md';
    if (!allowed && role === 'admin') {
      const mdCount = await prisma.orgMember.count({
        where: { orgId: appraisal.orgId, role: 'md' },
      });
      allowed = mdCount === 0;
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Only the MD can add MD comments' });
    }
    if (appraisal.status !== 'admin_reviewed') {
      return res.status(400).json({ error: 'Admin review must be completed first' });
    }

    const updated = await service.updateMdComment(req.params.id, req.body.mdComment, req.body.mdScore);
    notifyAppraisalCompleted(updated).catch(() => {});
    auditAppraisalStatusChanged(updated, 'admin_reviewed', 'completed', req.user.userId).catch(() => {});
    res.json(updated);
  } catch (err) {
    console.error('MD comment error:', err);
    res.status(500).json({ error: 'Failed to update MD comment' });
  }
}

// DELETE /appraisals/:id — only admin
async function remove(req, res) {
  try {
    const appraisal = await service.getAppraisalById(req.params.id);
    if (!appraisal) return res.status(404).json({ error: 'Appraisal not found' });

    const role = await getUserRole(req.user.userId, appraisal.orgId);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can delete appraisals' });
    }

    auditAppraisalDeleted(appraisal, req.user.userId).catch(() => {});
    await service.deleteAppraisal(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete appraisal error:', err);
    res.status(500).json({ error: 'Failed to delete appraisal' });
  }
}

module.exports = { getFormStructure, create, getAll, getOne, getMine, updateEmployee, submit, updateUnitHead, updateAdmin, updateMd, remove };
