const User = require("../models/User");

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select(
      "role status"
    );

    if (!user || user.status !== "active") {
      return res.status(403).json({
        message: "Active account required",
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Administrator access required",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireAdmin;

// const authMiddleware = require("../middleware/authMiddleware");
// const requireAdmin = require("../middleware/requireAdmin");

// router.get(
//   "/admin-only-example",
//   authMiddleware,
//   requireAdmin,
//   async (req, res) => {
//     res.json({ message: "Admin access verified" });
//   }
// );