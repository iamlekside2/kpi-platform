const prisma = require('../../config/db');

// Generate slug from name: "Tech / Product Development" → "tech-product-development"
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function createDepartment(orgId, { name, slug, description = '' }) {
  const finalSlug = slug || slugify(name);

  return prisma.department.create({
    data: { name, slug: finalSlug, description, orgId },
    include: { _count: { select: { members: true } } },
  });
}

async function getOrgDepartments(orgId) {
  const departments = await prisma.department.findMany({
    where: { orgId },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    description: d.description,
    memberCount: d._count.members,
    createdAt: d.createdAt,
  }));
}

async function updateDepartment(deptId, { name, description }) {
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;

  return prisma.department.update({
    where: { id: deptId },
    data,
    include: { _count: { select: { members: true } } },
  });
}

async function deleteDepartment(deptId) {
  // Unassign all members from this department first
  await prisma.orgMember.updateMany({
    where: { departmentId: deptId },
    data: { departmentId: null },
  });

  return prisma.department.delete({ where: { id: deptId } });
}

// Seed default departments for a new org
async function seedDefaultDepartments(orgId) {
  const defaults = [
    { name: 'Tech / Product Development', slug: 'tech', description: 'Engineering, product, and technical teams' },
    { name: 'Sales & Marketing', slug: 'sales', description: 'Sales, marketing, and business development teams' },
    { name: 'General / Other', slug: 'general', description: 'Administration, operations, and other departments' },
  ];

  await prisma.department.createMany({
    data: defaults.map((d) => ({ ...d, orgId })),
    skipDuplicates: true,
  });
}

module.exports = { createDepartment, getOrgDepartments, updateDepartment, deleteDepartment, seedDefaultDepartments };
