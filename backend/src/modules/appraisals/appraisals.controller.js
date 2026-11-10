const service = require('./appraisals.service');
const prisma = require('../../config/db');
const { notifyAppraisalCreated, notifyAppraisalSubmitted, notifyAppraisalReviewed, notifyAppraisalCompleted, notifyAppraisalReturned } = require('../notifications/notify');
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
// POST /appraisals/org/:orgId/cycle — raise appraisals for a whole
// department, or the whole organisation, in one go.
async function createCycle(req, res) {
  try {
    const { orgId } = req.params;
    const { departmentId, employeeIds, reviewPeriodFrom, reviewPeriodTo } = req.body;

    const role = await getUserRole(req.user.userId, orgId);
    if (role !== 'admin' && role !== 'lead') {
      return res.status(403).json({ error: 'Only admins and unit heads can raise a cycle' });
    }
    if (!reviewPeriodFrom || !reviewPeriodTo) {
      return res.status(400).json({ error: 'A review period is required' });
    }
    if (new Date(reviewPeriodFrom) > new Date(reviewPeriodTo)) {
      return res.status(400).json({ error: 'The review period ends before it starts' });
    }

    const me = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: req.user.userId, orgId } },
      select: { departmentId: true },
    });

    // A unit head raises a cycle for their own department only
    const where = { orgId };
    if (role === 'lead') {
      if (!me?.departmentId) {
        return res.status(400).json({ error: 'Set your department before raising a cycle' });
      }
      where.departmentId = me.departmentId;
    } else if (departmentId) {
      where.departmentId = departmentId;
    }

    const candidates = await prisma.orgMember.findMany({ where, select: { userId: true } });
    let targets = candidates.map((m) => m.userId);
    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      const allowed = new Set(targets);
      targets = employeeIds.filter((id) => allowed.has(id));
    }
    if (targets.length === 0) {
      return res.status(400).json({ error: 'Nobody matches that selection' });
    }

    const { created, skipped } = await service.createAppraisalCycle(orgId, {
      employeeIds: targets,
      reviewPeriodFrom,
      reviewPeriodTo,
    });

    created.forEach((a) => {
      notifyAppraisalCreated(a).catch(() => {});
      auditAppraisalCreated(a, req.user.userId).catch(() => {});
    });

    return res.status(201).json({
      createdCount: created.length,
      skippedCount: skipped.length,
      created: created.map((a) => ({ id: a.id, name: a.employee.name })),
      skipped,
    });
  } catch (err) {
    console.error('Create cycle error:', err);
    return res.status(500).json({ error: 'Failed to raise the cycle' });
  }
}

