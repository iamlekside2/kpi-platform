const prisma = require('../../config/db');
const { createNotification } = require('./notifications.service');

// Notify employee that an appraisal was created for them
async function notifyAppraisalCreated(appraisal) {
  await createNotification({
    userId: appraisal.employeeId,
    orgId: appraisal.orgId,
    type: 'appraisal_created',
    title: 'New Appraisal Assigned',
    message: 'A new performance appraisal has been created for you. Please complete your self-assessment.',
    link: `/appraisals/${appraisal.id}`,
  });
}

// Notify admins and leads that an employee submitted their appraisal
async function notifyAppraisalSubmitted(appraisal) {
  const members = await prisma.orgMember.findMany({
    where: { orgId: appraisal.orgId, role: { in: ['admin', 'lead'] } },
    select: { userId: true },
  });

  const employeeName = appraisal.employee?.name || 'An employee';

  await Promise.all(
    members
      .filter((m) => m.userId !== appraisal.employeeId) // don't notify the employee themselves
      .map((m) =>
        createNotification({
          userId: m.userId,
          orgId: appraisal.orgId,
          type: 'appraisal_submitted',
          title: 'Appraisal Submitted',
          message: `${employeeName} has submitted their self-assessment for review.`,
          link: `/appraisals/${appraisal.id}`,
        })
      )
  );
}

// Notify employee that their appraisal was reviewed
async function notifyAppraisalReviewed(appraisal, stage) {
  const stageLabel = stage === 'unit_head' ? 'Unit Head' : 'Admin';

  await createNotification({
    userId: appraisal.employeeId,
    orgId: appraisal.orgId,
    type: 'appraisal_reviewed',
    title: `Appraisal Reviewed by ${stageLabel}`,
    message: `Your performance appraisal has been reviewed by the ${stageLabel}.`,
    link: `/appraisals/${appraisal.id}`,
  });
}

// Notify employee that their appraisal is complete with grade
async function notifyAppraisalCompleted(appraisal) {
  const grade = appraisal.grade || '';
  const gradeText = grade ? ` Your grade: ${grade}.` : '';

  await createNotification({
    userId: appraisal.employeeId,
    orgId: appraisal.orgId,
    type: 'appraisal_completed',
    title: 'Appraisal Completed',
    message: `Your performance appraisal has been finalised.${gradeText}`,
    link: `/appraisals/${appraisal.id}`,
  });
}

module.exports = {
  notifyAppraisalCreated,
  notifyAppraisalSubmitted,
  notifyAppraisalReviewed,
  notifyAppraisalCompleted,
};
