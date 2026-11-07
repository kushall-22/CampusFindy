const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const validEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const MAX_EMAIL_VERIFICATION_ATTEMPTS = 5;

const hashVerificationCode = (code) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(code)
    .digest("hex");

async function sendVerificationCode(user, mailer) {
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashVerificationCode(code);

  user.emailVerificationCodeHash = codeHash;
  user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
  user.emailVerificationAttempts = 0;
  await user.save();

  try {
    await mailer.transporter.sendMail({
      from: mailer.from,
      to: user.email,
      subject: "Your CampusFindy verification code",
      text: `Your CampusFindy verification code is ${code}. It expires in 10 minutes. If you did not create this account, you can ignore this email.`,
      html: `<p>Your CampusFindy verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>It expires in 10 minutes. If you did not create this account, you can ignore this email.</p>`,
    });
  } catch (error) {
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerificationAttempts = 0;
    await user.save();
    throw error;
  }

  return codeHash;
}

function getAuthMailer() {
  const port = Number(process.env.SMTP_PORT);
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const frontendOrigin = (
    process.env.FRONTEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    ""
  )
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

  if (
    !process.env.SMTP_HOST ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !from
  ) {
    return null;
  }

  let resetPage;
  try {
    resetPage = new URL(
      process.env.PASSWORD_RESET_URL ||
        `${frontendOrigin}/reset-password.html`
    );
  } catch {
    return null;
  }

  const isSafePageUrl = (url) =>
    ["http:", "https:"].includes(url.protocol) &&
    !url.username &&
    !url.password;

  if (!isSafePageUrl(resetPage)) {
    return null;
  }

  return {
    from,
    resetPage,
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    }),
  };
}

// Signup
router.post("/signup", async (req, res, next) => {
  try {
    const { name, password } = req.body || {};
    const email = normalizeEmail(req.body?.email);

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 80
    ) {
      return res.status(400).json({
        message: "Name must be between 2 and 80 characters",
      });
    }

    if (!validEmail(email) || email.length > 254) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        message: "Password must be between 8 and 72 characters",
      });
    }

    const mailer = getAuthMailer();
    if (!mailer) {
      return res.status(503).json({
        message: "Signup email verification is not configured on the server.",
      });
    }

    const existingUser = await User.findOne({ email }).lean();

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Role is intentionally not accepted from the request.
    const user = await User.create({
      name: name.trim(),
      email,
      password: hashedPassword,
      emailVerified: false,
    });

    try {
      await sendVerificationCode(user, mailer);
    } catch (error) {
      await User.deleteOne({
        _id: user._id,
        emailVerified: false,
      });
      return next(error);
    }

    return res.status(201).json({
      message: "Account created. Check your email for the verification code before logging in.",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    next(error);
  }
});

