const prisma = require('../../config/db');

async function getOrgSummary(orgId) {
  const [kpis, appraisals] = await Promise.all([
    prisma.kPI.findMany({ where: { orgId } }),
    prisma.appraisal.findMany({ where: { orgId }, include: { employee: { select: { name: true } } } }),
  ]);

  // ── KPI Analytics ──────────────────────────────────────────
  const kpiTotal = kpis.length;
  const kpiWithValue = kpis.filter((k) => k.value != null).length;
  const kpiOnTarget = kpis.filter((k) => k.value != null && k.target != null && k.value >= k.target).length;

  // Average achievement across KPIs that have both value and target
  const kpiWithBoth = kpis.filter((k) => k.value != null && k.target != null && k.target > 0);
  const avgAchievement = kpiWithBoth.length > 0
    ? Math.round((kpiWithBoth.reduce((sum, k) => sum + (k.value / k.target) * 100, 0) / kpiWithBoth.length) * 10) / 10
    : 0;

  // By category
  const categoryMap = {};
  for (const kpi of kpis) {
    const cat = kpi.category || 'Uncategorized';
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, achievements: [] };
    categoryMap[cat].count++;
    if (kpi.value != null && kpi.target != null && kpi.target > 0) {
      categoryMap[cat].achievements.push((kpi.value / kpi.target) * 100);
    }
  }
  const byCategory = Object.entries(categoryMap).map(([category, data]) => ({
    category,
    count: data.count,
    avgAchievement: data.achievements.length > 0
      ? Math.round((data.achievements.reduce((a, b) => a + b, 0) / data.achievements.length) * 10) / 10
      : 0,
  }));

  // ── Appraisal Analytics ────────────────────────────────────
  const appraisalTotal = appraisals.length;

  // By status
  const byStatus = { draft: 0, submitted: 0, unit_reviewed: 0, admin_reviewed: 0, completed: 0 };
  for (const a of appraisals) {
    if (byStatus.hasOwnProperty(a.status)) byStatus[a.status]++;
  }

  // By grade (only completed appraisals with a grade)
  const byGrade = { A: 0, B: 0, C: 0, D: 0 };
  const completedWithGrade = appraisals.filter((a) => a.grade && a.grade !== '');
  for (const a of completedWithGrade) {
    if (byGrade.hasOwnProperty(a.grade)) byGrade[a.grade]++;
  }

  // Average final score (only completed appraisals)
  const completedWithScore = appraisals.filter((a) => a.status === 'completed' && a.finalScore > 0);
  const avgScore = completedWithScore.length > 0
    ? Math.round((completedWithScore.reduce((sum, a) => sum + a.finalScore, 0) / completedWithScore.length) * 10) / 10
    : 0;

  // By department
  const deptMap = {};
  for (const a of appraisals) {
    const dept = a.department || 'general';
    if (!deptMap[dept]) deptMap[dept] = { count: 0, scores: [] };
    deptMap[dept].count++;
    if (a.finalScore > 0) {
      deptMap[dept].scores.push(a.finalScore);
    }
  }
  const byDepartment = Object.entries(deptMap).map(([department, data]) => ({
    department: department.charAt(0).toUpperCase() + department.slice(1),
    count: data.count,
    avgScore: data.scores.length > 0
      ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
      : 0,
  }));

  return {
    kpi: {
      total: kpiTotal,
      withValue: kpiWithValue,
      onTarget: kpiOnTarget,
      avgAchievement,
      byCategory,
    },
    appraisals: {
      total: appraisalTotal,
      byStatus,
      byGrade,
      avgScore,
      byDepartment,
    },
  };
}

// ── Team summary (unit head dashboard) ───────────────────────
// Scope: the requester's department (whole org if they have none).
async function getTeamSummary(orgId, userId) {
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
    include: { department: true },
  });
  if (!requester) throw new Error('Not a member');
  if (!['lead', 'admin'].includes(requester.role)) throw new Error('Forbidden');

  const memberWhere = requester.departmentId
    ? { orgId, departmentId: requester.departmentId }
    : { orgId };
  const team = await prisma.orgMember.findMany({
    where: memberWhere,
    include: {
      user: { select: { id: true, name: true, email: true } },
      department: { select: { name: true } },
    },
  });
  const teamUserIds = team.map((m) => m.userId);

  const [appraisals, workItems] = await Promise.all([
    prisma.appraisal.findMany({
      where: { orgId, employeeId: { in: teamUserIds } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, employeeId: true, status: true, grade: true, finalScore: true, updatedAt: true },
    }),
    prisma.memberWorkItems.findMany({
      where: { orgId, userId: { in: teamUserIds } },
      orderBy: { syncedAt: 'desc' },
    }),
  ]);

  const latestAppraisal = {};
  for (const a of appraisals) if (!latestAppraisal[a.employeeId]) latestAppraisal[a.employeeId] = a;
  const latestWork = {};
  for (const w of workItems) if (!latestWork[w.userId]) latestWork[w.userId] = w;

  const members = team.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    department: m.department?.name || null,
    appraisal: latestAppraisal[m.userId] || null,
    workItems: latestWork[m.userId]
      ? {
          total: latestWork[m.userId].totalItems,
          completed: latestWork[m.userId].completedItems,
          active: latestWork[m.userId].activeItems,
          storyPoints: latestWork[m.userId].totalStoryPoints || 0,
          syncedAt: latestWork[m.userId].syncedAt,
        }
      : null,
  }));

  const pendingReviews = members
    .filter((m) => m.appraisal && m.appraisal.status === 'submitted')
    .map((m) => ({ id: m.appraisal.id, employeeName: m.name, updatedAt: m.appraisal.updatedAt }));

  return {
    department: requester.department?.name || 'All departments',
    teamSize: members.length,
    pendingReviews,
    members,
  };
}