// POST /appraisals/:id/return — hand it back a stage with a reason
async function returnAppraisal(req, res) {
  try {
    const appraisal = await service.getAppraisalById(req.params.id);
    if (!appraisal) return res.status(404).json({ error: 'Appraisal not found' });

    const reason = (req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Say why you are sending it back' });

    const previous = service.PREVIOUS_STAGE[appraisal.status];
    if (!previous) {
      return res.status(400).json({
        error: appraisal.status === 'draft'
          ? 'This is already with the employee'
          : 'A completed appraisal cannot be sent back',
      });
    }

    // Only whoever the appraisal is currently sitting with may return it
    const role = await getUserRole(req.user.userId, appraisal.orgId);
    let allowed = false;
    if (appraisal.status === 'submitted') {
      allowed = role === 'lead' || role === 'admin';
      if (role === 'lead') {
        const [me, them] = await Promise.all([
          prisma.orgMember.findUnique({ where: { userId_orgId: { userId: req.user.userId, orgId: appraisal.orgId } }, select: { departmentId: true } }),
          prisma.orgMember.findUnique({ where: { userId_orgId: { userId: appraisal.employeeId, orgId: appraisal.orgId } }, select: { departmentId: true } }),
        ]);
        if (me?.departmentId && me.departmentId !== them?.departmentId) allowed = false;
      }
    } else if (appraisal.status === 'unit_reviewed') {
      allowed = await isHrOfficer(req.user.userId, appraisal.orgId);
    } else if (appraisal.status === 'admin_reviewed') {
      allowed = role === 'md';
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Only the person this appraisal is with can send it back' });
    }

    const updated = await service.returnAppraisal(req.params.id, reason);
    notifyAppraisalReturned(updated, previous, reason).catch(() => {});
    auditAppraisalStatusChanged(updated, appraisal.status, previous, req.user.userId).catch(() => {});
    return res.json(updated);
  } catch (err) {
    console.error('Return appraisal error:', err);
    return res.status(500).json({ error: 'Failed to send the appraisal back' });
  }
}

async function getAll(req, res) {
  try {
    const role = await getUserRole(req.user.userId, req.params.orgId);
    if (!role) return res.status(403).json({ error: 'Not a member of this org' });

    if (role === 'member') {
      // This branch returned the rows untouched, so the comment still reached
      // ordinary employees here even once the other paths were closed.
      const appraisals = await service.getEmployeeAppraisals(req.params.orgId, req.user.userId);
      return res.json(service.redactUnitHeadForSelfList(appraisals, req.user.userId, role));
    }

    // A unit head reviews their own department and sees only that
    if (role === 'lead') {
      const me = await prisma.orgMember.findUnique({
        where: { userId_orgId: { userId: req.user.userId, orgId: req.params.orgId } },
        select: { departmentId: true },
      });
      if (me?.departmentId) {
        const scoped = await service.getDepartmentAppraisals(req.params.orgId, me.departmentId);
        return res.json(service.redactUnitHeadForSelfList(scoped, req.user.userId, role));
      }
    }

    const appraisals = await service.getOrgAppraisals(req.params.orgId);
    res.json(service.redactUnitHeadForSelfList(appraisals, req.user.userId, role));
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

    // The same verdict the PATCH will reach, so the page offers an editable
    // form only to whoever can actually save it, and can say who that is.
    const unitHeadRule = await getUnitHeadReviewRule(appraisal, req.user.userId);

    res.json({
      ...service.redactUnitHeadForSelf(appraisal, req.user.userId, role),
      unitHeadReview: {
        canScore: unitHeadRule.allowed,
        blockedReason: unitHeadRule.reason,
        reviewedBy: unitHeadRule.reviewedBy,     // 'md' when the employee is a unit head
        employeeIsLead: unitHeadRule.employeeIsLead,
      },
    });
  } catch (err) {
    console.error('Get appraisal error:', err);
    res.status(500).json({ error: 'Failed to get appraisal' });
  }
}

// GET /appraisals/org/:orgId/my
async function getMine(req, res) {
  try {
    const role = await getUserRole(req.user.userId, req.params.orgId);
    const appraisals = await service.getEmployeeAppraisals(req.params.orgId, req.user.userId);
    res.json(service.redactUnitHeadForSelfList(appraisals, req.user.userId, role));
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

    // The written sections were never checked, so an appraisal could go to a
    // unit head with every question blank. A department with no job-specific
    // block returns nothing here and is unaffected.
    const blankDiscussion = service.validateSelfAssessment(appraisal.selfAssessment);
    if (blankDiscussion.length > 0) {
      return res.status(400).json({
        error: `Answer every discussion point before submitting. ${blankDiscussion.length} still blank.`,
        section: 'self-assessment',
        missing: blankDiscussion,
      });
    }

    const blankJobSection = service.validateDepartmentAnswers(
      appraisal.department,
      appraisal.technicalAnswers
    );
    if (blankJobSection.length > 0) {
      const label = service.getDeptLabel(appraisal.department);
      return res.status(400).json({
        error: `Answer every question in the ${label} section before submitting. ${blankJobSection.length} still blank.`,
        section: 'department',
        missing: blankJobSection,
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

// Who may fill the unit head stage on this appraisal, and why not.
//
// These rules lived only inside the PATCH handler, so the page had its own
// idea of who could score: any lead, on anyone, including themselves. Another
// unit head was shown an editable form on a colleague lead's appraisal and
// only found out at Save, while the MD — the one person entitled to score a
// lead — was given it read-only and could not finish it at all. One function
// now answers the question, and both the page and the PATCH ask it.
// Editable by the unit head while it is theirs and while nobody downstream
// has acted: HR's review (admin_reviewed) and the MD's (completed) close it.
const UNIT_HEAD_EDITABLE_STATUSES = ['submitted', 'unit_reviewed'];

async function getUnitHeadReviewRule(appraisal, userId) {
  const [role, me, them, mdCount] = await Promise.all([
    getUserRole(userId, appraisal.orgId),
    prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId: appraisal.orgId } },
      select: { departmentId: true },
    }),
    prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: appraisal.employeeId, orgId: appraisal.orgId } },
      select: { departmentId: true, role: true },
    }),
    prisma.orgMember.count({ where: { orgId: appraisal.orgId, role: 'md' } }),
  ]);
  const orgHasMd = mdCount > 0;

  // A unit head has nobody above them inside their own department, so this
  // stage belongs to the MD. An admin stands in where there is no MD.
  const employeeIsLead = them?.role === 'lead';
  const reviewedBy = employeeIsLead ? 'md' : 'lead';

  const deny = (reason) => ({ allowed: false, reason, reviewedBy, employeeIsLead });

  if (appraisal.employeeId === userId) return deny('You cannot review your own appraisal');
  if (!role) return deny('Not a member of this organisation');

  if (employeeIsLead) {
    // The MD's stage. An admin stands in only where the org has no MD at
    // all — otherwise any admin could score a unit head in a department
    // they have nothing to do with.
    if (role !== 'md' && role !== 'admin') {
      return deny("A unit head's own appraisal is reviewed by the MD");
    }
    if (role === 'admin' && orgHasMd) {
      return deny("A unit head's own appraisal is the MD's to score, not an admin's");
    }
  } else {
    if (role !== 'lead' && role !== 'admin') {
      return deny('Only unit heads can score appraisals');
    }
    // Both leads AND admins are held to their own department here. This
    // check used to read `role === 'lead' && me?.departmentId && ...`, which
    // let two people straight past it: an admin, never checked at all, and a
    // lead with no department, whose own blank value short-circuited it. An
    // HR admin could score — and overwrite — the support unit head's review.
    if (!me?.departmentId) {
      return deny('You are not assigned to a department, so you cannot score anyone. Ask an admin to set yours.');
    }
    if (!them?.departmentId) {
      return deny('This employee is not assigned to a department, so nobody can be their unit head yet');
    }
    if (me.departmentId !== them.departmentId) {
      return deny('You can only review your own department');
    }
  }

  // A unit head can still revise their scores after saving them — up to the
  // point HR or the MD has acted on them. After that the review is part of a
  // decision someone else has already made on it, so it is locked and has to
  // be sent back instead.
  if (!UNIT_HEAD_EDITABLE_STATUSES.includes(appraisal.status)) {
    if (appraisal.status === 'draft') {
      return deny('Appraisal must be submitted before unit head review');
    }
    if (appraisal.status === 'admin_reviewed') {
      return deny('HR has already reviewed this, so the scores are locked. Ask HR to send it back if they need changing.');
    }
    if (appraisal.status === 'completed') {
      return deny('This appraisal is complete, so the scores can no longer be changed.');
    }
    return deny('This appraisal is not open for unit head review');
  }

  return { allowed: true, reason: null, reviewedBy, employeeIsLead };
}

