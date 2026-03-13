// Supports both Resend (recommended for Vercel) and Nodemailer SMTP
// Set RESEND_API_KEY env var to use Resend, or SMTP_HOST for Nodemailer

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

async function sendEmail({ to, subject, html }) {
  const fromAddress = process.env.EMAIL_FROM || 'KPI Platform <onboarding@resend.dev>';

  // Try Resend first (works on Vercel serverless)
  const resend = getResend();
  if (resend) {
    try {
      await resend.emails.send({ from: fromAddress, to, subject, html });
      console.log(`[Resend] Email sent to ${to}: ${subject}`);
      return true;
    } catch (err) {
      console.error(`[Resend] Failed to send email to ${to}:`, err.message);
      return false;
    }
  }

  // Fallback to Nodemailer SMTP
  const transporter = getNodemailerTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({ from: fromAddress, to, subject, html });
      console.log(`[SMTP] Email sent to ${to}: ${subject}`);
      return true;
    } catch (err) {
      console.error(`[SMTP] Failed to send email to ${to}:`, err.message);
      return false;
    }
  }

  console.log(`[DEV] Email skipped (no provider) — To: ${to}, Subject: ${subject}`);
  return false;
}

// ── Email Templates ──────────────────────────────────────────

function sendWelcomeEmail(user) {
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
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
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
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
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
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
