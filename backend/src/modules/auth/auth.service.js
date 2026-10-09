const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');
const env = require('../../config/env');
const { sendWelcomeEmail, sendPasswordResetEmail, sendPasswordChangedEmail } = require('../../utils/mailer');

const SALT_ROUNDS = 12;

// Public mail providers — many unrelated people legitimately share these
// domains, so the one-account-per-company-domain rule must not apply to them.
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com',
  'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com',
  'proton.me', 'protonmail.com', 'mail.com', 'gmx.com', 'zoho.com',
]);

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

  // One self-registration per company domain: once someone from a company
  // (e.g. hr@acme.com) has registered, colleagues must be added by their
  // admin from the Staff page instead of registering their own account.
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain && !PUBLIC_EMAIL_DOMAINS.has(domain)) {
    const sameDomainUser = await prisma.user.findFirst({
      where: { email: { endsWith: `@${domain}`, mode: 'insensitive' } },
      select: { id: true },
    });
    if (sameDomainUser) {
      throw new Error('Company already registered');
    }
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, password: hashedPassword },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Send welcome email (fire-and-forget, don't block registration)
  sendWelcomeEmail(user).catch(() => {});

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
    throw new Error('No account found with this email');
  }

  const resetToken = generateResetToken(user);

  // Build the reset link (trim to remove any trailing whitespace/newlines from env var)
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  // Send reset email using shared mailer
  const sent = await sendPasswordResetEmail({ email, name: user.name, resetLink });

  if (!sent) {
    // SMTP not configured or failed — return link for dev/fallback
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

  // Send confirmation email (fire-and-forget)
  sendPasswordChangedEmail({ email: user.email, name: user.name }).catch(() => {});

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
