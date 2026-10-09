const analyticsService = require('./analytics.service');

async function getSummary(req, res) {
  try {
    const { orgId } = req.params;
    if (!orgId) {
      return res.status(400).json({ error: 'Organisation ID is required' });
    }

    const summary = await analyticsService.getOrgSummary(orgId);
    return res.json(summary);
  } catch (err) {
    console.error('Analytics summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getTeam(req, res) {
  try {
    const data = await analyticsService.getTeamSummary(req.params.orgId, req.user.userId);
    return res.json(data);
  } catch (err) {
    if (err.message === 'Forbidden') return res.status(403).json({ error: 'Only unit heads can view the team summary' });
    if (err.message === 'Not a member') return res.status(403).json({ error: 'Not a member of this org' });
    console.error('Team summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getStaffPerformance(req, res) {
  try {
    const data = await analyticsService.getStaffPerformance(req.params.orgId, req.user.userId);
    return res.json(data);
  } catch (err) {
    if (err.message === 'Forbidden') return res.status(403).json({ error: 'Only executives can view staff performance' });
    if (err.message === 'Not a member') return res.status(403).json({ error: 'Not a member of this org' });
    console.error('Staff performance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getSummary, getTeam, getStaffPerformance };
