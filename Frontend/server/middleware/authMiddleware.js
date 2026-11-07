const jwt = require("jsonwebtoken");
const User = require("../models/User");
const mongoose = require("mongoose");

const authMiddleware = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const token = header.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        message: "Invalid authentication token",
      });
    }

    const user = await User.findById(userId).select("_id status");

    if (!user) {
      return res.status(401).json({
        message: "Account not found",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Account suspended",
      });
    }

    req.userId = user._id.toString();
    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "CastError"
    ) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    next(error);
  }
};

module.exports = authMiddleware;