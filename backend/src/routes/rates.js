import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// GET /api/rates?roomTypeId=<id>
const rateQuerySchema = z.object({
  roomTypeId: z.string().uuid().optional(),
});

router.get("/", async (req, res) => {
  const result = rateQuerySchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid room type ID",
      errors: result.error.issues,
    });
  }

  try {
    const rates = await prisma.dailyRate.findMany({
      where: result.data.roomTypeId
        ? { roomTypeId: result.data.roomTypeId }
        : {},
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
        ratePlan: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        {
          roomType: {
            name: "asc",
          },
        },
        {
          date: "asc",
        },
      ],
    });

    return res.status(200).json({
      success: true,
      count: rates.length,
      rates,
    });
  } catch (error) {
    console.error("Fetching rates failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch rates",
    });
  }
});

// POST /api/rates
const createRateSchema = z.object({
  roomTypeId: z.string().uuid(),
  price: z.coerce.number().positive().max(1000000),
  gstRate: z.coerce.number().min(0).max(100),
  effectiveDate: z.iso.date(),
});

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
  const result = createRateSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid rate details",
      errors: result.error.issues,
    });
  }

  const { roomTypeId, price, gstRate, effectiveDate } = result.data;

  try {
    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room category not found",
      });
    }

    const ratePlan = await prisma.ratePlan.upsert({
      where: { name: "STANDARD" },
      update: {},
      create: { name: "STANDARD" },
    });

    const date = new Date(`${effectiveDate}T00:00:00.000Z`);

    const rate = await prisma.dailyRate.upsert({
      where: {
        roomTypeId_ratePlanId_date: {
          roomTypeId: roomType.id,
          ratePlanId: ratePlan.id,
          date,
        },
      },
      update: {
        price,
        gstRate,
      },
      create: {
        roomTypeId: roomType.id,
        ratePlanId: ratePlan.id,
        date,
        price,
        gstRate,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Rate saved successfully",
      rate,
    });
  } catch (error) {
    console.error("Creating rate failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save rate",
    });
  }
});

export default router;
