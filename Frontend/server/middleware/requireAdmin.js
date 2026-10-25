const User = require('../models/User');

// Use this AFTER authMiddleware. Only lets active admins through.
const requireAdmin = async (req, res, next) => {
  try {
    // Role is always read from the database, never from the token or the browser
    const user = await User.findById(req.userId).select('role status');

    if (!user || user.role !== 'admin' || user.status === 'suspended') {
      return res.status(403).json({ message: 'Administrator access required' });
    }

    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = requireAdmin;