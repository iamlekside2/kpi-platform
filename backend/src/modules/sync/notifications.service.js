const prisma = require('../../config/db');
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user) {
    return null; // Email not configured
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port) || 587,
    secure: port === '465',
    auth: { user, pass },
  });

  return transporter;
}

/**
 * Check all KPIs with alertEnabled=true for threshold breaches.
 * Sends email to org admins when a KPI crosses its threshold.
 */
async function checkAlerts(orgId) {
  const kpis = await prisma.kPI.findMany({
    where: {
      orgId,
      alertEnabled: true,
      alertThreshold: { not: null },
      value: { not: null },
    },
  });

  const alerts = [];
  for (const kpi of kpis) {
    if (kpi.value > kpi.alertThreshold) {
      alerts.push(kpi);
    }
  }

  if (alerts.length === 0) return;

  // Get org admins
  const admins = await prisma.orgMember.findMany({
    where: { orgId, role: 'admin' },
    include: { user: { select: { email: true, name: true } } },
  });

  const org = await prisma.organisation.findUnique({ where: { id: orgId } });

  for (const admin of admins) {
    await sendAlertEmail({
      to: admin.user.email,
      name: admin.user.name,
      orgName: org.name,
      alerts,
    });
  }
}

async function sendAlertEmail({ to, name, orgName, alerts }) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[Notification] Email not configured. Would send alert to ${to} for ${alerts.length} KPIs`);
    return;
  }

  const alertLines = alerts.map(
    (kpi) => `- ${kpi.name}: current value ${kpi.value} ${kpi.unit} (threshold: ${kpi.alertThreshold} ${kpi.unit})`
  ).join('\n');

  try {
    await transport.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: `KPI Alert - ${orgName}`,
      text: `Hi ${name},\n\nThe following KPIs in ${orgName} have crossed their alert thresholds:\n\n${alertLines}\n\nPlease review your dashboard.\n\n— KPI Platform`,
      html: `
        <p>Hi ${name},</p>
        <p>The following KPIs in <strong>${orgName}</strong> have crossed their alert thresholds:</p>
        <ul>${alerts.map((kpi) => `<li><strong>${kpi.name}</strong>: ${kpi.value} ${kpi.unit} (threshold: ${kpi.alertThreshold} ${kpi.unit})</li>`).join('')}</ul>
        <p>Please review your dashboard.</p>
        <p>— KPI Platform</p>
      `,
    });
    console.log(`[Notification] Alert email sent to ${to}`);
  } catch (err) {
    console.error(`[Notification] Failed to send email to ${to}:`, err.message);
  }
}

/**
 * Update alert settings for a KPI.
 */
async function updateAlertSettings({ kpiId, alertEnabled, alertThreshold, userId }) {
  const kpi = await prisma.kPI.findUnique({ where: { id: kpiId } });
  if (!kpi) throw new Error('KPI not found');

  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId: kpi.orgId } },
  });
  if (!membership) throw new Error('Not a member of this organisation');

  return prisma.kPI.update({
    where: { id: kpiId },
    data: {
      alertEnabled: alertEnabled !== undefined ? alertEnabled : kpi.alertEnabled,
      alertThreshold: alertThreshold !== undefined ? parseFloat(alertThreshold) : kpi.alertThreshold,
    },
  });
}

module.exports = { checkAlerts, sendAlertEmail, updateAlertSettings };
