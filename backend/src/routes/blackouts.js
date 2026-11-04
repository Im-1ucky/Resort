import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";

const router = Router();

const dateSchema = z.iso.date();

// GET /api/blackouts
// Optional filters: startDate, endDate, roomTypeId
router.get("/", async (req, res) => {
  try {
    const querySchema = z.object({
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional(),
      roomTypeId: z.uuid().optional(),
    });

    const parsed = querySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.issues,
      });
    }

    const { startDate, endDate, roomTypeId } = parsed.data;

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate cannot be after endDate",
      });
    }

    const blackouts = await prisma.blackoutDate.findMany({
      where: {
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate && { gte: new Date(`${startDate}T00:00:00.000Z`) }),
                ...(endDate && { lte: new Date(`${endDate}T00:00:00.000Z`) }),
              },
            }
          : {}),
        ...(roomTypeId
          ? {
              OR: [{ roomTypeId }, { roomTypeId: null }],
            }
          : {}),
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: "asc" },
    });

    return res.json({
      success: true,
      count: blackouts.length,
      blackouts,
    });
  } catch (error) {
    console.error("Get blackouts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch blackout dates",
    });
  }
});

// POST /api/blackouts
// roomTypeId omitted or null = property-wide blackout
router.post("/", async (req, res) => {
  try {
    const bodySchema = z.object({
      date: dateSchema,
      roomTypeId: z.uuid().nullable().optional(),
    });

    const parsed = bodySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.issues,
      });
    }

    const { date, roomTypeId = null } = parsed.data;
    const blackoutDate = new Date(`${date}T00:00:00.000Z`);

    if (roomTypeId) {
      const roomType = await prisma.roomType.findUnique({
        where: { id: roomTypeId },
      });

      if (!roomType) {
        return res.status(404).json({
          success: false,
          message: "Room category not found",
        });
      }
    }

    // Prevent duplicate property-wide blackouts as well.
    const existing = await prisma.blackoutDate.findFirst({
      where: {
        date: blackoutDate,
        roomTypeId,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A blackout already exists for this date and category",
      });
    }

    const blackout = await prisma.blackoutDate.create({
      data: {
        date: blackoutDate,
        roomTypeId,
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Blackout date created successfully",
      blackout,
    });
  } catch (error) {
    console.error("Create blackout error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create blackout date",
    });
  }
});

// DELETE /api/blackouts/:id
router.delete("/:id", async (req, res) => {
  try {
    const idSchema = z.uuid();
    const parsed = idSchema.safeParse(req.params.id);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid blackout ID",
      });
    }

    const existing = await prisma.blackoutDate.findUnique({
      where: { id: parsed.data },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Blackout date not found",
      });
    }

    await prisma.blackoutDate.delete({
      where: { id: parsed.data },
    });

    return res.json({
      success: true,
      message: "Blackout date deleted successfully",
    });
  } catch (error) {
    console.error("Delete blackout error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete blackout date",
    });
  }
});

export default router;
