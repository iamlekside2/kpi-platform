// Email provider priority: Brevo (HTTP API) → Resend → Nodemailer SMTP
// Set BREVO_API_KEY for Brevo, RESEND_API_KEY for Resend, or SMTP_HOST for Nodemailer

let resendClient = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (resendClient) return resendClient;

  const { Resend } = require('resend');
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function getNodemailerTransporter() {
  if (!process.env.SMTP_HOST) return null;

  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── Brevo (HTTP API — works on Vercel, 300 free emails/day) ──

async function sendViaBrevo({ to, subject, html, fromName, fromEmail }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return null; // not configured

  const senderEmail = fromEmail || process.env.BREVO_SENDER_EMAIL || 'horllyk12@gmail.com';
  const senderName = fromName || process.env.BREVO_SENDER_NAME || 'KPI Platform';

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      console.log(`[Brevo] Email sent to ${to}: ${subject}`, JSON.stringify(data));
      return true;
    } else {
      console.error(`[Brevo] Failed (${res.status}) to ${to}:`, JSON.stringify(data));
      return false;
    }
  } catch (err) {
    console.error(`[Brevo] Error sending to ${to}:`, err.message);
    return false;
  }
}

// ── Main sendEmail function ──────────────────────────────────

async function sendEmail({ to, subject, html }) {
  // 1. Try Brevo first (HTTP API, works on Vercel, 300/day free)
  const brevoResult = await sendViaBrevo({ to, subject, html });
  if (brevoResult === true) return true;

  // 2. Try Resend (HTTP API, works on Vercel, but free tier is limited)
  const resendFrom = process.env.RESEND_FROM || 'KPI Platform <onboarding@resend.dev>';
  const resend = getResend();
  if (resend) {
    try {
      const result = await resend.emails.send({ from: resendFrom, to, subject, html });
      console.log(`[Resend] Email sent to ${to}: ${subject}`, JSON.stringify(result));
      return true;
    } catch (err) {
      console.error(`[Resend] Failed to send email to ${to}:`, err.message);
    }
  }

  // 3. Fallback to Nodemailer SMTP
  const smtpFrom = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@kpi-platform.com';
  const transporter = getNodemailerTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({ from: smtpFrom, to, subject, html });
      console.log(`[SMTP] Email sent to ${to}: ${subject}`);
      return true;
    } catch (err) {
      console.error(`[SMTP] Failed to send email to ${to}:`, err.message);
    }
  }

  console.log(`[DEV] Email skipped (no provider) — To: ${to}, Subject: ${subject}`);
  return false;
}

// ── Helpers ──────────────────────────────────────────────────

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
}

// ── Email Templates ──────────────────────────────────────────

function sendWelcomeEmail(user) {
  const loginUrl = `${getFrontendUrl()}/login`;
  return sendEmail({
    to: user.email,
    subject: 'Welcome to KPI Platform!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px;">
        <div style="background: #4f46e5; padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Welcome to KPI Platform</h1>
        </div>
        <div style="background: white; padding: 28px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hi <strong>${user.name}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Your account has been created successfully. You're ready to start tracking KPIs and managing performance appraisals.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${loginUrl}" style="display: inline-block; padding: 12px 32px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Go to Dashboard</a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 20px;">If you have any questions, feel free to reach out to your admin.</p>
        </div>
      </div>
    `,
  });
}

function sendStaffInviteEmail({ email, name, orgName, inviterName, isNewAccount }) {
  const loginUrl = `${getFrontendUrl()}/login`;
  const passwordNote = isNewAccount
    ? `<p style="color: #334155; font-size: 15px; line-height: 1.6; background: #fef3c7; padding: 12px 16px; border-radius: 8px; border: 1px solid #fbbf24;">Your temporary password is: <strong>Welcome@123</strong><br/><span style="font-size: 13px; color: #92400e;">Please change it after your first login.</span></p>`
    : '';

  return sendEmail({
    to: email,
    subject: `You've been added to ${orgName} — KPI Platform`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px;">
        <div style="background: #4f46e5; padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">You're Invited!</h1>
        </div>
        <div style="background: white; padding: 28px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;"><strong>${inviterName}</strong> has added you to <strong>${orgName}</strong> on KPI Platform.</p>
          ${passwordNote}
          <div style="text-align: center; margin: 24px 0;">
            <a href="${loginUrl}" style="display: inline-block; padding: 12px 32px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Sign In Now</a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 20px;">If you didn't expect this email, you can safely ignore it.</p>
        </div>
      </div>
    `,
  });
}

function sendPasswordResetEmail({ email, name, resetLink }) {
  return sendEmail({
    to: email,
    subject: 'Reset Your Password — KPI Platform',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px;">
        <div style="background: #4f46e5; padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Password Reset</h1>
        </div>
        <div style="background: white; padding: 28px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">You requested to reset your password. Click the button below to set a new one:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 12px 32px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Reset Password</a>
          </div>
          <p style="color: #ef4444; font-size: 13px;">This link expires in 15 minutes.</p>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 12px;">If you didn't request this, ignore this email — your password won't change.</p>
        </div>
      </div>
    `,
  });
}

function sendPasswordChangedEmail({ email, name }) {
  const loginUrl = `${getFrontendUrl()}/login`;
  return sendEmail({
    to: email,
    subject: 'Your Password Was Changed — KPI Platform',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px;">
        <div style="background: #4f46e5; padding: 24px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Password Changed</h1>
        </div>
        <div style="background: white; padding: 28px; border-radius: 0 0 10px 10px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hi <strong>${name}</strong>,</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">Your password has been successfully changed.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${loginUrl}" style="display: inline-block; padding: 12px 32px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Sign In</a>
          </div>
          <p style="color: #ef4444; font-size: 13px; margin-top: 16px;">If you didn't make this change, please reset your password immediately or contact your admin.</p>
        </div>
      </div>
    `,
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendStaffInviteEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
};
