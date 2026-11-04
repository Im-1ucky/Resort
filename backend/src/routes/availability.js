import { z } from "zod";
import express from "express";
import prisma from "../lib/prisma.js";

const availabilityQuerySchema = z
  .object({
    checkIn: z.iso.date(),
    checkOut: z.iso.date(),
    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20).default(0),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  })
  .refine(
    (data) => data.checkIn >= new Date().toISOString().slice(0, 10),
    {
      message: "Check-in cannot be in the past",
      path: ["checkIn"],
    }
  );

const router = express.Router();

router.get("/", async (req, res) => {
  const result = availabilityQuerySchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid search parameters",
      errors: result.error.issues,
    });
  }

  const { checkIn, checkOut, adults, children } = result.data;

  const startDate = new Date(`${checkIn}T00:00:00.000Z`);
  const endDate = new Date(`${checkOut}T00:00:00.000Z`);
  const now = new Date();

  try {
    const roomTypes = await prisma.roomType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    const suitableRoomTypes = roomTypes.filter(
      (roomType) => roomType.maxGuests >= adults + children
    );

    const roomTypeIds = suitableRoomTypes.map((type) => type.id);

    const [allotments, bookings] = await Promise.all([
      prisma.websiteAllotment.findMany({
        where: {
          roomTypeId: { in: roomTypeIds },
          date: { gte: startDate, lt: endDate },
        },
      }),

      prisma.booking.findMany({
        where: {
          checkIn: { lt: endDate },
          checkOut: { gt: startDate },
          OR: [
            { status: "CONFIRMED" },
            {
              status: "PENDING_PAYMENT",
              holdExpiresAt: { gt: now },
            },
          ],
        },
        include: {
          items: true,
          roomAssignments: {
            include: {
              room: true,
            },
          },
        },
      }),
    ]);

    // Do not advertise inventory if an existing active booking
    // has not yet received all its required physical rooms.
    for (const booking of bookings) {
      for (const item of booking.items) {
        const assignedCount = booking.roomAssignments.filter(
          (assignment) =>
            assignment.room.roomTypeId === item.roomTypeId
        ).length;

        if (assignedCount < item.quantity) {
          return res.status(409).json({
            success: false,
            message:
              "Existing bookings need physical room assignments before availability can be displayed. Please contact reservations.",
          });
        }
      }
    }

    const availableRoomTypes = await Promise.all(
      suitableRoomTypes.map(async (roomType) => {
        // Find physical rooms that are free for the entire stay.
        const availableRooms = await prisma.room.findMany({
          where: {
            roomTypeId: roomType.id,
            isActive: true,
            assignments: {
              none: {
                booking: {
                  checkIn: { lt: endDate },
                  checkOut: { gt: startDate },
                  OR: [
                    { status: "CONFIRMED" },
                    {
                      status: "PENDING_PAYMENT",
                      holdExpiresAt: { gt: now },
                    },
                  ],
                },
              },
            },
          },
          orderBy: { roomNumber: "asc" },
          select: { id: true },
        });

        const categoryBookings = bookings.flatMap((booking) =>
          booking.items
            .filter((item) => item.roomTypeId === roomType.id)
            .map((item) => ({
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              quantity: item.quantity,
            }))
        );

        const categoryAllotments = allotments.filter(
          (item) => item.roomTypeId === roomType.id
        );

        let minimumAllotmentAvailability = roomType.totalUnits;

        // Check website allotment for every night.
        for (
          let night = new Date(startDate);
          night < endDate;
          night.setUTCDate(night.getUTCDate() + 1)
        ) {
          const bookedUnits = categoryBookings
            .filter(
              (booking) =>
                booking.checkIn <= night &&
                booking.checkOut > night
            )
            .reduce((total, booking) => total + booking.quantity, 0);

          const allotment = categoryAllotments.find(
            (item) => item.date.getTime() === night.getTime()
          );

          const allottedUnits =
            allotment?.allottedUnits ?? roomType.totalUnits;

          const availableUnits = Math.max(
            0,
            allottedUnits - bookedUnits
          );

          minimumAllotmentAvailability = Math.min(
            minimumAllotmentAvailability,
            availableUnits
          );
        }

        return {
          id: roomType.id,
          name: roomType.name,
          maxGuests: roomType.maxGuests,
          totalUnits: roomType.totalUnits,
          isActive: roomType.isActive,
          availableUnits: Math.min(
            availableRooms.length,
            minimumAllotmentAvailability
          ),
        };
      })
    );

    return res.status(200).json({
      success: true,
      search: {
        checkIn,
        checkOut,
        adults,
        children,
      },
      roomTypes: availableRoomTypes,
    });
  } catch (error) {
    console.error("Availability search failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to check availability",
    });
  }
});

export default router;
