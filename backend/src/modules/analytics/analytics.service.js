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

module.exports = { getOrgSummary, getTeamSummary, getStaffPerformance };
