
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

const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

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
    // Fetch active room categories.
    const roomTypes = await prisma.roomType.findMany({
      where: { isActive: true },
    });

    // Only categories that can accommodate the guests.
    const suitableRoomTypes = roomTypes.filter(
      (roomType) => roomType.maxGuests >= adults + children
    );

    const roomTypeIds = suitableRoomTypes.map((type) => type.id);

    // Fetch inventory, bookings, blackouts and STANDARD rates.
    const [allotments, bookings, blackouts, rates] =
      await Promise.all([
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

        prisma.blackoutDate.findMany({
          where: {
            date: { gte: startDate, lt: endDate },
            OR: [
              { roomTypeId: null },
              { roomTypeId: { in: roomTypeIds } },
            ],
          },
        }),

        prisma.dailyRate.findMany({
          where: {
            roomTypeId: { in: roomTypeIds },
            date: { gte: startDate, lt: endDate },
            ratePlan: {
              is: { name: "STANDARD" },
            },
          },
          select: {
            roomTypeId: true,
            date: true,
            price: true,
            gstRate: true,
          },
        }),
      ]);

    // Do not advertise inventory if an existing active booking
    // has not received all its required physical room assignments.
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

    // Index rates by room category and date for quick lookup.
    const rateMap = new Map();

    for (const rate of rates) {
      const dateKey = rate.date.toISOString().slice(0, 10);
      rateMap.set(`${rate.roomTypeId}:${dateKey}`, rate);
    }

    // Calculate the price for one unit of a room category.
    const calculatePricing = (roomTypeId) => {
      let baseTotal = 0;
      let gstTotal = 0;
      const nightlyRates = [];

      for (
        let night = new Date(startDate);
        night < endDate;
        night.setUTCDate(night.getUTCDate() + 1)
      ) {
        const dateKey = night.toISOString().slice(0, 10);
        const rate = rateMap.get(`${roomTypeId}:${dateKey}`);

        // Do not advertise an incomplete price.
        if (!rate) {
          return null;
        }

        const basePrice = Number(rate.price);
        const gstRate = Number(rate.gstRate);

        const gstAmount = roundMoney(
          (basePrice * gstRate) / 100
        );

        baseTotal += basePrice;
        gstTotal += gstAmount;

        nightlyRates.push({
          date: dateKey,
          basePrice: roundMoney(basePrice),
          gstRate,
          gstAmount,
          totalWithTax: roundMoney(basePrice + gstAmount),
        });
      }

      baseTotal = roundMoney(baseTotal);
      gstTotal = roundMoney(gstTotal);

      return {
        ratePlan: "STANDARD",
        currency: "INR",
        nights: nightlyRates.length,
        baseTotal,
        gstTotal,
        totalWithTax: roundMoney(baseTotal + gstTotal),
        averageBasePerNight: roundMoney(
          baseTotal / nightlyRates.length
        ),
        nightlyRates,
      };
    };

    const availableRoomTypes = await Promise.all(
      suitableRoomTypes.map(async (roomType) => {
        const isBlocked = blackouts.some(
          (blackout) =>
            blackout.roomTypeId === null ||
            blackout.roomTypeId === roomType.id
        );

        // Find physical rooms available for the entire stay.
        const availableRooms = await prisma.room.findMany({
          where: {
            roomTypeId: roomType.id,
            isActive: true,
            isRetired: false,
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

        const pricing = calculatePricing(roomType.id);

        return {
          id: roomType.id,
          name: roomType.name,
          maxGuests: roomType.maxGuests,
          totalUnits: roomType.totalUnits,
          isActive: roomType.isActive,
          isBlocked,
          availableUnits: isBlocked
            ? 0
            : Math.min(
                availableRooms.length,
                minimumAllotmentAvailability
              ),
          pricing,
        };
      })
    );

    // Cheapest base price first. Categories without complete
    // pricing are placed at the end.
    availableRoomTypes.sort((a, b) => {
      if (a.pricing === null && b.pricing === null) return 0;
      if (a.pricing === null) return 1;
      if (b.pricing === null) return -1;

      return a.pricing.baseTotal - b.pricing.baseTotal;
    });

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
