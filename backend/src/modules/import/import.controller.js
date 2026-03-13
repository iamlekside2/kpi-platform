const importService = require('./import.service');

async function previewCSV(req, res) {
  try {
    const { csvText } = req.body;
    if (!csvText) return res.status(400).json({ error: 'csvText is required' });

    const preview = importService.previewCSV(csvText);
    return res.json(preview);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function importCSV(req, res) {
  try {
    const { csvText, mapping } = req.body;
    if (!csvText || !mapping) {
      return res.status(400).json({ error: 'csvText and mapping are required' });
    }

    const result = await importService.importCSV({
      orgId: req.params.id,
      csvText,
      mapping,
      userId: req.user.userId,
    });

    return res.json(result);
  } catch (err) {
    if (err.message.includes('not found') || err.message.includes('Not a member')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Import error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { previewCSV, importCSV };
