const { Router } = require('express');
const { updateAlertSettings } = require('./notifications.service');

const router = Router();

// Update alert settings for a KPI
router.patch('/alerts/:kpiId', async (req, res) => {
  try {
    const { alertEnabled, alertThreshold } = req.body;
    const kpi = await updateAlertSettings({
      kpiId: req.params.kpiId,
      alertEnabled,
      alertThreshold,
      userId: req.user.userId,
    });
    return res.json(kpi);
  } catch (err) {
    if (err.message === 'KPI not found') return res.status(404).json({ error: err.message });
    console.error('Alert settings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
