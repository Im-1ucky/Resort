
import express from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

const promoValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many promo validation attempts. Please try again later.",
  },
});

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
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
    try {
      const parsed = promoSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid promo code details",
          errors: parsed.error.issues,
        });
      }

      const promo = await prisma.promoCode.create({
        data: parsed.data,
      });

      return res.status(201).json({
        success: true,
        message: "Promo code created successfully",
        promo,
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "Promo code already exists",
        });
      }

      console.error("Create promo error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// List promo codes
router.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
    try {
      const promos = await prisma.promoCode.findMany({
        orderBy: { createdAt: "desc" },
      });

      return res.json({
        success: true,
        promos,
      });
    } catch (error) {
      console.error("List promos error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Validate promo code
router.post(
  "/validate",
  promoValidationLimiter,
  async (req, res) => {
    try {
      const schema = z.object({
        code: z.string().trim().min(1).max(30),
        bookingAmount: z.number().positive().finite(),
      });

      const parsed = schema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid validation details",
          errors: parsed.error.issues,
        });
      }

      const { code, bookingAmount } = parsed.data;

      const promo = await prisma.promoCode.findUnique({
        where: { code: code.toUpperCase() },
      });

      const invalidResponse = () =>
        res.status(400).json({
          success: false,
          message: "This promo code cannot be applied",
        });

      if (!promo || !promo.isActive) {
        return invalidResponse();
      }

      const now = new Date();

      if (now < promo.startsAt || now > promo.expiresAt) {
        return invalidResponse();
      }

      if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
        return invalidResponse();
      }

      if (bookingAmount < Number(promo.minBookingAmount)) {
        return invalidResponse();
      }

      const discount =
        promo.discountType === "PERCENTAGE"
          ? (bookingAmount * Number(promo.discountValue)) / 100
          : Number(promo.discountValue);

      const finalDiscount = Math.min(discount, bookingAmount);

      return res.json({
        success: true,
        message: "Promo code applied successfully",
        code: promo.code,
        discount: finalDiscount,
        finalAmount: bookingAmount - finalDiscount,
      });
    } catch (error) {
      console.error("Validate promo error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Enable or disable a promo code
router.patch(
  "/:id/status",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
    try {
      const schema = z.object({
        isActive: z.boolean(),
      });

      const parsed = schema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid promo status",
        });
      }

      const result = await prisma.promoCode.updateMany({
        where: { id: req.params.id },
        data: { isActive: parsed.data.isActive },
      });

      if (result.count === 0) {
        return res.status(404).json({
          success: false,
          message: "Promo code not found",
        });
      }

      const promo = await prisma.promoCode.findUnique({
        where: { id: req.params.id },
      });

      return res.json({
        success: true,
        message: `Promo code ${promo.isActive ? "enabled" : "disabled"} successfully`,
        promo,
      });
    } catch (error) {
      console.error("Update promo status error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

export default router;
