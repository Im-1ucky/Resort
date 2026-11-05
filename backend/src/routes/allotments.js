import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// GET /api/allotments
const querySchema = z.object({
  roomTypeId: z.string().uuid().optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
}).refine(
  (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  { message: "Start date must be before or equal to end date" }
);

router.get(
  "/",
  authenticate,
  authorize("ADMIN", "RESERVATIONS", "GM"),
  async (req, res) => {
  const result = querySchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid allotment filters",
      errors: result.error.issues,
    });
  }

  const { roomTypeId, startDate, endDate } = result.data;

  try {
    const allotments = await prisma.websiteAllotment.findMany({
      where: {
        ...(roomTypeId && { roomTypeId }),
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate && {
                  gte: new Date(`${startDate}T00:00:00.000Z`),
                }),
                ...(endDate && {
                  lte: new Date(`${endDate}T00:00:00.000Z`),
                }),
              },
            }
          : {}),
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            totalUnits: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { roomType: { name: "asc" } }],
    });

    return res.status(200).json({
      success: true,
      count: allotments.length,
      allotments,
    });
  } catch (error) {
    console.error("Fetching allotments failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch allotments",
    });
  }
});

// PUT /api/allotments
const updateSchema = z.object({
  roomTypeId: z.string().uuid(),
  date: z.iso.date(),
  allottedUnits: z.number().int().min(0).max(1000),
});

router.put(
  "/",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
  const result = updateSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid allotment details",
      errors: result.error.issues,
    });
  }

  const { roomTypeId, date: dateString, allottedUnits } = result.data;
  const date = new Date(`${dateString}T00:00:00.000Z`);

  try {
    const allotment = await prisma.$transaction(async (tx) => {
      // Use the same lock as booking creation to prevent races.
      const roomTypes = await tx.$queryRaw`
        SELECT "id"
        FROM "RoomType"
        WHERE "id" = ${roomTypeId}
        FOR UPDATE
      `;

      if (roomTypes.length === 0) {
        return { error: "ROOM_TYPE_NOT_FOUND" };
      }

      const roomType = await tx.roomType.findUnique({
        where: { id: roomTypeId },
      });

      if (!roomType.isActive) {
        return { error: "ROOM_TYPE_INACTIVE" };
      }

      const activeRoomCount = await tx.room.count({
        where: {
          roomTypeId,
          isActive: true,
        },
      });

      if (allottedUnits > activeRoomCount) {
        return {
          error: "ALLOTMENT_EXCEEDS_INVENTORY",
          activeRoomCount,
        };
      }

      // Count rooms already committed for this night.
      const bookings = await tx.bookingItem.findMany({
        where: {
          roomTypeId,
          booking: {
            checkIn: { lte: date },
            checkOut: { gt: date },
            OR: [
              { status: "CONFIRMED" },
              {
                status: "PENDING_PAYMENT",
                holdExpiresAt: { gt: new Date() },
              },
            ],
          },
        },
        select: {
          quantity: true,
        },
      });

      const bookedUnits = bookings.reduce(
        (total, item) => total + item.quantity,
        0
      );

      if (allottedUnits < bookedUnits) {
        return {
          error: "ALLOTMENT_BELOW_BOOKED",
          bookedUnits,
        };
      }

      return tx.websiteAllotment.upsert({
        where: {
          roomTypeId_date: {
            roomTypeId,
            date,
          },
        },
        update: { allottedUnits },
        create: {
          roomTypeId,
          date,
          allottedUnits,
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
    });

    if (allotment.error === "ROOM_TYPE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Room category not found",
      });
    }

    if (allotment.error === "ROOM_TYPE_INACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Cannot allot an inactive room category",
      });
    }

    if (allotment.error === "ALLOTMENT_EXCEEDS_INVENTORY") {
      return res.status(400).json({
        success: false,
        message: "Allotment cannot exceed active physical rooms",
        activeRoomCount: allotment.activeRoomCount,
      });
    }

    if (allotment.error === "ALLOTMENT_BELOW_BOOKED") {
      return res.status(409).json({
        success: false,
        message: "Allotment cannot be lower than already booked units",
        bookedUnits: allotment.bookedUnits,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Website allotment saved successfully",
      allotment,
    });
  } catch (error) {
    console.error("Updating allotment failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to save allotment",
    });
  }
});

export default router;
