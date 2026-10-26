const { Router } = require('express');
const { createOrg, getOrg, inviteToOrg, getUserOrgs, getMembers, updateMemberRole, updateMemberDepartment, updateMemberLevel, updateMemberStaffType, updateMemberUser, resetMemberPassword, setHrOfficer, getMemberLevelHistory, removeMember, updateThemeColor } = require('./orgs.controller');

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
router.patch('/:id/members/:memberId/user', updateMemberUser);
router.post('/:id/members/:memberId/reset-password', resetMemberPassword);
router.get('/:id/members/:memberId/level-history', getMemberLevelHistory);
router.delete('/:id/members/:memberId', removeMember);

// The single person who signs off the HR comment
router.patch('/:id/hr-officer', setHrOfficer);

// Theme
router.patch('/:id/theme', updateThemeColor);

module.exports = router;
