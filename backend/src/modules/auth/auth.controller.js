const authService = require('./auth.service');

const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax', // 'none' needed for cross-domain on Vercel
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

async function register(req, res) {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { user, accessToken, refreshToken } = await authService.registerUser({
      email,
      name,
      password,
    });

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    return res.status(201).json({ user, accessToken });
  } catch (err) {
    if (err.message === 'Email already registered') {
      return res.status(409).json({ error: err.message });
    }
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { user, accessToken, refreshToken } = await authService.loginUser({
      email,
      password,
    });

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    return res.json({ user, accessToken });
  } catch (err) {
    if (err.message === 'Invalid email or password') {
      return res.status(401).json({ error: err.message });
    }
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function refresh(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const { accessToken, user } = await authService.refreshAccessToken(refreshToken);
    return res.json({ accessToken, user });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}

async function logout(req, res) {
  res.clearCookie('refreshToken');
  return res.json({ message: 'Logged out' });
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await authService.forgotPassword(email);

    return res.json({
      message: 'A password reset link has been sent to your email.',
    });
  } catch (err) {
    if (err.message === 'No account found with this email') {
      return res.status(404).json({ error: err.message });
    }
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    await authService.resetPassword(token, password);
    return res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }
    if (err.name === 'JsonWebTokenError' || err.message === 'Invalid token purpose') {
      return res.status(400).json({ error: 'Invalid reset link.' });
    }
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword };
