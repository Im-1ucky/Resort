import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

// CREATE AUTHENTICATION SESSION
function createSession(user, res) {
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("token", token, cookieOptions);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
  };
}

// REGISTER GUEST
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please sign in.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: "Guest",
        email: normalizedEmail,
        passwordHash,
        role: "GUEST",
      },
    });

    const safeUser = createSession(user, res);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: safeUser,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please sign in.",
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create your account",
    });
  }
});

// LOGIN
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        code: "EMAIL_NOT_FOUND",
        message: "No account found with this email.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact an administrator.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const safeUser = createSession(user, res);

    return res.json({
      success: true,
      message: "Login successful",
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});

// COMPLETE GUEST PROFILE
router.patch("/profile", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "GUEST") {
      return res.status(403).json({
        success: false,
        message: "Only guest accounts can update this profile",
      });
    }

    const { name, phone } = req.body ?? {};

    if (
      typeof name !== "string" ||
      typeof phone !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid name and phone number",
      });
    }

    const normalizedPhone = phone.replace(/[\s()-]/g, "");

    if (!/^\+?[1-9]\d{9,14}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid phone number",
      });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name.trim(),
        phone: normalizedPhone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    return res.json({
      success: true,
      message: "Profile completed successfully",
      user,
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update your profile",
    });
  }
});

// LOGOUT
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// CURRENT USER
router.get("/me", authenticate, (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset requests. Please try again later.",
  },
});

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// FORGOT PASSWORD
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body ?? {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email address is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, isActive: true },
    });

    let devResetUrl;

    if (user && user.isActive) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        }),
      ]);

      const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
      const resetUrl = `${clientUrl}/staff/reset-password?token=${rawToken}`;

      if (process.env.NODE_ENV !== "production") {
        console.log(`[Password Reset] ${user.email}: ${resetUrl}`);
        devResetUrl = resetUrl;
      }
      // Plug your SMTP / Resend email sender here using resetUrl
    }

    return res.json({
      success: true,
      message: "If an active account exists for that email, a password reset link has been sent.",
      ...(devResetUrl ? { resetUrl: devResetUrl } : {}),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process password reset request",
    });
  }
});

// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body ?? {};

    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 72 characters",
      });
    }

    const tokenHash = hashResetToken(token.trim());

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, isActive: true } } },
    });

    if (!record || record.usedAt || record.expiresAt <= new Date() || !record.user.isActive) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return res.json({
      success: true,
      message: "Password has been reset successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset password",
    });
  }
});

export default router;
