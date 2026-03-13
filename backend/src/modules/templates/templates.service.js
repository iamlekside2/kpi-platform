const prisma = require('../../config/db');
const templates = require('./templates.data');

function getAllTemplates() {
  return templates;
}

function getTemplateByKey(key) {
  return templates.find((t) => t.key === key);
}

async function applyTemplates({ orgId, templateKeys, userId }) {
  // Validate all keys first
  const selectedTemplates = [];
  for (const key of templateKeys) {
    const template = getTemplateByKey(key);
    if (!template) {
      throw new Error(`Template not found: ${key}`);
    }
    selectedTemplates.push(template);
  }

  // Verify user is admin of the org
  const membership = await prisma.orgMember.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });

  if (!membership || membership.role !== 'admin') {
    throw new Error('Only admins can apply templates');
  }

  // Delete existing KPIs for this org (in case they're re-applying)
  await prisma.kPI.deleteMany({ where: { orgId } });

  // Update org industry to comma-separated list of selected templates
  const industryLabel = selectedTemplates.map((t) => t.key).join(',');
  await prisma.organisation.update({
    where: { id: orgId },
    data: { industry: industryLabel },
  });

  // Merge all KPIs from selected templates, avoiding duplicates by name
  const seen = new Set();
  const allKpis = [];
  for (const template of selectedTemplates) {
    for (const kpi of template.kpis) {
      if (!seen.has(kpi.name)) {
        seen.add(kpi.name);
        allKpis.push({
          name: kpi.name,
          unit: kpi.unit,
          target: kpi.target,
          category: kpi.category,
          description: kpi.description,
          orgId,
        });
      }
    }
  }

  if (allKpis.length > 0) {
    await prisma.kPI.createMany({ data: allKpis });
  }

  // Return org with new KPIs
  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
    include: { kpis: true },
  });

  return org;
}

module.exports = { getAllTemplates, getTemplateByKey, applyTemplates };
