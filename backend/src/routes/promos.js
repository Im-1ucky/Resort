import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";

const router = express.Router();

const promoSchema = z.object({
  code: z.string().trim().min(3).max(30).transform((v) => v.toUpperCase()),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive(),
  minBookingAmount: z.number().min(0).default(0),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  maxUses: z.number().int().positive().nullable().optional(),
}).refine((data) => data.expiresAt > data.startsAt, {
  message: "Expiry must be after the start date",
  path: ["expiresAt"],
}).refine((data) => {
  return data.discountType !== "PERCENTAGE" || data.discountValue <= 100;
}, {
  message: "Percentage discount cannot exceed 100%",
  path: ["discountValue"],
});

// Create promo code
router.post("/", async (req, res) => {
  try {
    const parsed = promoSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid promo code details",
        errors: parsed.error.issues,
      });
    }

    const promo = await prisma.promoCode.create({
      data: parsed.data,
    });

    return res.status(201).json({
      message: "Promo code created successfully",
      promo,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "Promo code already exists",
      });
    }

    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// List promo codes
router.get("/", async (req, res) => {
  try {
    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
    });

    return res.json({ promos });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Validate promo code
router.post("/validate", async (req, res) => {
  try {
    const schema = z.object({
      code: z.string().trim().min(1),
      bookingAmount: z.number().positive(),
    });

    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid validation details",
        errors: parsed.error.issues,
      });
    }

    const { code, bookingAmount } = parsed.data;

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promo || !promo.isActive) {
      return res.status(404).json({ message: "Invalid promo code" });
    }

    const now = new Date();

    if (now < promo.startsAt || now > promo.expiresAt) {
      return res.status(400).json({
        message: "Promo code is not currently valid",
      });
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({
        message: "Promo code usage limit reached",
      });
    }

    if (bookingAmount < Number(promo.minBookingAmount)) {
      return res.status(400).json({
        message: `Minimum booking amount is ₹${promo.minBookingAmount}`,
      });
    }

    const discount =
      promo.discountType === "PERCENTAGE"
        ? (bookingAmount * Number(promo.discountValue)) / 100
        : Number(promo.discountValue);

    return res.json({
      message: "Promo code applied successfully",
      code: promo.code,
      discount: Math.min(discount, bookingAmount),
      finalAmount: Math.max(0, bookingAmount - discount),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
