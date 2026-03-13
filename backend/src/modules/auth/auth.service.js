const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');
const env = require('../../config/env');

const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

async function registerUser({ email, name, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('Email already registered');
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, password: hashedPassword },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return { user, accessToken, refreshToken };
}

async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Return user without password
  const { password: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

async function refreshAccessToken(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const accessToken = generateAccessToken(user);
  return { accessToken, user };
}

// ── Forgot / Reset Password ────────────────────────────────

function generateResetToken(user) {
  return jwt.sign(
    { userId: user.id, purpose: 'password-reset' },
    env.jwtSecret,
    { expiresIn: '15m' }
  );
}

function verifyResetToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.purpose !== 'password-reset') {
    throw new Error('Invalid token purpose');
  }
  return payload;
}

async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal whether email exists — return silently
    return { sent: true };
  }

  const resetToken = generateResetToken(user);

  // Build the reset link
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  // Try sending email if SMTP is configured
  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@kpiplatform.com',
        to: email,
        subject: 'Reset Your Password — KPI Platform',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2>Password Reset</h2>
            <p>Hi ${user.name},</p>
            <p>You requested to reset your password. Click the button below to set a new password:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Reset Password</a>
            <p style="margin-top: 16px; color: #666; font-size: 14px;">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      });
      console.log(`Password reset email sent to ${email}`);
    } catch (err) {
      console.error('Failed to send reset email:', err.message);
      // Still return success + link for development fallback
      return { sent: true, resetLink };
    }
  } else {
    // No SMTP configured — log the link for development
    console.log(`[DEV] Password reset link for ${email}: ${resetLink}`);
    return { sent: true, resetLink };
  }

  return { sent: true };
}

async function resetPassword(token, newPassword) {
  const payload = verifyResetToken(token);

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new Error('User not found');
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return { success: true };
}

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  verifyAccessToken,
  verifyRefreshToken,
  forgotPassword,
  resetPassword,
};
