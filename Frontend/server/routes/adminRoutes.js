const express = require("express");
const ClaimRequest = require("../models/ClaimRequest");
const Item = require("../models/Item");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const isValidId = require("../utils/isValidId");

const router = express.Router();

router.use(authMiddleware, requireAdmin);

router.get("/dashboard", async (req, res, next) => {
  try {
    const [
      totalStudents,
      totalLostReports,
      totalFoundReports,
      pendingClaims,
      returnedItems,
      recentUsers,
      recentItems,
      recentClaims,
    ] = await Promise.all([
      User.countDocuments({ role: "student" }),
      Item.countDocuments({ status: "lost" }),
      Item.countDocuments({ status: "found" }),
      ClaimRequest.countDocuments({ status: "pending" }),
      Item.countDocuments({ claimed: true }),
      User.find({ role: "student" })
        .select("name createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Item.find()
        .select("title status postedBy createdAt")
        .populate("postedBy", "name")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      ClaimRequest.find()
        .select("status claimant item updatedAt")
        .populate("claimant", "name")
        .populate("item", "title")
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const recentActivity = [
      ...recentUsers.map((user) => ({
        id: `user-${user._id}`,
        at: user.createdAt,
        message: `${user.name} registered as a student`,
      })),
      ...recentItems.map((item) => ({
        id: `item-${item._id}`,
        at: item.createdAt,
        message: `${item.postedBy?.name || "A student"} reported a ${item.status} item: ${item.title}`,
      })),
      ...recentClaims.map((claim) => ({
        id: `claim-${claim._id}`,
        at: claim.updatedAt,
        message:
          claim.status === "pending"
            ? `${claim.claimant?.name || "A student"} submitted a claim for ${claim.item?.title || "an item"}`
            : `${claim.claimant?.name || "A student"}'s claim for ${claim.item?.title || "an item"} was ${claim.status}`,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 12);

    return res.json({
      totalStudents,
      totalLostReports,
      totalFoundReports,
      totalReports: totalLostReports + totalFoundReports,
      pendingClaims,
      returnedItems,
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/items", async (req, res, next) => {
  try {
    const items = await Item.find()
      .select("-contactInfo -verificationAnswer -verificationQuestion")
      .populate("postedBy", "name")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json(items);
  } catch (error) {
    next(error);
  }
});

router.patch("/items/:id/state", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { state } = req.body || {};

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    if (!["removed", "restore"].includes(state)) {
      return res.status(400).json({
        message: "State must be removed or restore",
      });
    }

    const item = await Item.findById(id);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (state === "removed") {
      if (item.state === "removed") {
        return res.status(409).json({ message: "Item is already removed" });
      }

      const approvedClaim = await ClaimRequest.exists({
        item: item._id,
        status: "approved",
      });

      if (approvedClaim) {
        return res.status(409).json({
          message: "Resolve the approved claim before removing this listing",
        });
      }

      item.state = "removed";
      await item.save();

      await ClaimRequest.updateMany(
        { item: item._id, status: "pending" },
        { $set: { status: "rejected" } }
      );
    } else {
      if (item.state !== "removed") {
        return res.status(409).json({ message: "Item is not removed" });
      }

      item.state = item.claimed ? "closed" : "open";
      await item.save();
    }

    return res.json({
      message: state === "removed" ? "Listing removed" : "Listing restored",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const users = await User.find()
      .select("name email role status createdAt")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json(users);
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({
        message: "Status must be active or suspended",
      });
    }

    if (id === req.userId) {
      return res.status(403).json({
        message: "You cannot change your own account status",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        message: "Administrator accounts cannot be changed here",
      });
    }

    user.status = status;
    await user.save();

    return res.json({
      message: status === "suspended" ? "Account suspended" : "Account reactivated",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
