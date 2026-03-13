const templatesService = require('./templates.service');

async function listTemplates(req, res) {
  const templates = templatesService.getAllTemplates();
  return res.json(templates);
}

async function applyTemplate(req, res) {
  try {
    const { templateKeys } = req.body;

    if (!templateKeys || !Array.isArray(templateKeys) || templateKeys.length === 0) {
      return res.status(400).json({ error: 'templateKeys (array) is required' });
    }

    const org = await templatesService.applyTemplates({
      orgId: req.params.id,
      templateKeys,
      userId: req.user.userId,
    });

    return res.json(org);
  } catch (err) {
    if (err.message.startsWith('Template not found') || err.message === 'Only admins can apply templates') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Apply template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listTemplates, applyTemplate };
