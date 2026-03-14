const { createAuditLog } = require('./auditLogs.service');

// ── Appraisal Audit Triggers ──

async function auditAppraisalCreated(appraisal, userId) {
  const employeeName = appraisal.employee?.name || appraisal.employee?.email || appraisal.employeeId;
  await createAuditLog({
    userId,
    orgId: appraisal.orgId,
    action: 'create',
    entityType: 'Appraisal',
    entityId: appraisal.id,
    description: `Created appraisal for ${employeeName}`,
    newValues: { department: appraisal.department, employeeId: appraisal.employeeId, status: 'draft' },
  });
}

async function auditAppraisalUpdated(appraisal, changes, userId) {
  const employeeName = appraisal.employee?.name || appraisal.employee?.email || appraisal.employeeId;
  await createAuditLog({
    userId,
    orgId: appraisal.orgId,
    action: 'update',
    entityType: 'Appraisal',
    entityId: appraisal.id,
    description: `Updated employee section for ${employeeName}`,
    newValues: changes,
  });
}

async function auditAppraisalStatusChanged(appraisal, oldStatus, newStatus, userId) {
  const employeeName = appraisal.employee?.name || appraisal.employee?.email || appraisal.employeeId;
  const labels = {
    draft: 'Draft',
    submitted: 'Submitted',
    unit_reviewed: 'Unit Reviewed',
    admin_reviewed: 'Admin Reviewed',
    completed: 'Completed',
  };
  await createAuditLog({
    userId,
    orgId: appraisal.orgId,
    action: 'status_change',
    entityType: 'Appraisal',
    entityId: appraisal.id,
    description: `Appraisal for ${employeeName}: ${labels[oldStatus] || oldStatus} → ${labels[newStatus] || newStatus}`,
    oldValues: { status: oldStatus },
    newValues: { status: newStatus, grade: appraisal.grade || undefined, finalScore: appraisal.finalScore || undefined },
  });
}

async function auditAppraisalDeleted(appraisal, userId) {
  const employeeName = appraisal.employee?.name || appraisal.employee?.email || appraisal.employeeId;
  await createAuditLog({
    userId,
    orgId: appraisal.orgId,
    action: 'delete',
    entityType: 'Appraisal',
    entityId: appraisal.id,
    description: `Deleted appraisal for ${employeeName}`,
    oldValues: { department: appraisal.department, status: appraisal.status, employeeId: appraisal.employeeId },
  });
}

// ── KPI Audit Triggers ──

async function auditKpiCreated(kpi, userId) {
  await createAuditLog({
    userId,
    orgId: kpi.orgId,
    action: 'create',
    entityType: 'KPI',
    entityId: kpi.id,
    description: `Created KPI "${kpi.name}"`,
    newValues: { name: kpi.name, unit: kpi.unit, target: kpi.target, category: kpi.category },
  });
}

async function auditKpiUpdated(kpi, oldValues, userId) {
  await createAuditLog({
    userId,
    orgId: kpi.orgId,
    action: 'update',
    entityType: 'KPI',
    entityId: kpi.id,
    description: `Updated KPI "${kpi.name}"`,
    oldValues,
    newValues: { value: kpi.value, target: kpi.target },
  });
}

async function auditKpiDeleted(kpi, userId) {
  await createAuditLog({
    userId,
    orgId: kpi.orgId,
    action: 'delete',
    entityType: 'KPI',
    entityId: kpi.id,
    description: `Deleted KPI "${kpi.name}"`,
    oldValues: { name: kpi.name, value: kpi.value, target: kpi.target, category: kpi.category },
  });
}

// ── Org Member Audit Triggers ──

async function auditMemberInvited(member, userId) {
  const name = member.user?.name || member.user?.email || member.userId;
  await createAuditLog({
    userId,
    orgId: member.orgId,
    action: 'create',
    entityType: 'OrgMember',
    entityId: member.id,
    description: `Invited ${name} as ${member.role}`,
    newValues: { role: member.role, email: member.user?.email },
  });
}

async function auditMemberRoleChanged(member, oldRole, userId) {
  const name = member.user?.name || member.user?.email || member.userId;
  await createAuditLog({
    userId,
    orgId: member.orgId,
    action: 'update',
    entityType: 'OrgMember',
    entityId: member.id,
    description: `Changed ${name}'s role from ${oldRole} to ${member.role}`,
    oldValues: { role: oldRole },
    newValues: { role: member.role },
  });
}

async function auditMemberDepartmentChanged(member, oldDeptId, userId) {
  const name = member.user?.name || member.user?.email || member.userId;
  const deptName = member.department?.name || member.departmentId || 'None';
  await createAuditLog({
    userId,
    orgId: member.orgId,
    action: 'update',
    entityType: 'OrgMember',
    entityId: member.id,
    description: `Changed ${name}'s department to ${deptName}`,
    oldValues: { departmentId: oldDeptId },
    newValues: { departmentId: member.departmentId },
  });
}

async function auditMemberRemoved(member, userId) {
  const name = member.user?.name || member.user?.email || member.userId;
  await createAuditLog({
    userId,
    orgId: member.orgId,
    action: 'delete',
    entityType: 'OrgMember',
    entityId: member.id,
    description: `Removed ${name} from organisation`,
    oldValues: { role: member.role, email: member.user?.email },
  });
}

module.exports = {
  auditAppraisalCreated,
  auditAppraisalUpdated,
  auditAppraisalStatusChanged,
  auditAppraisalDeleted,
  auditKpiCreated,
  auditKpiUpdated,
  auditKpiDeleted,
  auditMemberInvited,
  auditMemberRoleChanged,
  auditMemberDepartmentChanged,
  auditMemberRemoved,
};
