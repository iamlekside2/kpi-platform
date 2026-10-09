const usersService = require('./users.service');

async function getProfile(req, res) {
  try {
    const profile = await usersService.getProfile(req.user.userId);
    return res.json(profile);
  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ error: err.message });
    }
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateProfile(req, res) {
  try {
    const { name, integrationEmail } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (integrationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(integrationEmail.trim())) {
      return res.status(400).json({ error: 'Integration email is not a valid email address' });
    }

    const user = await usersService.updateProfile(req.user.userId, { name: name.trim(), integrationEmail });
    return res.json(user);
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    await usersService.changePassword(req.user.userId, currentPassword, newPassword);
    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    if (err.message === 'Current password is incorrect') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getProfile, updateProfile, changePassword };
