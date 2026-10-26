/**
 * Seed a demo organisation covering every role and every appraisal stage.
 *
 * Local only. Refuses to run unless DATABASE_URL points at a database whose
 * name contains "demo", so it can never be pointed at production by accident.
 *
 *   node scripts/seed-demo.js
 *
 * Everyone's password is Demo@1234.
 */
require('dotenv').config();

const url = process.env.DATABASE_URL || '';
if (!/demo/i.test(url)) {
  console.error(
    'Refusing to run: DATABASE_URL does not name a demo database.\n' +
      'This script deletes every row it touches and is for a local demo only.'
  );
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');

const PASSWORD = 'Demo@1234';

const SELF_ATTRS = [
  'quantity_of_work', 'meeting_requirements', 'quality_of_work', 'effectiveness_accuracy',
  'knowledge_of_job', 'knowledge_demonstrates', 'team_spirit', 'decision_making',
  'attendance_reliability', 'planning_organization', 'meeting_deadlines',
  'communication_skills', 'initiative_creativity', 'supervisory_ability',
];

const UNIT_HEAD_ATTRS = [
  'targets_productivity', 'knowledge_overall_goal', 'relationship_management',
  'analytical_ability', 'initiative_leadership', 'drive_determination',
  'self_organization', 'commitment_duties', 'higher_level_commitment',
  'compliance_procedures', 'discipline', 'attention_to_details',
];

const ratings = (attrs, value) => Object.fromEntries(attrs.map((k) => [k, value]));

// Mirrors calculateFinalScore in appraisals.service.js
function finalScore(self, unitHead, md) {
  const selfPct = (Object.values(self).reduce((a, b) => a + b, 0) / 140) * 100;
  const uhPct = (Object.values(unitHead).reduce((a, b) => a + b, 0) / 96) * 100;
  return Math.round((selfPct * 0.3 + uhPct * 0.5 + md * 0.2) * 100) / 100;
}

function grade(score) {
  if (score >= 96) return 'A';
  if (score >= 81) return 'B';
  if (score >= 65) return 'C';
  return 'D';
}

const PEOPLE = [
  { key: 'owner', name: 'Lekan Otitolaye', email: 'horllyk12@gmail.com', role: 'admin', dept: 'tech', level: 6, staffType: 'permanent' },
  { key: 'hr', name: 'Bisi Hassan', email: 'hr@demo.test', role: 'admin', dept: 'hr', level: 5, staffType: 'permanent' },
  { key: 'lead', name: 'Gbenga Adeoye', email: 'lead@demo.test', role: 'lead', dept: 'tech', level: 5, staffType: 'permanent' },
  { key: 'salesLead', name: 'Niniola Grace', email: 'saleslead@demo.test', role: 'lead', dept: 'sales', level: 4, staffType: 'permanent' },
  { key: 'md', name: 'Alemede Sunday', email: 'md@demo.test', role: 'md', dept: 'executive', level: 8, staffType: 'permanent' },
  { key: 'chairman', name: 'Adeolu Ireyomi', email: 'chairman@demo.test', role: 'chairman', dept: 'executive', level: 9, staffType: 'permanent' },
  { key: 'emp1', name: 'Tunde Bakare', email: 'tunde@demo.test', role: 'member', dept: 'tech', level: 3, staffType: 'permanent' },
  { key: 'emp2', name: 'Chioma Eze', email: 'chioma@demo.test', role: 'member', dept: 'tech', level: 2, staffType: 'contract' },
  { key: 'emp3', name: 'Yusuf Bello', email: 'yusuf@demo.test', role: 'member', dept: 'sales', level: 3, staffType: 'permanent' },
  { key: 'emp4', name: 'Amaka Nwosu', email: 'amaka@demo.test', role: 'member', dept: 'support', level: 2, staffType: 'contract' },
];

const DEPARTMENTS = [
  { name: 'Tech / Product Development', slug: 'tech', description: 'Engineering and product' },
  { name: 'Sales & Marketing', slug: 'sales', description: 'Sales, marketing and business development' },
  { name: 'Human Resources', slug: 'hr', description: 'HR, people operations and appraisal administration' },
  { name: 'Support', slug: 'support', description: 'Customer and technical support' },
  { name: 'Executive', slug: 'executive', description: 'Board and executive office, outside the review structure' },
  { name: 'General / Other', slug: 'general', description: 'Administration, operations and other' },
];

const KPIS = [
  { name: 'Sprint velocity', unit: 'points', target: 40, value: 44, category: 'Delivery' },
  { name: 'Open bugs', unit: 'bugs', target: 10, value: 7, category: 'Quality' },
  { name: 'Deployment frequency', unit: 'per week', target: 5, value: 6, category: 'Delivery' },
  { name: 'Customer tickets closed', unit: 'tickets', target: 120, value: 103, category: 'Support' },
  { name: 'First response time', unit: 'hours', target: 4, value: 3.2, category: 'Support' },
  { name: 'Qualified leads', unit: 'leads', target: 60, value: 71, category: 'Sales' },
  { name: 'Revenue closed', unit: 'NGN m', target: 25, value: 21.4, category: 'Sales' },
  { name: 'Staff turnover', unit: '%', target: 8, value: 5, category: 'People' },
];

const period = (fromISO, toISO) => ({ reviewPeriodFrom: new Date(fromISO), reviewPeriodTo: new Date(toISO) });

async function wipe() {
  // Child rows first — nothing cascades
  await prisma.levelChange.deleteMany({});
  await prisma.memberWorkItems.deleteMany({});
  await prisma.syncLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.appraisal.deleteMany({});
  await prisma.kPI.deleteMany({});
  await prisma.integration.deleteMany({});
  await prisma.organisation.updateMany({ data: { hrOfficerId: null } });
  await prisma.orgMember.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.organisation.deleteMany({});
  await prisma.user.deleteMany({});
}

async function main() {
  console.log('Clearing the demo database...');
  await wipe();

  const password = await bcrypt.hash(PASSWORD, 12);

  console.log('Creating organisation...');
  const org = await prisma.organisation.create({
    data: { name: 'Demo Company Ltd', industry: 'Technology', themeColor: 'indigo' },
  });

  const depts = {};
  for (const d of DEPARTMENTS) {
    depts[d.slug] = await prisma.department.create({ data: { ...d, orgId: org.id } });
  }

  console.log('Creating people...');
  const people = {};
  for (const p of PEOPLE) {
    const user = await prisma.user.create({
      data: { name: p.name, email: p.email, password },
    });
    const member = await prisma.orgMember.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: p.role,
        level: p.level,
        staffType: p.staffType,
        departmentId: depts[p.dept].id,
      },
    });
    people[p.key] = { user, member };
  }

  // HR officer is a named person, not a role — Bisi in the HR department
  await prisma.organisation.update({
    where: { id: org.id },
    data: { hrOfficerId: people.hr.user.id },
  });

  console.log('Creating KPIs...');
  await prisma.kPI.createMany({ data: KPIS.map((k) => ({ ...k, orgId: org.id })) });

  console.log('Creating level history...');
  await prisma.levelChange.createMany({
    data: [
      { memberId: people.emp1.member.id, orgId: org.id, fromLevel: 1, toLevel: 2, changedById: people.owner.user.id, note: 'Confirmed after probation', createdAt: new Date('2025-04-14') },
      { memberId: people.emp1.member.id, orgId: org.id, fromLevel: 2, toLevel: 3, changedById: people.hr.user.id, note: 'Promoted after 2025 review', createdAt: new Date('2026-02-02') },
      { memberId: people.lead.member.id, orgId: org.id, fromLevel: 4, toLevel: 5, changedById: people.owner.user.id, note: 'Took over the Tech unit', createdAt: new Date('2025-11-10') },
    ],
  });

  console.log('Creating appraisals at every stage...');
  const selfGood = ratings(SELF_ATTRS, 8);
  const selfStrong = ratings(SELF_ATTRS, 9);
  const uhGood = ratings(UNIT_HEAD_ATTRS, 6);
  const uhStrong = ratings(UNIT_HEAD_ATTRS, 7);

  // These keys must match SELF_ASSESSMENT_QUESTIONS in appraisals.service.js,
  // otherwise a reviewer opens the appraisal to a page of empty boxes.
  const answers = {
    main_duties: 'Delivery of the assigned workstream, day-to-day quality checks, and handover notes for the team.',
    past_year_assessment: 'Good overall. Two slow months mid-period while a dependency was blocked, recovered after.',
    important_achievements: 'Closed the backlog carried over from the last period and cut rework on repeat issues.',
    targets_achieved: 'Monthly targets met in five of six months; the quarterly target was met.',
    production_quality: 'Output met the volume standard and no quality issues were escalated this period.',
    job_interest: 'Most: problem-solving with the team. Least: repetitive manual reporting.',
    important_tasks: 'Owning the weekly delivery cycle and keeping the tracker honest so blockers surface early.',
    improvement_actions: 'Automate the manual reporting step and agree escalation points earlier in the cycle.',
  };

  // 1. Draft — Chioma has not submitted yet
  await prisma.appraisal.create({
    data: {
      orgId: org.id, employeeId: people.emp2.user.id, department: 'tech', status: 'draft',
      ...period('2026-07-01', '2026-12-31'),
      selfAssessment: answers, selfRatings: ratings(SELF_ATTRS, 7),
    },
  });

  // 2. Submitted — waiting on the Tech unit head
  await prisma.appraisal.create({
    data: {
      orgId: org.id, employeeId: people.emp1.user.id, department: 'tech', status: 'submitted',
      ...period('2026-07-01', '2026-12-31'),
      selfAssessment: answers, selfRatings: selfGood,
    },
  });

  // 3. Unit reviewed — waiting on the HR officer
  await prisma.appraisal.create({
    data: {
      orgId: org.id, employeeId: people.emp3.user.id, department: 'sales', status: 'unit_reviewed',
      ...period('2026-07-01', '2026-12-31'),
      selfAssessment: answers, selfRatings: selfGood,
      unitHeadScores: uhGood, unitHeadComment: 'Steady quarter. Pipeline discipline has improved.',
      reviewerId: people.salesLead.user.id,
    },
  });

  // 4. HR reviewed — waiting on the MD
  await prisma.appraisal.create({
    data: {
      orgId: org.id, employeeId: people.emp4.user.id, department: 'general', status: 'admin_reviewed',
      ...period('2026-07-01', '2026-12-31'),
      selfAssessment: answers, selfRatings: selfGood,
      unitHeadScores: uhGood, unitHeadComment: 'Reliable on tickets, slower on escalations.',
      adminComment: 'No HR concerns on record for this period.',
      reviewerId: people.lead.user.id,
    },
  });

  // 5 and 6. Completed — two past periods for Tunde, so his score chart has a trend
  const s1 = finalScore(selfGood, uhGood, 70);
  const s2 = finalScore(selfStrong, uhStrong, 82);
  await prisma.appraisal.create({
    data: {
      orgId: org.id, employeeId: people.emp1.user.id, department: 'tech', status: 'completed',
      ...period('2025-01-01', '2025-06-30'),
      selfAssessment: answers, selfRatings: selfGood,
      unitHeadScores: uhGood, unitHeadComment: 'Solid first half.',
      adminComment: 'Nothing on file.', mdComment: 'Keep building.', mdScore: 70,
      finalScore: s1, grade: grade(s1), reviewerId: people.lead.user.id,
    },
  });
  await prisma.appraisal.create({
    data: {
      orgId: org.id, employeeId: people.emp1.user.id, department: 'tech', status: 'completed',
      ...period('2025-07-01', '2025-12-31'),
      selfAssessment: answers, selfRatings: selfStrong,
      unitHeadScores: uhStrong, unitHeadComment: 'Clear step up in ownership.',
      adminComment: 'Recommended for level review.', mdComment: 'Strong half. Promote.', mdScore: 82,
      finalScore: s2, grade: grade(s2), reviewerId: people.lead.user.id,
    },
  });

  const counts = {
    departments: Object.keys(depts).length,
    people: PEOPLE.length,
    kpis: KPIS.length,
    appraisals: await prisma.appraisal.count({ where: { orgId: org.id } }),
  };

  console.log('\nDone.\n');
  console.log(`Organisation: ${org.name}`);
  console.log(`HR officer:   ${people.hr.user.name} (${people.hr.user.email})`);
  console.log(`Seeded:       ${counts.people} people, ${counts.departments} departments, ${counts.kpis} KPIs, ${counts.appraisals} appraisals\n`);
  console.log(`Every account signs in with: ${PASSWORD}\n`);
  for (const p of PEOPLE) {
    const tag = p.key === 'hr' ? `${p.role} + HR officer` : p.role;
    console.log(`  ${p.email.padEnd(22)} ${tag.padEnd(20)} ${p.name}`);
  }
  console.log(`\nScores on the two completed appraisals: ${s1} (${grade(s1)}) then ${s2} (${grade(s2)})`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
