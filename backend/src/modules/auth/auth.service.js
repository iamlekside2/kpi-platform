const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/db');
const { normaliseEmail, isValidEmail, findUserByEmail } = require('../../utils/email');
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

// A sign-in failure says which of the two fields was wrong rather than hiding
// both behind one message. The usual argument against that is account
// enumeration, which does not apply here: this is an invite-only internal
// tool, nobody outside the company can register, and a colleague who mistypes
// their address deserves to be told so instead of hunting for a password that
// was never the problem. `field` lets the form put the message on the input
// that caused it.
function authError(message, field, status = 401) {
  const err = new Error(message);
  err.authField = field;
  err.status = status;
  return err;
}

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

async function registerUser({ email: rawEmail, name, password }) {
  const email = normaliseEmail(rawEmail);

  if (!isValidEmail(email)) {
    throw authError('That does not look like an email address', 'email', 400);
  }

  const existing = await findUserByEmail(prisma, email);
  if (existing) {
    throw authError('An account already uses that email address', 'email', 409);
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
      throw authError(
        'Your company is already on the platform. Ask your administrator to add you from the Staff page.',
        'email',
        409
      );
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

async function loginUser({ email: rawEmail, password }) {
  const email = normaliseEmail(rawEmail);

  if (!isValidEmail(email)) {
    throw authError('That does not look like an email address', 'email', 400);
  }

  // Case-insensitive, so Tolu@CalmGlobal.com and tolu@calmglobal.com are the
  // same account however the person typed it.
  const user = await findUserByEmail(prisma, email);
  if (!user) {
    throw authError('No account found for that email address', 'email', 404);
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw authError('That password is not correct', 'password');
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

async function forgotPassword(rawEmail) {
  const email = normaliseEmail(rawEmail);

  if (!isValidEmail(email)) {
    throw authError('That does not look like an email address', 'email', 400);
  }

  const user = await findUserByEmail(prisma, email);
  if (!user) {
    throw authError('No account found for that email address', 'email', 404);
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
