const prisma = require('../../config/db');
const { createNotification } = require('./notifications.service');
const { sendAppraisalEmail } = require('../../utils/mailer');

// Every appraisal event goes out on two channels: the in-app bell and an
// email. Email is fire-and-forget — a mail provider outage must never roll
// back the appraisal action that triggered it.
async function deliver({ user, orgId, type, title, message, appraisalId, email }) {
  await createNotification({
    userId: user.id,
    orgId,
    type,
    title,
    message,
    link: `/appraisals/${appraisalId}`,
  });

  if (user.email && email) {
    sendAppraisalEmail({
      email: user.email,
      name: user.name,
      appraisalId,
      ...email,
    }).catch(() => {});
  }
}

function getUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
}

// The unit head for an appraisal is the lead in the employee's own
// department; orgs that haven't split into departments fall back to every lead.
async function getUnitHeads(orgId, employeeId) {
  const employee = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId: employeeId, orgId } },
    select: { departmentId: true },
  });

  const scoped = employee?.departmentId
    ? await prisma.orgMember.findMany({
        where: { orgId, role: 'lead', departmentId: employee.departmentId },
        include: { user: { select: { id: true, name: true, email: true } } },
      })
    : [];

  if (scoped.length > 0) return scoped.map((m) => m.user);

  const allLeads = await prisma.orgMember.findMany({
    where: { orgId, role: 'lead' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return allLeads.map((m) => m.user);
}

async function getAdmins(orgId) {
  const admins = await prisma.orgMember.findMany({
    where: { orgId, role: 'admin' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return admins.map((m) => m.user);
}

async function getByRole(orgId, role) {
  const members = await prisma.orgMember.findMany({
    where: { orgId, role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return members.map((m) => m.user);
}

// ── Appraisal created → tell the employee to fill it in ──
async function notifyAppraisalCreated(appraisal) {
  const employee = appraisal.employee?.email
    ? appraisal.employee
    : await getUser(appraisal.employeeId);
  if (!employee) return;

  await deliver({
    user: employee,
    orgId: appraisal.orgId,
    type: 'appraisal_created',
    title: 'New Appraisal Assigned',
    message: 'A new performance appraisal has been created for you. Please complete your self-assessment.',
    appraisalId: appraisal.id,
    email: {
      subject: 'Your performance appraisal is ready — KPI Platform',
      heading: 'Appraisal Assigned',
      body: 'A new performance appraisal has been created for you. Please complete your self-assessment and submit it for review.',
      ctaLabel: 'Complete Self-Assessment',
      footnote: 'Your unit head will review it once you submit.',
    },
  });
}

// ── Employee submitted → confirm to them, alert the unit head and admins ──
async function notifyAppraisalSubmitted(appraisal) {
  const employee = appraisal.employee?.email
    ? appraisal.employee
    : await getUser(appraisal.employeeId);
  const employeeName = employee?.name || 'An employee';

  const [unitHeads, admins] = await Promise.all([
    getUnitHeads(appraisal.orgId, appraisal.employeeId),
    getAdmins(appraisal.orgId),
  ]);

  // Confirmation back to the employee
  if (employee) {
    await deliver({
      user: employee,
      orgId: appraisal.orgId,
      type: 'appraisal_submitted',
      title: 'Self-Assessment Submitted',
      message: 'Your self-assessment has been submitted and sent to your unit head for review.',
      appraisalId: appraisal.id,
      email: {
        subject: 'We received your self-assessment — KPI Platform',
        heading: 'Self-Assessment Received',
        body: 'Thanks — your self-assessment has been submitted successfully and passed to your unit head for review. You will hear from us again once it has been reviewed.',
        ctaLabel: 'View Your Appraisal',
      },
    });
  }

  // Unit heads first: this is their action
  const notifiedIds = new Set([appraisal.employeeId]);
  const unitHeadsToNotify = unitHeads.filter((u) => !notifiedIds.has(u.id));
  unitHeadsToNotify.forEach((u) => notifiedIds.add(u.id));

  await Promise.all(
    unitHeadsToNotify
      .map((u) =>
        deliver({
          user: u,
          orgId: appraisal.orgId,
          type: 'appraisal_submitted',
          title: 'Appraisal Awaiting Your Review',
          message: `${employeeName} has submitted their self-assessment and it needs your review.`,
          appraisalId: appraisal.id,
          email: {
            subject: `${employeeName}'s appraisal needs your review — KPI Platform`,
            heading: 'Appraisal Needs Your Review',
            body: `<strong>${employeeName}</strong> has completed their self-assessment. As their unit head, please review it and provide your scoring and comments.`,
            ctaLabel: 'Review Appraisal',
          },
        })
      )
  );

  // Admins get a heads-up, not an action
  await Promise.all(
    admins
      .filter((u) => !notifiedIds.has(u.id))
      .map((u) =>
        deliver({
          user: u,
          orgId: appraisal.orgId,
          type: 'appraisal_submitted',
          title: 'Appraisal Submitted',
          message: `${employeeName} has submitted their self-assessment for review.`,
          appraisalId: appraisal.id,
          email: {
            subject: `${employeeName} submitted their appraisal — KPI Platform`,
            heading: 'Appraisal Submitted',
            body: `<strong>${employeeName}</strong> has submitted their self-assessment. It is now with their unit head for review.`,
            ctaLabel: 'Open Appraisal',
          },
        })
      )
  );
}

// ── Reviewed at a stage → tell the employee, and hand off to whoever is next ──
async function notifyAppraisalReviewed(appraisal, stage) {
  const stageLabel = stage === 'unit_head' ? 'Unit Head' : 'HR';
  const employee = appraisal.employee?.email
    ? appraisal.employee
    : await getUser(appraisal.employeeId);

  if (employee) {
    await deliver({
      user: employee,
      orgId: appraisal.orgId,
      type: 'appraisal_reviewed',
      title: `Appraisal Reviewed by ${stageLabel}`,
      message: `Your performance appraisal has been reviewed by the ${stageLabel}.`,
      appraisalId: appraisal.id,
      email: {
        subject: `Your appraisal was reviewed by the ${stageLabel} — KPI Platform`,
        heading: `Reviewed by ${stageLabel}`,
        body: `Your performance appraisal has been reviewed by the <strong>${stageLabel}</strong>. You can open it to see the comments and scoring recorded so far.`,
        ctaLabel: 'View Your Appraisal',
      },
    });
  }

  const employeeName = employee?.name || 'An employee';

  // Unit head is done → it is the admin's turn
  if (stage === 'unit_head') {
    const admins = await getAdmins(appraisal.orgId);
    await Promise.all(
      admins
        .filter((u) => u.id !== appraisal.employeeId)
        .map((u) =>
          deliver({
            user: u,
            orgId: appraisal.orgId,
            type: 'appraisal_reviewed',
            title: 'Appraisal Awaiting HR Comment',
            message: `${employeeName}'s appraisal has been unit-reviewed and is waiting on your HR comment.`,
            appraisalId: appraisal.id,
            email: {
              subject: `${employeeName}'s appraisal needs your HR comment — KPI Platform`,
              heading: 'Appraisal Needs Your HR Comment',
              body: `The unit head has finished reviewing <strong>${employeeName}</strong>'s appraisal. Please add the HR comment so it can go to the MD for final scoring.`,
              ctaLabel: 'Add HR Comment',
            },
          })
        )
    );
    return;
  }

  // Admin is done → it is the MD's turn
  const mds = await getByRole(appraisal.orgId, 'md');
  await Promise.all(
    mds
      .filter((u) => u.id !== appraisal.employeeId)
      .map((u) =>
        deliver({
          user: u,
          orgId: appraisal.orgId,
          type: 'appraisal_reviewed',
          title: 'Appraisal Awaiting Your Final Review',
          message: `${employeeName}'s appraisal is ready for your final comments and scoring.`,
          appraisalId: appraisal.id,
          email: {
            subject: `${employeeName}'s appraisal is ready for your final review — KPI Platform`,
            heading: 'Final Review Needed',
            body: `<strong>${employeeName}</strong>'s appraisal has cleared unit head and HR/Admin review. Please add your final comments and score to complete it.`,
            ctaLabel: 'Complete Final Review',
          },
        })
      )
  );
}

// ── Completed → tell the employee their grade ──
async function notifyAppraisalCompleted(appraisal) {
  const employee = appraisal.employee?.email
    ? appraisal.employee
    : await getUser(appraisal.employeeId);
  if (!employee) return;

  const grade = appraisal.grade || '';
  const gradeText = grade ? ` Your grade: ${grade}.` : '';
  const gradeLine = grade
    ? ` Your final grade is <strong>${grade}</strong>.`
    : '';

  await deliver({
    user: employee,
    orgId: appraisal.orgId,
    type: 'appraisal_completed',
    title: 'Appraisal Completed',
    message: `Your performance appraisal has been finalised.${gradeText}`,
    appraisalId: appraisal.id,
    email: {
      subject: 'Your appraisal has been finalised — KPI Platform',
      heading: 'Appraisal Completed',
      body: `Your performance appraisal has been finalised.${gradeLine} Open it to see the full scoring and the comments from each stage.`,
      ctaLabel: 'View Your Result',
    },
  });
}

module.exports = {
  notifyAppraisalCreated,
  notifyAppraisalSubmitted,
  notifyAppraisalReviewed,
  notifyAppraisalCompleted,
};