// PATCH /appraisals/:id/unit-head
async function updateUnitHead(req, res) {
  try {
    const appraisal = await service.getAppraisalById(req.params.id);
    if (!appraisal) return res.status(404).json({ error: 'Appraisal not found' });

    const rule = await getUnitHeadReviewRule(appraisal, req.user.userId);
    if (!rule.allowed) {
      const status = rule.reason.startsWith('Appraisal must be submitted') ? 400 : 403;
      return res.status(status).json({ error: rule.reason });
    }

    const { missing, invalid } = service.validateUnitHeadScores(req.body.unitHeadScores);
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Out of range: ${invalid.join(', ')}` });
    }
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Score every attribute before saving. ${missing.length} still unscored: ${missing.join(', ')}`,
        missing,
      });
    }

    // Only the first save moves the stage on. A later revision must not email
    // HR again as though it had just arrived, nor log a submitted ->
    // unit_reviewed transition that already happened; it is an edit.
    const isFirstReview = appraisal.status === 'submitted';

    const updated = await service.updateUnitHeadReview(req.params.id, req.user.userId, req.body);
    if (isFirstReview) {
      notifyAppraisalReviewed(updated, 'unit_head').catch(() => {});
      auditAppraisalStatusChanged(updated, 'submitted', 'unit_reviewed', req.user.userId).catch(() => {});
    } else {
      auditAppraisalUpdated(updated, {
        unitHeadScores: req.body.unitHeadScores,
        unitHeadComment: req.body.unitHeadComment,
      }, req.user.userId).catch(() => {});
    }
    res.json({ ...updated, revised: !isFirstReview });
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

    if (appraisal.employeeId === req.user.userId) {
      return res.status(403).json({ error: 'You cannot review your own appraisal' });
    }
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

    if (appraisal.employeeId === req.user.userId) {
      return res.status(403).json({ error: 'You cannot review your own appraisal' });
    }

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

module.exports = { getFormStructure, create, createCycle, returnAppraisal, getAll, getOne, getMine, updateEmployee, submit, updateUnitHead, updateAdmin, updateMd, remove };
