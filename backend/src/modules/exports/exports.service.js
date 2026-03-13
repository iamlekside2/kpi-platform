const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const prisma = require('../../config/db');
const { getFormStructure } = require('../appraisals/appraisals.service');

// ══════════════════════════════════════════════════════════════
// PDF — Single Appraisal Report
// ══════════════════════════════════════════════════════════════

async function generateAppraisalPDF(appraisalId) {
  const appraisal = await prisma.appraisal.findUnique({
    where: { id: appraisalId },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
      org: { select: { name: true } },
    },
  });

  if (!appraisal) throw new Error('Appraisal not found');

  const form = getFormStructure(appraisal.department);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const ACCENT = '#6366f1';
  const DARK = '#1e293b';
  const MEDIUM = '#64748b';
  const LIGHT = '#94a3b8';

  // ── Helper functions ──
  function sectionTitle(text) {
    doc.moveDown(0.8);
    doc.fontSize(13).fillColor(ACCENT).font('Helvetica-Bold').text(text);
    doc.moveDown(0.2);
    doc.moveTo(doc.x, doc.y).lineTo(doc.x + 495, doc.y).lineWidth(0.5).strokeColor(ACCENT).stroke();
    doc.moveDown(0.4);
  }

  function labelValue(label, value, inline = false) {
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica-Bold').text(label, { continued: inline });
    if (inline) {
      doc.font('Helvetica').fillColor(DARK).text(`  ${value || '—'}`);
    } else {
      doc.fontSize(9).fillColor(DARK).font('Helvetica').text(value || '—');
      doc.moveDown(0.3);
    }
  }

  function scoreRow(label, score, maxScore, index) {
    const y = doc.y;
    const rowBg = index % 2 === 0 ? '#f8fafc' : '#ffffff';
    doc.rect(50, y - 2, 495, 18).fill(rowBg);
    doc.fontSize(9).fillColor(DARK).font('Helvetica').text(label, 55, y, { width: 380 });
    doc.fontSize(9).fillColor(ACCENT).font('Helvetica-Bold').text(`${score ?? '—'} / ${maxScore}`, 440, y, { width: 100, align: 'right' });
    doc.y = y + 18;
  }

  // ── HEADER ──
  doc.rect(0, 0, 612, 100).fill('#f1f5f9');
  doc.fontSize(18).fillColor(ACCENT).font('Helvetica-Bold').text('Performance Appraisal Report', 50, 30);
  doc.fontSize(10).fillColor(MEDIUM).font('Helvetica').text(appraisal.org?.name || 'Organisation', 50, 55);
  doc.moveDown(0.2);

  // Status badge
  const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', unit_reviewed: 'Unit Reviewed', admin_reviewed: 'Admin Reviewed', completed: 'Completed' };
  doc.fontSize(9).fillColor(LIGHT).font('Helvetica-Bold').text(`Status: ${STATUS_LABELS[appraisal.status] || appraisal.status}`, 50, 72);

  // ── Employee Info ──
  doc.y = 110;
  doc.x = 50;

  doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text('Employee Information', 50);
  doc.moveDown(0.3);

  const infoY = doc.y;
  doc.fontSize(9).fillColor(MEDIUM).font('Helvetica').text('Name:', 50, infoY);
  doc.fillColor(DARK).font('Helvetica-Bold').text(appraisal.employee?.name || '—', 130, infoY);

  doc.fontSize(9).fillColor(MEDIUM).font('Helvetica').text('Email:', 50, infoY + 16);
  doc.fillColor(DARK).font('Helvetica').text(appraisal.employee?.email || '—', 130, infoY + 16);

  doc.fontSize(9).fillColor(MEDIUM).font('Helvetica').text('Department:', 300, infoY);
  const DEPT_LABELS = { tech: 'Tech / Product Development', sales: 'Sales & Marketing', general: 'General / Other' };
  doc.fillColor(DARK).font('Helvetica').text(DEPT_LABELS[appraisal.department] || appraisal.department, 380, infoY);

  doc.fontSize(9).fillColor(MEDIUM).font('Helvetica').text('Review Period:', 300, infoY + 16);
  const fromDate = new Date(appraisal.reviewPeriodFrom).toLocaleDateString('en-GB');
  const toDate = new Date(appraisal.reviewPeriodTo).toLocaleDateString('en-GB');
  doc.fillColor(DARK).font('Helvetica').text(`${fromDate} — ${toDate}`, 380, infoY + 16);

  if (appraisal.reviewer) {
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica').text('Reviewer:', 300, infoY + 32);
    doc.fillColor(DARK).font('Helvetica').text(appraisal.reviewer.name || '—', 380, infoY + 32);
  }

  doc.y = infoY + 52;

  // ── SECTION A1 — Self Assessment ──
  sectionTitle('Section A1 — Self Assessment Discussion Points');

  const sa = appraisal.selfAssessment || {};
  form.selfAssessmentQuestions.forEach((q, i) => {
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica-Bold').text(`${i + 1}. ${q.label}`);
    doc.moveDown(0.1);
    doc.fontSize(9).fillColor(DARK).font('Helvetica').text(sa[q.key] || '(No response)', { indent: 10 });
    doc.moveDown(0.4);

    // Page break check
    if (doc.y > 720) doc.addPage();
  });

  // ── SECTION A2 — Self Ratings ──
  if (doc.y > 550) doc.addPage();
  sectionTitle('Section A2 — Self Rating (Max 10 per attribute)');

  const sr = appraisal.selfRatings || {};
  form.selfRatingAttributes.forEach((attr, i) => {
    if (doc.y > 740) doc.addPage();
    scoreRow(attr.label, sr[attr.key], attr.maxScore, i);
  });

  // Self rating total
  const selfTotal = Object.values(sr).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const selfMax = form.selfRatingAttributes.reduce((s, a) => s + a.maxScore, 0);
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor(ACCENT).font('Helvetica-Bold').text(`Total Self Rating: ${selfTotal} / ${selfMax}`, { align: 'right' });

  // ── DEPARTMENT-SPECIFIC SECTION ──
  if (form.departmentQuestions.length > 0) {
    doc.addPage();
    sectionTitle(`Department Section — ${form.departmentLabel}`);

    const ta = appraisal.technicalAnswers || {};
    form.departmentQuestions.forEach((q, i) => {
      doc.fontSize(9).fillColor(MEDIUM).font('Helvetica-Bold').text(`${i + 1}. ${q.label}`);
      doc.moveDown(0.1);
      doc.fontSize(9).fillColor(DARK).font('Helvetica').text(ta[q.key] || '(No response)', { indent: 10 });
      doc.moveDown(0.4);

      if (doc.y > 720) doc.addPage();
    });
  }

  // ── SECTION 2 — Unit Head Review ──
  if (doc.y > 500) doc.addPage();
  sectionTitle('Section 2 — Unit Head Review (Max 8 per attribute)');

  const uh = appraisal.unitHeadScores || {};
  form.unitHeadAttributes.forEach((attr, i) => {
    if (doc.y > 740) doc.addPage();
    scoreRow(attr.label, uh[attr.key], attr.maxScore, i);
  });

  const uhTotal = Object.values(uh).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const uhMax = form.unitHeadAttributes.reduce((s, a) => s + a.maxScore, 0);
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor(ACCENT).font('Helvetica-Bold').text(`Total Unit Head Score: ${uhTotal} / ${uhMax}`, { align: 'right' });

  // Unit Head Comment
  if (appraisal.unitHeadComment) {
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica-Bold').text('Unit Head Comment:');
    doc.fontSize(9).fillColor(DARK).font('Helvetica').text(appraisal.unitHeadComment, { indent: 10 });
  }

  // Admin Comment
  if (appraisal.adminComment) {
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica-Bold').text('Head of Administration Comment:');
    doc.fontSize(9).fillColor(DARK).font('Helvetica').text(appraisal.adminComment, { indent: 10 });
  }

  // ── SECTION 3 — MD Review ──
  if (doc.y > 550) doc.addPage();
  sectionTitle('Section 3 — Managing Director Review');

  if (appraisal.mdComment) {
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica-Bold').text('MD Comment:');
    doc.fontSize(9).fillColor(DARK).font('Helvetica').text(appraisal.mdComment, { indent: 10 });
    doc.moveDown(0.5);
  }

  doc.fontSize(9).fillColor(MEDIUM).font('Helvetica-Bold').text(`MD Performance Score: `, { continued: true });
  doc.fillColor(ACCENT).text(`${appraisal.mdScore || 0} / 100`);

  // ── FINAL RESULT ──
  if (appraisal.status === 'completed' && appraisal.finalScore > 0) {
    doc.moveDown(1);
    if (doc.y > 600) doc.addPage();

    sectionTitle('Final Appraisal Result');

    // Score breakdown
    const selfPercent = selfMax > 0 ? ((selfTotal / selfMax) * 100).toFixed(1) : '0.0';
    const uhPercent = uhMax > 0 ? ((uhTotal / uhMax) * 100).toFixed(1) : '0.0';

    doc.fontSize(9).fillColor(DARK).font('Helvetica')
      .text(`Self Rating (30% weight):   ${selfTotal} / ${selfMax}  =  ${selfPercent}%`)
      .text(`Unit Head (50% weight):     ${uhTotal} / ${uhMax}  =  ${uhPercent}%`)
      .text(`MD Score (20% weight):      ${appraisal.mdScore || 0} / 100  =  ${appraisal.mdScore || 0}%`);

    doc.moveDown(0.5);

    // Grade box
    const GRADE_COLORS = { A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' };
    const GRADE_LABELS = { A: 'Outstanding Performance', B: 'Good Performance', C: 'Satisfactory Performance', D: 'Below Standard' };
    const gradeColor = GRADE_COLORS[appraisal.grade] || MEDIUM;

    doc.rect(50, doc.y, 495, 50).lineWidth(2).strokeColor(gradeColor).stroke();
    const boxY = doc.y + 10;
    doc.fontSize(16).fillColor(gradeColor).font('Helvetica-Bold').text(`Grade ${appraisal.grade}`, 70, boxY);
    doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold').text(`${appraisal.finalScore}%`, 200, boxY + 2);
    doc.fontSize(9).fillColor(MEDIUM).font('Helvetica').text(GRADE_LABELS[appraisal.grade] || '', 260, boxY + 4);
    doc.y = boxY + 45;

    // Grade scale
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor(LIGHT).font('Helvetica')
      .text('Grade Scale:  A = 96-100% (Outstanding)  |  B = 81-95% (Good)  |  C = 65-80% (Satisfactory)  |  D = 0-64% (Below Standard)');
  }

  // ── Footer ──
  doc.moveDown(1.5);
  doc.fontSize(7).fillColor(LIGHT).font('Helvetica')
    .text(`Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}  |  KPI Platform`, { align: 'center' });

  doc.end();
  return { doc, appraisal };
}

