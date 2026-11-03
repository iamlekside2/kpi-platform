/**
 * Email addresses are not case-sensitive in practice, but Postgres string
 * equality is: a user stored as Tolu@calmglobal.com could not sign in by
 * typing tolu@calmglobal.com. Normalise everything on the way in, and look
 * existing rows up case-insensitively so addresses saved before this still
 * work.
 */

// Deliberately loose: the only thing worth rejecting here is text that cannot
// be an address at all. Anything stricter starts turning away valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_RE.test(normaliseEmail(value));
}

// Prisma's findUnique cannot do a case-insensitive match, so an email lookup
// goes through findFirst.
function findUserByEmail(prisma, email) {
  return prisma.user.findFirst({
    where: { email: { equals: normaliseEmail(email), mode: 'insensitive' } },
  });
}

module.exports = { EMAIL_RE, normaliseEmail, isValidEmail, findUserByEmail };
