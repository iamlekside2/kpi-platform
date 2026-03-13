const prisma = require('../../config/db');

// ══════════════════════════════════════════════════════════════
// SHARED across all departments
// ══════════════════════════════════════════════════════════════

const SELF_RATING_ATTRIBUTES = [
  { key: 'quantity_of_work', label: 'Quantity of work', maxScore: 10 },
  { key: 'meeting_requirements', label: 'Meeting job requirements on timely basis', maxScore: 10 },
  { key: 'quality_of_work', label: 'Quality of work', maxScore: 10 },
  { key: 'effectiveness_accuracy', label: 'Effectiveness & Accuracy', maxScore: 10 },
  { key: 'knowledge_of_job', label: 'Knowledge of job', maxScore: 10 },
  { key: 'knowledge_demonstrates', label: 'Extent to which employee knows and demonstrates all phases of assigned work', maxScore: 10 },
  { key: 'team_spirit', label: 'Team Spirit', maxScore: 10 },
  { key: 'decision_making', label: 'Decision making Ability', maxScore: 10 },
  { key: 'attendance_reliability', label: 'Attendance, reliability and dependability', maxScore: 10 },
  { key: 'planning_organization', label: 'Planning and organizational effectiveness', maxScore: 10 },
  { key: 'meeting_deadlines', label: 'Meeting deadlines, managing resources, and balancing tasks', maxScore: 10 },
  { key: 'communication_skills', label: 'Communication Skills', maxScore: 10 },
  { key: 'initiative_creativity', label: 'Initiative and creativity', maxScore: 10 },
  { key: 'supervisory_ability', label: 'Supervisory ability (if applicable)', maxScore: 10 },
];

const SELF_ASSESSMENT_QUESTIONS = [
  { key: 'main_duties', label: 'State your understanding of your main duties and responsibilities' },
  { key: 'past_year_assessment', label: 'Has the past year been good/bad/satisfactory or otherwise for you, and why?' },
  { key: 'important_achievements', label: 'What do you consider to be your most important achievements in the last 6 months?' },
  { key: 'targets_achieved', label: 'Are your monthly and quarterly targets being achieved?' },
  { key: 'production_quality', label: 'Is your production output meeting quality and volume standards?' },
  { key: 'job_interest', label: 'What elements of your job interest you the most, and least?' },
  { key: 'important_tasks', label: 'What do you consider to be your most important tasks over the last 6 months, and how did you carry them out?' },
  { key: 'improvement_actions', label: 'What action could be taken to improve your current position by you, and your line manager?' },
];

const UNIT_HEAD_ATTRIBUTES = [
  { key: 'targets_productivity', label: 'Targets & Productivity', maxScore: 8 },
  { key: 'knowledge_overall_goal', label: 'Knowledge of Overall Goal', maxScore: 8 },
  { key: 'relationship_management', label: 'Relationship Management', maxScore: 8 },
  { key: 'analytical_ability', label: 'Analytical Ability', maxScore: 8 },
  { key: 'initiative_leadership', label: 'Initiative & Leadership', maxScore: 8 },
  { key: 'drive_determination', label: 'Drive & Determination', maxScore: 8 },
  { key: 'self_organization', label: 'Self Organization', maxScore: 8 },
  { key: 'commitment_duties', label: 'Commitment to duties', maxScore: 8 },
  { key: 'higher_level_commitment', label: 'Higher level commitment', maxScore: 8 },
  { key: 'compliance_procedures', label: 'Compliance with procedures', maxScore: 8 },
  { key: 'discipline', label: 'Discipline', maxScore: 8 },
  { key: 'attention_to_details', label: 'Attention to details', maxScore: 8 },
];

// ══════════════════════════════════════════════════════════════
// DEPARTMENT-SPECIFIC questions
// ══════════════════════════════════════════════════════════════

const TECH_QUESTIONS = [
  { key: 'key_tasks_impact', label: 'List the key technical tasks or projects you completed in the last 6 months and the impact they had on the team or organization?' },
  { key: 'task_delivery', label: 'List the tasks or project(s) and how you carried out the delivery?' },
  { key: 'completed_in_time', label: 'Did you complete the tasks or project(s) in time?' },
  { key: 'team_members', label: 'Did you work as a member of a team? If yes, list team lead and other members' },
  { key: 'current_project', label: 'What project are you working on now? List and describe' },
  { key: 'delivery_timeline', label: 'Do you have timeline for delivery?' },
  { key: 'compensation_reflection', label: 'Do you feel your current compensation reflects your contributions and responsibilities? If Yes/No, explain your reasoning?' },
  { key: 'overall_technical_rating', label: 'How would you rate your overall technical performance over the last 6 months?' },
  { key: 'positive_impact', label: 'Do you feel your contributions have positively impacted the team or organization? How?' },
  { key: 'area_of_expertise', label: 'What area of expertise can you claim to be the best for you as a staff?' },
  { key: 'justifies_role', label: 'Do you believe your technical output over the last 6 months justifies your continued role in the team? Please explain?' },
  { key: 'track_performance', label: 'How do you track and measure your own performance and progress in your role?' },
];

