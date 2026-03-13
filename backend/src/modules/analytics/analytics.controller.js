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

module.exports = { getSummary };