// ══════════════════════════════════════════════════════════════
// Excel — Appraisals List
// ══════════════════════════════════════════════════════════════

async function generateAppraisalsExcel(orgId) {
  const appraisals = await prisma.appraisal.findMany({
    where: { orgId },
    include: {
      employee: { select: { name: true, email: true } },
      reviewer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const form = getFormStructure('tech'); // just for attribute lists

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'KPI Platform';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Appraisals');

  // Columns
  sheet.columns = [
    { header: 'Employee', key: 'employee', width: 22 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Department', key: 'department', width: 16 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Review From', key: 'reviewFrom', width: 14 },
    { header: 'Review To', key: 'reviewTo', width: 14 },
    { header: 'Self Rating', key: 'selfRating', width: 12 },
    { header: 'Unit Head', key: 'unitHead', width: 12 },
    { header: 'MD Score', key: 'mdScore', width: 10 },
    { header: 'Final Score', key: 'finalScore', width: 12 },
    { header: 'Grade', key: 'grade', width: 8 },
    { header: 'Reviewer', key: 'reviewer', width: 20 },
    { header: 'Created', key: 'created', width: 14 },
  ];

  // Header styling
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 24;

  const DEPT_LABELS = { tech: 'Tech', sales: 'Sales', general: 'General' };
  const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', unit_reviewed: 'Unit Reviewed', admin_reviewed: 'Admin Reviewed', completed: 'Completed' };

  const selfMax = form.selfRatingAttributes.reduce((s, a) => s + a.maxScore, 0);
  const uhMax = form.unitHeadAttributes.reduce((s, a) => s + a.maxScore, 0);

  appraisals.forEach((a) => {
    const selfTotal = Object.values(a.selfRatings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const uhTotal = Object.values(a.unitHeadScores || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);

    sheet.addRow({
      employee: a.employee?.name || '—',
      email: a.employee?.email || '—',
      department: DEPT_LABELS[a.department] || a.department,
      status: STATUS_LABELS[a.status] || a.status,
      reviewFrom: new Date(a.reviewPeriodFrom).toLocaleDateString('en-GB'),
      reviewTo: new Date(a.reviewPeriodTo).toLocaleDateString('en-GB'),
      selfRating: `${selfTotal}/${selfMax}`,
      unitHead: `${uhTotal}/${uhMax}`,
      mdScore: a.mdScore || 0,
      finalScore: a.finalScore || 0,
      grade: a.grade || '—',
      reviewer: a.reviewer?.name || '—',
      created: new Date(a.createdAt).toLocaleDateString('en-GB'),
    });
  });

  // Alternate row shading
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    if (i % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
    row.alignment = { vertical: 'middle' };
  }

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook;
}

// ══════════════════════════════════════════════════════════════
// Excel — KPI Data
// ══════════════════════════════════════════════════════════════

async function generateKPIsExcel(orgId) {
  const kpis = await prisma.kPI.findMany({
    where: { orgId },
    orderBy: { category: 'asc' },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'KPI Platform';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('KPIs');

  sheet.columns = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'Target', key: 'target', width: 12 },
    { header: 'Current Value', key: 'value', width: 14 },
    { header: 'Achievement %', key: 'achievement', width: 14 },
    { header: 'Description', key: 'description', width: 30 },
    { header: 'Alert Threshold', key: 'alertThreshold', width: 14 },
    { header: 'Alert Enabled', key: 'alertEnabled', width: 12 },
    { header: 'Last Updated', key: 'updatedAt', width: 16 },
  ];

  // Header styling
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 24;

  kpis.forEach((k) => {
    const achievement = k.target && k.target > 0 ? ((k.value || 0) / k.target * 100).toFixed(1) : '—';

    sheet.addRow({
      name: k.name,
      category: k.category,
      unit: k.unit,
      target: k.target ?? '—',
      value: k.value ?? '—',
      achievement: achievement === '—' ? '—' : `${achievement}%`,
      description: k.description || '',
      alertThreshold: k.alertThreshold ?? '—',
      alertEnabled: k.alertEnabled ? 'Yes' : 'No',
      updatedAt: new Date(k.updatedAt).toLocaleDateString('en-GB'),
    });
  });

  // Alternate row shading
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    if (i % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
    row.alignment = { vertical: 'middle' };
  }

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook;
}

module.exports = { generateAppraisalPDF, generateAppraisalsExcel, generateKPIsExcel };