const SALES_QUESTIONS = [
  { key: 'target_market', label: 'Who EXACTLY is your target market? (Please list all target markets)' },
  { key: 'products_sold', label: 'Explain each product or service you\'ve sold in the last 6 months?' },
  { key: 'most_profitable', label: 'Which of your services or products produce the most profits?' },
  { key: 'avg_transaction_value', label: 'What is the average transaction value (the average sales price) each customer purchase?' },
  { key: 'earned_wages', label: 'Do you feel you have earned your monthly wages? If yes, please explain your reasoning highlighting contributions and outcomes. If no, explain why, identifying any factors that limited your performance.' },
  { key: 'customer_split', label: 'What percentage of your sales is produced by your Existing Customer Base vs. New Customers? (Existing ___ New ___ Don\'t Know ___)' },
  { key: 'marketing_plan', label: 'Describe your Yearly Marketing Plan?' },
  { key: 'marketing_planning_advance', label: 'How far in advance do you plan your marketing?' },
  { key: 'sales_revenue', label: 'How much is your sales revenue within this review period?' },
  { key: 'presentations_made', label: 'How many presentations have you made in the last 6 months? List all and status' },
  { key: 'new_leads', label: 'How many new leads have you generated within the period of this review?' },
  { key: 'marketing_channels', label: 'List all forms of marketing you currently do and describe in details (one-on-one, Phone calls, Email Marketing, Online Marketing, Social Media, Live Chats, handbills, others)' },
  { key: 'cost_per_lead', label: 'Do you know your cost-per-lead and cost-per-sale for each type of marketing? If yes, please list for each marketing channel' },
  { key: 'prospect_capture', label: 'Do you capture the name, address, and/or phone number of prospects on a regular basis? How?' },
  { key: 'lead_followup', label: 'Do you have a set way to follow up with your leads? Please explain in details' },
  { key: 'sales_process', label: 'Explain the normal sales process when selling your product(s)/service(s) to a new client (Please explain separately for each product if process differs)' },
  { key: 'monthly_targets', label: 'What is your monthly sales and lead targets?' },
  { key: 'why_choose_us', label: '"Why should I use your service(s) or product(s) instead of a competitor\'s?" Please answer this as you would to a prospective customer' },
];

// ══════════════════════════════════════════════════════════════
// Department templates registry
// ══════════════════════════════════════════════════════════════

const DEPARTMENTS = [
  { key: 'tech', name: 'Tech / Product Development', icon: '💻' },
  { key: 'sales', name: 'Sales & Marketing', icon: '💰' },
  { key: 'general', name: 'General / Other', icon: '📋' },
];

function getDeptQuestions(department) {
  switch (department) {
    case 'tech':
      return TECH_QUESTIONS;
    case 'sales':
      return SALES_QUESTIONS;
    case 'general':
    default:
      return []; // No department-specific questions for general
  }
}

function getDeptLabel(department) {
  switch (department) {
    case 'tech': return 'Technical (Product Development)';
    case 'sales': return 'Sales & Marketing';
    default: return 'General';
  }
}

// ── Return form structure ──
function getFormStructure(department) {
  return {
    departments: DEPARTMENTS,
    selfRatingAttributes: SELF_RATING_ATTRIBUTES,
    departmentQuestions: getDeptQuestions(department || 'tech'),
    departmentLabel: getDeptLabel(department || 'tech'),
    selfAssessmentQuestions: SELF_ASSESSMENT_QUESTIONS,
    unitHeadAttributes: UNIT_HEAD_ATTRIBUTES,
    scoring: {
      weights: { selfRating: 30, unitHead: 50, md: 20 },
      selfRatingMax: SELF_RATING_ATTRIBUTES.reduce((s, a) => s + a.maxScore, 0),
      unitHeadMax: UNIT_HEAD_ATTRIBUTES.reduce((s, a) => s + a.maxScore, 0),
      mdMax: 100,
      grades: [
        { grade: 'A', min: 96, max: 100, label: 'Outstanding Performance' },
        { grade: 'B', min: 81, max: 95, label: 'Good Performance' },
        { grade: 'C', min: 65, max: 80, label: 'Satisfactory Performance' },
        { grade: 'D', min: 0, max: 64, label: 'Below Standard — Staff advised to resign' },
      ],
    },
  };
}

