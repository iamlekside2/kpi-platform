const { Router } = require('express');
const { createOrg, getOrg, inviteToOrg, getUserOrgs, getMembers, updateMemberRole, updateMemberDepartment, updateMemberLevel, updateMemberStaffType, getMemberLevelHistory, removeMember, updateThemeColor } = require('./orgs.controller');

const router = Router();

router.get('/', getUserOrgs);
router.post('/', createOrg);
router.get('/:id', getOrg);
router.post('/:id/invite', inviteToOrg);

// Member management
router.get('/:id/members', getMembers);
router.patch('/:id/members/:memberId', updateMemberRole);
router.patch('/:id/members/:memberId/department', updateMemberDepartment);
router.patch('/:id/members/:memberId/level', updateMemberLevel);
router.patch('/:id/members/:memberId/staff-type', updateMemberStaffType);
router.get('/:id/members/:memberId/level-history', getMemberLevelHistory);
router.delete('/:id/members/:memberId', removeMember);

// Theme
router.patch('/:id/theme', updateThemeColor);

module.exports = router;
