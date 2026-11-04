
import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";

const router = express.Router();

const bookingSchema = z
  .object({
    guestName: z.string().trim().min(2).max(100),
    guestEmail: z.email(),
    guestPhone: z.string().trim().min(10).max(15),

    checkIn: z.iso.date(),
    checkOut: z.iso.date(),

    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20).default(0),

    items: z
      .array(
        z.object({
          roomTypeId: z.string().uuid(),
          quantity: z.coerce.number().int().min(1),
        })
      )
      .min(1),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  })
  .refine(
    (data) =>
      data.checkIn >= new Date().toISOString().slice(0, 10),
    {
      message: "Check-in cannot be in the past",
      path: ["checkIn"],
    }
  )
  .refine(
    (data) =>
      new Set(data.items.map((item) => item.roomTypeId)).size ===
      data.items.length,
    {
      message: "Each room category can appear only once",
      path: ["items"],
    }
  );

router.post("/", async (req, res) => {
  const result = bookingSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid booking details",
      errors: result.error.issues,
    });
  }

  const {
    guestName,
    guestEmail,
    guestPhone,
    checkIn,
    checkOut,
    adults,
    children,
    items,
  } = result.data;

  const startDate = new Date(`${checkIn}T00:00:00.000Z`);
  const endDate = new Date(`${checkOut}T00:00:00.000Z`);

  const now = new Date();
  const holdExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Lock room types to prevent simultaneous bookings
      // from selling the same remaining inventory.
      await tx.$queryRaw`
        SELECT "id"
        FROM "RoomType"
        ORDER BY "id"
        FOR UPDATE
      `;

      const roomTypes = await tx.roomType.findMany({
        where: {
          id: {
            in: items.map((item) => item.roomTypeId),
          },
          isActive: true,
        },
      });

      if (roomTypes.length !== items.length) {
        return {
          status: 400,
          message: "One or more selected categories do not exist or are inactive",
        };
      }

      // Check total guest capacity across selected units.
      const totalCapacity = items.reduce((total, item) => {
        const roomType = roomTypes.find(
          (type) => type.id === item.roomTypeId
        );

        return total + roomType.maxGuests * item.quantity;
      }, 0);

      if (adults + children > totalCapacity) {
        return {
          status: 400,
          message: "Selected units cannot accommodate this many guests",
        };
      }

      const roomTypeIds = roomTypes.map((type) => type.id);

      // Fetch overlapping confirmed bookings and active payment holds.
      const [bookings, allotments] = await Promise.all([
        tx.booking.findMany({
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

        tx.websiteAllotment.findMany({
          where: {
            roomTypeId: { in: roomTypeIds },
            date: {
              gte: startDate,
              lt: endDate,
            },
          },
        }),
      ]);

      // Ensure every existing active booking has all required
      // physical rooms assigned for the selected categories.
      for (const booking of bookings) {
        for (const bookingItem of booking.items) {
          // Only validate categories involved in this new booking.
          if (!roomTypeIds.includes(bookingItem.roomTypeId)) {
            continue;
          }

          const assignedCount = booking.roomAssignments.filter(
            (assignment) =>
              assignment.room.roomTypeId === bookingItem.roomTypeId
          ).length;

          if (assignedCount < bookingItem.quantity) {
            const roomType = roomTypes.find(
              (type) => type.id === bookingItem.roomTypeId
            );

            return {
              status: 409,
              message: `Existing ${roomType.name} booking needs physical room assignments before new bookings can be accepted for these dates.`,
            };
          }
        }
      }

      // Store the physical room IDs selected for each category.
      const selectedRooms = [];

      for (const item of items) {
        const roomType = roomTypes.find(
          (type) => type.id === item.roomTypeId
        );

        const categoryBookings = bookings.flatMap((booking) =>
          booking.items
            .filter((bookingItem) => bookingItem.roomTypeId === roomType.id)
            .map((bookingItem) => ({
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              quantity: bookingItem.quantity,
            }))
        );

        const categoryAllotments = allotments.filter(
          (allotment) => allotment.roomTypeId === roomType.id
        );

        let minimumAvailable = roomType.totalUnits;

        for (
          let night = new Date(startDate);
          night < endDate;
          night.setUTCDate(night.getUTCDate() + 1)
        ) {
          const bookedUnits = categoryBookings
            .filter(
              (booking) =>
                booking.checkIn <= night && booking.checkOut > night
            )
            .reduce((total, booking) => total + booking.quantity, 0);

          const allotment = categoryAllotments.find(
            (entry) => entry.date.getTime() === night.getTime()
          );

          const allottedUnits =
            allotment?.allottedUnits ?? roomType.totalUnits;

          const availableUnits = Math.max(
            0,
            allottedUnits - bookedUnits
          );

          minimumAvailable = Math.min(
            minimumAvailable,
            availableUnits
          );
        }

        // Find physical rooms with no overlapping active assignments.
        const availableRooms = await tx.room.findMany({
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
          orderBy: {
            roomNumber: "asc",
          },
          take: item.quantity,
        });

        const physicalAvailable = availableRooms.length;

        const actualAvailable = Math.min(
          minimumAvailable,
          physicalAvailable
        );

        if (item.quantity > actualAvailable) {
          return {
            status: 409,
            message: `Only ${actualAvailable} ${roomType.name} unit(s) available for the selected dates`,
          };
        }

        selectedRooms.push({
          roomTypeId: roomType.id,
          roomIds: availableRooms.map((room) => room.id),
        });
      }

      // Fetch STANDARD rates for the selected categories.
      const rates = await tx.dailyRate.findMany({
        where: {
          roomTypeId: { in: roomTypeIds },
          ratePlan: { name: "STANDARD" },
          date: { lt: endDate },
        },
        orderBy: {
          date: "asc",
        },
      });

      const itemPrices = [];

      let bookingSubtotalPaise = 0;
      let bookingGstPaise = 0;

      // Calculate the price of every selected category.
      for (const item of items) {
        const categoryRates = rates.filter(
          (rate) => rate.roomTypeId === item.roomTypeId
        );

        let itemSubtotalPaise = 0;
        let itemGstPaise = 0;

        for (
          let night = new Date(startDate);
          night < endDate;
          night.setUTCDate(night.getUTCDate() + 1)
        ) {
          // Find the latest rate effective on or before this night.
          const applicableRate = categoryRates
            .filter((rate) => rate.date <= night)
            .at(-1);

          if (!applicableRate) {
            const roomType = roomTypes.find(
              (type) => type.id === item.roomTypeId
            );

            return {
              status: 409,
              message: `No rate configured for ${roomType.name} on ${night.toISOString().slice(0, 10)}`,
            };
          }

          // Calculate in paise to avoid floating-point currency errors.
          const unitPricePaise = Math.round(
            Number(applicableRate.price) * 100
          );

          const nightSubtotalPaise =
            unitPricePaise * item.quantity;

          const nightGstPaise = Math.round(
            nightSubtotalPaise * Number(applicableRate.gstRate) / 100
          );

          itemSubtotalPaise += nightSubtotalPaise;
          itemGstPaise += nightGstPaise;
        }

        itemPrices.push({
          roomTypeId: item.roomTypeId,
          quantity: item.quantity,
          subtotal: (itemSubtotalPaise / 100).toFixed(2),
          gstAmount: (itemGstPaise / 100).toFixed(2),
          totalAmount: (
            (itemSubtotalPaise + itemGstPaise) / 100
          ).toFixed(2),
        });

        bookingSubtotalPaise += itemSubtotalPaise;
        bookingGstPaise += itemGstPaise;
      }

      const subtotal = (bookingSubtotalPaise / 100).toFixed(2);
      const gstAmount = (bookingGstPaise / 100).toFixed(2);
      const totalAmount = (
        (bookingSubtotalPaise + bookingGstPaise) / 100
      ).toFixed(2);

      // Inventory is available. Create booking, items and physical room assignments.
      const booking = await tx.booking.create({
        data: {
          guestName,
          guestEmail,
          guestPhone,
          checkIn: startDate,
          checkOut: endDate,
          adults,
          children,

          subtotal,
          gstAmount,
          totalAmount,

          status: "PENDING_PAYMENT",
          holdExpiresAt,

          items: {
            create: itemPrices,
          },

          // Assign the selected physical rooms to this booking.
          roomAssignments: {
            create: selectedRooms.flatMap((category) =>
              category.roomIds.map((roomId) => ({
                roomId,
              }))
            ),
          },
        },

        include: {
          items: {
            include: {
              roomType: true,
            },
          },

          // Return assigned room numbers in the response.
          roomAssignments: {
            include: {
              room: {
                include: {
                  roomType: true,
                },
              },
            },
          },
        },
      });

      return {
        status: 201,
        booking,
      };
    });

    if (outcome.status !== 201) {
      return res.status(outcome.status).json({
        success: false,
        message: outcome.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Booking created. Complete payment before the hold expires.",
      booking: outcome.booking,
    });
  } catch (error) {
    console.error("Booking creation failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create booking",
    });
  }
});

export default router;
