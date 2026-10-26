/**
 * One-off backfill: give every existing org an HR.
 *
 * `isHr` defaults to false, so after the column is added no one in an
 * existing org can complete the HR stage of an appraisal. New orgs get it
 * from createOrg (the founder), but orgs created before this change need
 * it set here.
 *
 * Picks the longest-standing admin in each org — in practice the person who
 * set the org up. Skips any org that already has an HR, so it is safe to
 * run more than once.
 *
 *   node scripts/backfill-hr.js            # report only
 *   node scripts/backfill-hr.js --apply    # write the changes
 */
const prisma = require('../src/config/db');

async function main() {
  const apply = process.argv.includes('--apply');

  const orgs = await prisma.organisation.findMany({
    select: { id: true, name: true },
  });

  const planned = [];
  const skipped = [];

  for (const org of orgs) {
    const existingHr = await prisma.orgMember.count({
      where: { orgId: org.id, isHr: true },
    });
    if (existingHr > 0) {
      skipped.push(`${org.name} — already has ${existingHr} HR`);
      continue;
    }

    const candidate = await prisma.orgMember.findFirst({
      where: { orgId: org.id, role: 'admin' },
      orderBy: { user: { createdAt: 'asc' } },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!candidate) {
      skipped.push(`${org.name} — no admin to designate, set HR manually`);
      continue;
    }

    planned.push({ org, candidate });
  }

  for (const { org, candidate } of planned) {
    const who = `${candidate.user.name} <${candidate.user.email}>`;
    if (apply) {
      await prisma.orgMember.update({
        where: { id: candidate.id },
        data: { isHr: true },
      });
      console.log(`SET  ${org.name}: ${who} is now HR`);
    } else {
      console.log(`WOULD SET  ${org.name}: ${who}`);
    }
  }

  skipped.forEach((s) => console.log(`SKIP ${s}`));

  console.log(
    `\n${planned.length} org(s) ${apply ? 'updated' : 'would be updated'}, ${skipped.length} skipped.`
  );
  if (!apply && planned.length > 0) {
    console.log('Re-run with --apply to write these changes.');
  }
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