router.post("/verify-email", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { code } = req.body || {};
    if (!validEmail(email) || email.length > 254) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        message: "Enter the 6-digit verification code from your email.",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        email,
        emailVerified: false,
        emailVerificationCodeHash: hashVerificationCode(code),
        emailVerificationExpires: { $gt: new Date() },
        $or: [
          { emailVerificationAttempts: { $lt: MAX_EMAIL_VERIFICATION_ATTEMPTS } },
          { emailVerificationAttempts: { $exists: false } },
        ],
      },
      {
        $set: { emailVerified: true },
        $unset: {
          emailVerificationCodeHash: "",
          emailVerificationExpires: "",
          emailVerificationAttempts: "",
        },
      },
      { new: true, runValidators: true }
    ).select("_id name email role status");

    if (!user) {
      await User.updateOne(
        {
          email,
          emailVerified: false,
          emailVerificationExpires: { $gt: new Date() },
          $or: [
            { emailVerificationAttempts: { $lt: MAX_EMAIL_VERIFICATION_ATTEMPTS } },
            { emailVerificationAttempts: { $exists: false } },
          ],
        },
        { $inc: { emailVerificationAttempts: 1 } }
      );

      return res.status(400).json({
        message: "The code is incorrect, expired, or has too many attempts. Request a new code.",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Your account cannot be signed in. Please contact an administrator.",
      });
    }

    const sessionToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Email verified. You can now log in.",
      token: sessionToken,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/resend-verification", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email) || email.length > 254) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    const mailer = getAuthMailer();
    if (!mailer) {
      return res.status(503).json({
        message: "Signup email verification is not configured on the server.",
      });
    }

    const user = await User.findOne({ email, emailVerified: false });
    if (user) {
      await sendVerificationCode(user, mailer);
    }

    return res.json({
      message: "If an unverified account exists for that email, a verification code has been sent.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/feedback", authMiddleware, async (req, res, next) => {
  try {
    const { category, message } = req.body || {};
    const validCategories = ["suggestion", "problem", "general"];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        message: "Choose a valid feedback category.",
      });
    }

    if (
      typeof message !== "string" ||
      message.trim().length < 10 ||
      message.trim().length > 2000
    ) {
      return res.status(400).json({
        message: "Feedback must be between 10 and 2000 characters.",
      });
    }

    const mailer = getAuthMailer();
    if (!mailer) {
      return res.status(503).json({
        message: "Feedback email is not configured on the server.",
      });
    }

    const user = await User.findById(req.userId).select("name email");
    if (!user) {
      return res.status(401).json({
        message: "Account not found. Please sign in again.",
      });
    }

    await mailer.transporter.sendMail({
      from: mailer.from,
      to: process.env.FEEDBACK_TO || process.env.SMTP_USER,
      replyTo: user.email,
      subject: `CampusFindy feedback: ${category}`,
      text: [
        `Category: ${category}`,
        `From: ${user.name} <${user.email}>`,
        "",
        message.trim(),
      ].join("\n"),
    });

    return res.json({
      message: "Thanks for your feedback. It was sent to the CampusFindy team.",
    });
  } catch (error) {
    next(error);
  }
});

// Request a password-reset link without revealing whether the email is registered.
router.post("/forgot-password", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!validEmail(email) || email.length > 254) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    const mailer = getAuthMailer();
    if (!mailer) {
      return res.status(503).json({
        message: "Password reset email is not configured on the server.",
      });
    }

    const user = await User.findOne({ email });
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.passwordResetTokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const resetUrl = new URL(mailer.resetPage);
      resetUrl.searchParams.set("token", resetToken);

      try {
        await mailer.transporter.sendMail({
          from: mailer.from,
          to: user.email,
          subject: "Reset your CampusFindy password",
          text: `Use this link within one hour to reset your CampusFindy password:\n\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
          html: `<p>Use the link below within one hour to reset your CampusFindy password.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
        });
      } catch (error) {
        user.passwordResetTokenHash = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        return next(error);
      }
    }

    return res.json({
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
});

// Consume a single-use password-reset token.
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^[a-f\d]{64}$/i.test(token) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        message: "Use a valid reset link and a password between 8 and 72 characters.",
      });
    }

    const passwordResetTokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.findOneAndUpdate(
      {
        passwordResetTokenHash,
        passwordResetExpires: { $gt: new Date() },
      },
      {
        $set: { password: hashedPassword },
        $unset: {
          passwordResetTokenHash: "",
          passwordResetExpires: "",
        },
      },
      { new: true, runValidators: true }
    ).select("_id");

    if (!user) {
      return res.status(400).json({
        message: "This password reset link is invalid or has expired. Request a new one.",
      });
    }

    return res.json({
      message: "Your password has been reset. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post("/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (
      !validEmail(email) ||
      typeof password !== "string" ||
      password.length > 72
    ) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "Your account is suspended",
      });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({
        message: "Verify your email address before logging in.",
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      token,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
});

// Current user
router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select(
      "name email role status"
    );

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;