const prisma = require('../../config/db');
const { generateAppraisalPDF, generateAppraisalsExcel, generateKPIsExcel } = require('./exports.service');

// Helper: get user's org role
async function getUserRole(userId, orgId) {
  const member = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  return member?.role || null;
}

// GET /exports/appraisals/:id/pdf
async function exportAppraisalPDF(req, res) {
  try {
    // First check the appraisal exists and user has access
    const appraisal = await prisma.appraisal.findUnique({
      where: { id: req.params.id },
      select: { orgId: true, employeeId: true, employee: { select: { name: true } } },
    });
    if (!appraisal) return res.status(404).json({ error: 'Appraisal not found' });

    const role = await getUserRole(req.user.userId, appraisal.orgId);
    if (!role) return res.status(403).json({ error: 'Not a member of this org' });

    // Members can only export their own
    if (role === 'member' && appraisal.employeeId !== req.user.userId) {
      return res.status(403).json({ error: 'You can only export your own appraisals' });
    }

    const { doc } = await generateAppraisalPDF(req.params.id);
    const safeName = (appraisal.employee?.name || 'employee').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `appraisal-${safeName}-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

// GET /exports/org/:orgId/appraisals/excel
async function exportAppraisalsExcel(req, res) {
  try {
    const role = await getUserRole(req.user.userId, req.params.orgId);
    if (!role || role === 'member') {
      return res.status(403).json({ error: 'Only admins and unit heads can export appraisal data' });
    }

    const workbook = await generateAppraisalsExcel(req.params.orgId);
    const filename = `appraisals-${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export appraisals Excel error:', err);
    res.status(500).json({ error: 'Failed to generate Excel file' });
  }
}

// GET /exports/org/:orgId/kpis/excel
async function exportKPIsExcel(req, res) {
  try {
    const role = await getUserRole(req.user.userId, req.params.orgId);
    if (!role || role === 'member') {
      return res.status(403).json({ error: 'Only admins and unit heads can export KPI data' });
    }

    const workbook = await generateKPIsExcel(req.params.orgId);
    const filename = `kpis-${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export KPIs Excel error:', err);
    res.status(500).json({ error: 'Failed to generate Excel file' });
  }
}

module.exports = { exportAppraisalPDF, exportAppraisalsExcel, exportKPIsExcel };