// ── Create a new appraisal ──
async function createAppraisal(orgId, employeeId, data) {
  return prisma.appraisal.create({
    data: {
      orgId,
      employeeId,
      department: data.department || 'tech',
      reviewPeriodFrom: new Date(data.reviewPeriodFrom),
      reviewPeriodTo: new Date(data.reviewPeriodTo),
      selfAssessment: data.selfAssessment || {},
      selfRatings: data.selfRatings || {},
      technicalAnswers: data.technicalAnswers || {},
      status: 'draft',
    },
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
}

// ── Get appraisals for an org ──
async function getOrgAppraisals(orgId) {
  return prisma.appraisal.findMany({
    where: { orgId },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Get single appraisal ──
async function getAppraisalById(id) {
  return prisma.appraisal.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });
}

// ── Get appraisals for a specific employee ──
async function getEmployeeAppraisals(orgId, employeeId) {
  return prisma.appraisal.findMany({
    where: { orgId, employeeId },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Update appraisal (employee filling in their sections) ──
async function updateEmployeeSection(id, data) {
  const updateData = {};
  if (data.selfAssessment !== undefined) updateData.selfAssessment = data.selfAssessment;
  if (data.selfRatings !== undefined) updateData.selfRatings = data.selfRatings;
  if (data.technicalAnswers !== undefined) updateData.technicalAnswers = data.technicalAnswers;
  if (data.status) updateData.status = data.status;

  return prisma.appraisal.update({
    where: { id },
    data: updateData,
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
}

// ── Submit appraisal (employee done) ──
async function submitAppraisal(id) {
  return prisma.appraisal.update({
    where: { id },
    data: { status: 'submitted' },
    include: { employee: { select: { id: true, name: true, email: true } } },
  });
}

// ── Unit Head review ──
async function updateUnitHeadReview(id, reviewerId, data) {
  return prisma.appraisal.update({
    where: { id },
    data: {
      unitHeadScores: data.unitHeadScores || {},
      unitHeadComment: data.unitHeadComment || '',
      reviewerId,
      status: 'unit_reviewed',
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });
}

// ── Admin comment ──
async function updateAdminComment(id, comment) {
  return prisma.appraisal.update({
    where: { id },
    data: { adminComment: comment, status: 'admin_reviewed' },
  });
}

// ══════════════════════════════════════════════════════════════
// SCORING & GRADING
// ══════════════════════════════════════════════════════════════

// Weights: Self-rating 30%, Unit Head 50%, MD 20%
function calculateFinalScore(selfRatings, unitHeadScores, mdScore) {
  // Self rating: max 140 (14 attributes x 10 each)
  const selfMax = SELF_RATING_ATTRIBUTES.reduce((sum, a) => sum + a.maxScore, 0);
  const selfTotal = Object.values(selfRatings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const selfPercent = selfMax > 0 ? (selfTotal / selfMax) * 100 : 0;

  // Unit head: max 96 (12 attributes x 8 each)
  const uhMax = UNIT_HEAD_ATTRIBUTES.reduce((sum, a) => sum + a.maxScore, 0);
  const uhTotal = Object.values(unitHeadScores || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const uhPercent = uhMax > 0 ? (uhTotal / uhMax) * 100 : 0;

  // MD score is already out of 100
  const mdPercent = Math.min(Number(mdScore) || 0, 100);

  // Weighted average: 30% self + 50% unit head + 20% MD
  const final = (selfPercent * 0.3) + (uhPercent * 0.5) + (mdPercent * 0.2);
  return Math.round(final * 100) / 100;
}

function getGrade(score) {
  if (score >= 96) return 'A';
  if (score >= 81) return 'B';
  if (score >= 65) return 'C';
  return 'D';
}

// ── MD comment + score (final step — calculates grade) ──
async function updateMdComment(id, comment, mdScore) {
  const appraisal = await prisma.appraisal.findUnique({ where: { id } });
  if (!appraisal) throw new Error('Appraisal not found');

  const finalScore = calculateFinalScore(appraisal.selfRatings, appraisal.unitHeadScores, mdScore || 0);
  const grade = getGrade(finalScore);

  return prisma.appraisal.update({
    where: { id },
    data: {
      mdComment: comment,
      mdScore: Number(mdScore) || 0,
      finalScore,
      grade,
      status: 'completed',
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });
}

// ── Delete appraisal ──
async function deleteAppraisal(id) {
  return prisma.appraisal.delete({ where: { id } });
}

module.exports = {
  getFormStructure,
  calculateFinalScore,
  getGrade,
  createAppraisal,
  getOrgAppraisals,
  getAppraisalById,
  getEmployeeAppraisals,
  updateEmployeeSection,
  submitAppraisal,
  updateUnitHeadReview,
  updateAdminComment,
  updateMdComment,
  deleteAppraisal,
};
