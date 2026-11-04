import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";

const router = express.Router();

const rateQuerySchema = z.object({
  category: z.enum(["ROOM", "VILLA"]).optional(),
});

router.get("/", async (req, res) => {
  const result = rateQuerySchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid category",
      errors: result.error.issues,
    });
  }

  try {
    const rates = await prisma.dailyRate.findMany({
      where: result.data.category
        ? {
            roomType: {
              category: result.data.category,
            },
          }
        : {},
      include: {
        roomType: {
          select: {
            category: true,
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
            category: "asc",
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

const createRateSchema = z.object({
  category: z.enum(["ROOM", "VILLA"]),
  price: z.coerce.number().positive().max(1000000),
  gstRate: z.coerce.number().min(0).max(100),
  effectiveDate: z.iso.date(),
});

router.post("/", async (req, res) => {
  const result = createRateSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid rate details",
      errors: result.error.issues,
    });
  }

  const { category, price, gstRate, effectiveDate } = result.data;

  try {
    const roomType = await prisma.roomType.findUnique({
      where: { category },
    });

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room category not found",
      });
    }

    const ratePlan = await prisma.ratePlan.findUnique({
      where: { name: "STANDARD" },
    });

    const rate = await prisma.dailyRate.upsert({
      where: {
        roomTypeId_ratePlanId_date: {
          roomTypeId: roomType.id,
          ratePlanId: ratePlan.id,
          date: new Date(`${effectiveDate}T00:00:00.000Z`),
        },
      },
      update: {
        price,
        gstRate,
      },
      create: {
        roomTypeId: roomType.id,
        ratePlanId: ratePlan.id,
        date: new Date(`${effectiveDate}T00:00:00.000Z`),
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