// ── Staff performance (executive dashboard) ──────────────────
async function getStaffPerformance(orgId, userId) {
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!requester) throw new Error('Not a member');
  if (!['admin', 'md', 'chairman'].includes(requester.role)) throw new Error('Forbidden');

  const team = await prisma.orgMember.findMany({
    where: { orgId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      department: { select: { name: true } },
    },
  });
  const userIds = team.map((m) => m.userId);

  const [appraisals, workItems] = await Promise.all([
    prisma.appraisal.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, employeeId: true, status: true, grade: true, finalScore: true, updatedAt: true },
    }),
    prisma.memberWorkItems.findMany({
      where: { orgId, userId: { in: userIds } },
      orderBy: { syncedAt: 'desc' },
    }),
  ]);

  const latestAppraisal = {};
  for (const a of appraisals) if (!latestAppraisal[a.employeeId]) latestAppraisal[a.employeeId] = a;
  const latestWork = {};
  for (const w of workItems) if (!latestWork[w.userId]) latestWork[w.userId] = w;

  const members = team.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    department: m.department?.name || null,
    appraisal: latestAppraisal[m.userId] || null,
    workItems: latestWork[m.userId]
      ? {
          completed: latestWork[m.userId].completedItems,
          active: latestWork[m.userId].activeItems,
          storyPoints: latestWork[m.userId].totalStoryPoints || 0,
        }
      : null,
  }));

  const awaitingMd = appraisals.filter((a) => a.status === 'admin_reviewed').length;

  return { staffCount: members.length, awaitingMd, members };
}

// ── Admin summary (admin dashboard) ──────────────────────────
// Scope: whole org. Answers an administrator's questions — what needs my
// action, who is missing setup, and are the integrations still healthy.
const STALE_KPI_DAYS = 30;

async function getAdminSummary(orgId, userId) {
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!requester) throw new Error('Not a member');
  if (requester.role !== 'admin') throw new Error('Forbidden');

  const [org, members, appraisals, kpis, integrations, workItems, auditLogs] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.orgMember.findMany({
      where: { orgId },
      include: {
        user: { select: { id: true, name: true, email: true, integrationEmail: true } },
        department: { select: { name: true } },
      },
    }),
    prisma.appraisal.findMany({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, employeeId: true, status: true, department: true, updatedAt: true,
        employee: { select: { name: true } },
      },
    }),
    prisma.kPI.findMany({
      where: { orgId },
      select: { id: true, name: true, category: true, target: true, value: true, updatedAt: true },
    }),
    prisma.integration.findMany({
      where: { orgId },
      select: { id: true, tool: true, status: true, lastSyncedAt: true },
    }),
    prisma.memberWorkItems.findMany({
      where: { orgId },
      select: { userId: true },
    }),
    prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { user: { select: { name: true } } },
    }),
  ]);

  // ── Staff roster health ──
  const byRole = { admin: 0, lead: 0, member: 0, md: 0, chairman: 0 };
  for (const m of members) if (byRole.hasOwnProperty(m.role)) byRole[m.role]++;

  const employeesWithAppraisal = new Set(appraisals.map((a) => a.employeeId));

  // ── Appraisal pipeline ──
  const byStatus = { draft: 0, submitted: 0, unit_reviewed: 0, admin_reviewed: 0, completed: 0 };
  for (const a of appraisals) if (byStatus.hasOwnProperty(a.status)) byStatus[a.status]++;

  // unit_reviewed is the admin's own queue — the admin comment comes next
  const awaitingAdminReview = appraisals
    .filter((a) => a.status === 'unit_reviewed')
    .map((a) => ({
      id: a.id,
      employeeName: a.employee?.name || 'Unknown',
      department: a.department,
      updatedAt: a.updatedAt,
    }));

  // ── KPI coverage ──
  const staleBefore = new Date(Date.now() - STALE_KPI_DAYS * 24 * 60 * 60 * 1000);
  const staleKpis = kpis
    .filter((k) => k.value != null && k.updatedAt < staleBefore)
    .map((k) => ({ id: k.id, name: k.name, category: k.category, updatedAt: k.updatedAt }));

  // ── Integration / sync health ──
  const lastLogs = await Promise.all(
    integrations.map((i) =>
      prisma.syncLog.findFirst({
        where: { integrationId: i.id },
        orderBy: { createdAt: 'desc' },
        select: { status: true, rowsUpdated: true, errorMessage: true, createdAt: true },
      })
    )
  );
  const integrationHealth = integrations.map((i, idx) => ({
    id: i.id,
    tool: i.tool,
    status: i.status,
    lastSyncedAt: i.lastSyncedAt,
    lastSync: lastLogs[idx] || null,
  }));

  // Staff the sync has never matched to a work-item record
  const syncedUserIds = new Set(workItems.map((w) => w.userId));
  const unsyncedStaff = integrations.length > 0
    ? members
        .filter((m) => !syncedUserIds.has(m.userId))
        .map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.integrationEmail || m.user.email,
          hasIntegrationEmail: !!m.user.integrationEmail,
        }))
    : [];

  return {
    orgName: org?.name || '',
    staff: {
      total: members.length,
      byRole,
      noDepartment: members
        .filter((m) => !m.departmentId)
        .map((m) => ({ userId: m.userId, name: m.user.name })),
      noAppraisal: members
        .filter((m) => !employeesWithAppraisal.has(m.userId))
        .map((m) => ({ userId: m.userId, name: m.user.name, role: m.role })),
    },
    appraisals: {
      total: appraisals.length,
      byStatus,
      awaitingAdminReview,
    },
    kpis: {
      total: kpis.length,
      missingTarget: kpis.filter((k) => k.target == null).length,
      missingValue: kpis.filter((k) => k.value == null).length,
      stale: staleKpis,
      staleAfterDays: STALE_KPI_DAYS,
    },
    integrations: integrationHealth,
    unsyncedStaff,
    recentActivity: auditLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      description: l.description,
      userName: l.user?.name || 'System',
      createdAt: l.createdAt,
    })),
  };
}

