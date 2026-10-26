/**
 * Email addresses are not case-sensitive in practice, but Postgres string
 * equality is: a user stored as Tolu@calmglobal.com could not sign in by
 * typing tolu@calmglobal.com. Normalise everything on the way in, and look
 * existing rows up case-insensitively so addresses saved before this still
 * work.
 */

function normaliseEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// Prisma's findUnique cannot do a case-insensitive match, so an email lookup
// goes through findFirst.
function findUserByEmail(prisma, email) {
  return prisma.user.findFirst({
    where: { email: { equals: normaliseEmail(email), mode: 'insensitive' } },
  });
}

module.exports = { normaliseEmail, findUserByEmail };
