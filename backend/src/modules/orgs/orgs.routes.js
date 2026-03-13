const { Router } = require('express');
const { createOrg, getOrg, inviteToOrg, getUserOrgs, getMembers, updateMemberRole, removeMember } = require('./orgs.controller');

const router = Router();

router.get('/', getUserOrgs);
router.post('/', createOrg);
router.get('/:id', getOrg);
router.post('/:id/invite', inviteToOrg);

// Member management
router.get('/:id/members', getMembers);
router.patch('/:id/members/:memberId', updateMemberRole);
router.delete('/:id/members/:memberId', removeMember);

module.exports = router;