// ── One employee's record (chairman/MD/admin drill-down) ─────
// The executive dashboard shows a row per person; this is what sits
// behind that row — every appraisal they have had, not just the latest,
// plus their grade history, level trail and synced task counts.
async function getEmployeePerformance(orgId, targetUserId, requesterId) {
  const requester = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: requesterId, orgId } },
    select: { role: true, departmentId: true },
  });
  if (!requester) throw new Error('Not a member');

  const target = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: targetUserId, orgId } },
    include: {
      user: { select: { id: true, name: true, email: true, integrationEmail: true } },
      department: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!target) throw new Error('Employee not found');

  // Executives see anyone; a unit head sees their own department; everyone
  // else only themselves.
  const isExecutive = ['admin', 'md', 'chairman'].includes(requester.role);
  const isTheirLead = requester.role === 'lead'
    && requester.departmentId
    && requester.departmentId === target.departmentId;
  if (!isExecutive && !isTheirLead && targetUserId !== requesterId) {
    throw new Error('Forbidden');
  }

  const [appraisals, workItems, levelChanges] = await Promise.all([
    prisma.appraisal.findMany({
      where: { orgId, employeeId: targetUserId },
      orderBy: { reviewPeriodTo: 'desc' },
      select: {
        id: true, status: true, grade: true, finalScore: true, mdScore: true,
        department: true, reviewPeriodFrom: true, reviewPeriodTo: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.memberWorkItems.findMany({
      where: { orgId, userId: targetUserId },
      orderBy: { periodTo: 'desc' },
      take: 6,
      select: {
        totalItems: true, completedItems: true, activeItems: true,
        totalStoryPoints: true, periodFrom: true, periodTo: true, syncedAt: true,
      },
    }),
    prisma.levelChange.findMany({
      where: { memberId: target.id },
      orderBy: { createdAt: 'desc' },
      include: { changedBy: { select: { name: true } } },
    }),
  ]);

  const scored = appraisals.filter((a) => a.status === 'completed' && a.finalScore > 0);
  const avgScore = scored.length > 0
    ? Math.round((scored.reduce((sum, a) => sum + a.finalScore, 0) / scored.length) * 10) / 10
    : 0;

  const byGrade = { A: 0, B: 0, C: 0, D: 0 };
  appraisals.forEach((a) => {
    if (a.grade && byGrade[a.grade] !== undefined) byGrade[a.grade] += 1;
  });

  return {
    employee: {
      userId: target.userId,
      name: target.user.name,
      email: target.user.email,
      role: target.role,
      level: target.level,
      staffType: target.staffType,
      department: target.department || null,
    },
    summary: {
      appraisalsTotal: appraisals.length,
      appraisalsCompleted: scored.length,
      avgScore,
      latestGrade: appraisals.find((a) => a.grade)?.grade || null,
      byGrade,
    },
    // Oldest first so a chart reads left to right
    appraisals: [...appraisals].reverse(),
    workItems,
    levelChanges: levelChanges.map((c) => ({
      id: c.id,
      fromLevel: c.fromLevel,
      toLevel: c.toLevel,
      note: c.note,
      changedBy: c.changedBy?.name || 'Unknown',
      createdAt: c.createdAt,
    })),
  };
}

module.exports = { getOrgSummary, getTeamSummary, getStaffPerformance, getAdminSummary, getEmployeePerformance };
