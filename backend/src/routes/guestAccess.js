
import express from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import prisma from "../lib/prisma.js";

const router = express.Router();

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const requestSchema = z.object({
  identifier: z.string().trim().min(5).max(254),
});

const verifySchema = z.object({
  identifier: z.string().trim().min(5).max(254),
  otp: z.string().regex(/^\d{6}$/),
});

function normalizeIdentifier(value) {
  return value.includes("@")
    ? value.trim().toLowerCase()
    : value.trim();
}

function hashOtp(identifier, otp) {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`${identifier}:${otp}`)
    .digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");

  return left.length === right.length &&
    crypto.timingSafeEqual(left, right);
}

function guestTokenAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Guest verification required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "resort-api",
    });

    if (decoded.scope !== "guest-bookings" || !decoded.identifier) {
      return res.status(401).json({
        success: false,
        message: "Invalid guest access token",
      });
    }

    req.guestIdentifier = decoded.identifier;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Guest access expired. Please verify again.",
    });
  }
}

// REQUEST OTP
router.post("/otp/request", otpRequestLimiter, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address or phone number",
    });
  }

  const identifier = normalizeIdentifier(parsed.data.identifier);

  try {
    const isEmail = identifier.includes("@");

    const booking = await prisma.booking.findFirst({
      where: isEmail
        ? {
            guestEmail: {
              equals: identifier,
              mode: "insensitive",
            },
          }
        : { guestPhone: identifier },
      select: { id: true },
    });

    // Always return the same public message.
    if (!booking) {
      return res.json({
        success: true,
        message: "If bookings exist for these details, an OTP has been generated.",
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashOtp(identifier, otp);

    await prisma.$transaction([
      prisma.guestOtpChallenge.deleteMany({
        where: { identifier },
      }),
      prisma.guestOtpChallenge.create({
        data: {
          identifier,
          codeHash,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      }),
    ]);

    const response = {
      success: true,
      message: "If bookings exist for these details, an OTP has been generated.",
    };

    // Simulated delivery for local/demo use only.
    if (process.env.NODE_ENV !== "production") {
      response.demoOtp = otp;
    }

    return res.json(response);
  } catch (error) {
    console.error("Guest OTP request failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process OTP request",
    });
  }
});

// VERIFY OTP
router.post("/otp/verify", otpVerifyLimiter, async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid verification details",
    });
  }

  const identifier = normalizeIdentifier(parsed.data.identifier);

  try {
    const challenge = await prisma.guestOtpChallenge.findFirst({
      where: {
        identifier,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: 5 },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge) {
      return res.status(400).json({
        success: false,
        message: "OTP is invalid or expired. Request a new one.",
      });
    }

    // Count every verification attempt.
    await prisma.guestOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });

    const suppliedHash = hashOtp(identifier, parsed.data.otp);

    if (!safeEqual(suppliedHash, challenge.codeHash)) {
      return res.status(400).json({
        success: false,
        message: "Incorrect OTP",
      });
    }

    await prisma.guestOtpChallenge.update({
      where: { id: challenge.id },
      data: { verifiedAt: new Date() },
    });

    const guestToken = jwt.sign(
      {
        scope: "guest-bookings",
        identifier,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
        issuer: "resort-api",
      }
    );

    return res.json({
      success: true,
      message: "Guest verification successful",
      guestToken,
      expiresIn: 900,
    });
  } catch (error) {
    console.error("Guest OTP verification failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify OTP",
    });
  }
});

// VIEW VERIFIED GUEST BOOKINGS
router.get("/bookings", guestTokenAuth, async (req, res) => {
  try {
    const identifier = req.guestIdentifier;
    const isEmail = identifier.includes("@");

    const bookings = await prisma.booking.findMany({
      where: isEmail
        ? {
            guestEmail: {
              equals: identifier,
              mode: "insensitive",
            },
          }
        : { guestPhone: identifier },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        adults: true,
        children: true,
        subtotal: true,
        gstAmount: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            totalAmount: true,
            roomType: {
              select: { name: true },
            },
          },
        },
      },
    });

    return res.json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("Guest booking lookup failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve bookings",
    });
  }
});

export default router;
