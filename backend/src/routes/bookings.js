import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";

const router = express.Router();

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many booking attempts. Please try again later.",
  },
});

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

    promoCode: z.string().trim().min(1).max(30).optional(),
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

router.post("/", bookingLimiter, async (req, res) => {
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
    promoCode,
  } = result.data;

  const startDate = new Date(`${checkIn}T00:00:00.000Z`);
  const endDate = new Date(`${checkOut}T00:00:00.000Z`);

  const now = new Date();
  const holdExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  const cancellationToken = crypto.randomBytes(32).toString("hex");

  const cancellationTokenHash = crypto
    .createHash("sha256")
    .update(cancellationToken)
    .digest("hex");

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

      // Reject bookings that overlap property-wide or category-specific blackouts.
      const blackouts = await tx.blackoutDate.findMany({
        where: {
          date: {
            gte: startDate,
            lt: endDate,
          },
          OR: [
            { roomTypeId: null },
            { roomTypeId: { in: roomTypeIds } },
          ],
        },
      });

      if (blackouts.length > 0) {
        const blockedRoomTypeIds = new Set(
          blackouts.map((blackout) => blackout.roomTypeId)
        );

        const propertyWideBlocked = blockedRoomTypeIds.has(null);

        const blockedCategories = propertyWideBlocked
          ? roomTypes.map((type) => type.name)
          : roomTypes
              .filter((type) => blockedRoomTypeIds.has(type.id))
              .map((type) => type.name);

        return {
          status: 409,
          message: `Booking unavailable due to blackout dates: ${blockedCategories.join(", ")}`,
        };
      }

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
      const [previousRates, ratesInRange] = await Promise.all([
        // Get the latest rate before check-in for each room category.
        Promise.all(
          roomTypeIds.map((roomTypeId) =>
            tx.dailyRate.findFirst({
              where: {
                roomTypeId,
                ratePlan: { name: "STANDARD" },
                date: { lt: startDate },
              },
              orderBy: {
                date: "desc",
              },
            })
          )
        ),

        // Get all rate changes during the booking period.
        tx.dailyRate.findMany({
          where: {
            roomTypeId: { in: roomTypeIds },
            ratePlan: { name: "STANDARD" },
            date: {
              gte: startDate,
              lt: endDate,
            },
          },
          orderBy: {
            date: "asc",
          },
        }),
      ]);

      // Combine and sort rates chronologically for effective-from pricing.
      const rates = [...previousRates, ...ratesInRange]
        .filter(Boolean)
        .sort((a, b) => a.date.getTime() - b.date.getTime());


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

      let promo = null;

      if (promoCode) {
        // Lock the promo row to prevent concurrent usage-limit bypasses.
        const promos = await tx.$queryRaw`
          SELECT *
          FROM "PromoCode"
          WHERE "code" = ${promoCode.toUpperCase()}
          FOR UPDATE
        `;

        promo = promos[0];

        if (!promo || !promo.isActive) {
          return {
            status: 400,
            message: "Invalid promo code",
          };
        }

        if (now < promo.startsAt || now > promo.expiresAt) {
          return {
            status: 400,
            message: "Promo code is not currently valid",
          };
        }

        if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
          return {
            status: 400,
            message: "Promo code usage limit reached",
          };
        }

        if (
          bookingSubtotalPaise / 100 <
          Number(promo.minBookingAmount)
        ) {
          return {
            status: 400,
            message: `Minimum booking amount is ₹${promo.minBookingAmount}`,
          };
        }
      }

      let discountPaise = 0;

      if (promo) {
        const discountValuePaise = Math.round(
          Number(promo.discountValue) * 100
        );

        discountPaise =
          promo.discountType === "PERCENTAGE"
            ? Math.round(
                (bookingSubtotalPaise * discountValuePaise) / 10000
              )
            : discountValuePaise;

        // A discount cannot exceed the booking subtotal.
        discountPaise = Math.min(discountPaise, bookingSubtotalPaise);
      }

      const discountedSubtotalPaise =
        bookingSubtotalPaise - discountPaise;

      // Reduce GST proportionally because the discount applies before tax.
      const discountedGstPaise =
        bookingSubtotalPaise > 0
          ? Math.round(
              (bookingGstPaise * discountedSubtotalPaise) /
                bookingSubtotalPaise
            )
          : 0;

      const subtotal = (discountedSubtotalPaise / 100).toFixed(2);
      const gstAmount = (discountedGstPaise / 100).toFixed(2);
      const discountAmount = (discountPaise / 100).toFixed(2);

      const totalAmount = (
        (discountedSubtotalPaise + discountedGstPaise) / 100
      ).toFixed(2);

      if (promo) {
        await tx.promoCode.update({
          where: { id: promo.id },
          data: {
            usedCount: { increment: 1 },
          },
        });
      }

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
          promoCodeId: promo?.id ?? null,
          discountAmount,

          status: "PENDING_PAYMENT",
          holdExpiresAt,
          cancellationTokenHash,

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

    const {
      cancellationTokenHash: storedTokenHash,
      ...publicBooking
    } = outcome.booking;

    return res.status(201).json({
      success: true,
      message: "Booking created. Complete payment before the hold expires.",
      booking: publicBooking,
      cancellationToken,
    });
  } catch (error) {
    console.error("Booking creation failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create booking",
    });
  }
});

// CANCEL BOOKING
router.post("/:id/cancel", bookingLimiter, async (req, res) => {
  try {
    const idResult = z.string().uuid().safeParse(req.params.id);

    if (!idResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const { cancellationToken } = req.body ?? {};

    const isStaff = Boolean(req.cookies?.token);
    let staffUser = null;

    // Authenticate staff if a session cookie is supplied.
    if (isStaff) {
      const jwt = await import("jsonwebtoken");

      try {
        const decoded = jwt.default.verify(
          req.cookies.token,
          process.env.JWT_SECRET
        );

        staffUser = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, role: true },
        });
      } catch {
        staffUser = null;
      }
    }

    const allowedStaffRoles = [
      "ADMIN",
      "RESERVATIONS",
      "GM",
      "DEV",
    ];

    const isAuthorizedStaff =
      staffUser && allowedStaffRoles.includes(staffUser.role);

    if (!isAuthorizedStaff && typeof cancellationToken !== "string") {
      return res.status(401).json({
        success: false,
        message: "Valid cancellation token or staff login required",
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: idResult.data },
      select: {
        id: true,
        status: true,
        cancellationTokenHash: true,
        promoCodeId: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Guests must prove ownership using their private token.
    if (!isAuthorizedStaff) {
      const suppliedHash = crypto
        .createHash("sha256")
        .update(cancellationToken)
        .digest("hex");

      const suppliedBuffer = Buffer.from(suppliedHash, "hex");
      const storedBuffer = booking.cancellationTokenHash
        ? Buffer.from(booking.cancellationTokenHash, "hex")
        : Buffer.alloc(0);

      if (
        suppliedBuffer.length !== storedBuffer.length ||
        !crypto.timingSafeEqual(suppliedBuffer, storedBuffer)
      ) {
        return res.status(403).json({
          success: false,
          message: "Invalid cancellation token",
        });
      }
    }

    if (!["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status)) {
      return res.status(409).json({
        success: false,
        message: `Booking cannot be cancelled because its status is ${booking.status}`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: booking.status,
        },
        data: {
          status: "CANCELLED",
          holdExpiresAt: null,
        },
      });

      if (result.count === 1 && booking.promoCodeId) {
        await tx.promoCode.updateMany({
          where: {
            id: booking.promoCodeId,
            usedCount: { gt: 0 },
          },
          data: {
            usedCount: { decrement: 1 },
          },
        });
      }

      return result;
    });

    if (updated.count !== 1) {
      return res.status(409).json({
        success: false,
        message: "Booking status changed. Please try again.",
      });
    }

    return res.json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    console.error("Booking cancellation failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel booking",
    });
  }
});

// STAFF BOOKING LIST AND SEARCH
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "RESERVATIONS", "GM", "DEV"),
  async (req, res) => {
    const querySchema = z.object({
      search: z.string().trim().max(100).optional(),
      status: z.enum([
        "PENDING_PAYMENT",
        "CONFIRMED",
        "FAILED",
        "EXPIRED",
        "PAYMENT_REVIEW",
        "CANCELLED",
      ]).optional(),
      checkIn: z.iso.date().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });

    const parsed = querySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid search filters",
        errors: parsed.error.issues,
      });
    }

    try {
      const { search, status, checkIn, page, limit } = parsed.data;

      const where = {
        ...(status && { status }),
        ...(checkIn && {
          checkIn: new Date(`${checkIn}T00:00:00.000Z`),
        }),
        ...(search && {
          OR: [
            {
              guestName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              guestEmail: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              guestPhone: {
                contains: search,
              },
            },
            {
              id: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }),
      };

      const [bookings, total] = await prisma.$transaction([
        prisma.booking.findMany({
          where,
          include: {
            items: {
              include: {
                roomType: true,
              },
            },
            roomAssignments: {
              include: {
                room: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.booking.count({ where }),
      ]);

      const safeBookings = bookings.map(
        ({ cancellationTokenHash, ...booking }) => booking
      );

      return res.json({
        success: true,
        bookings: safeBookings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Booking list failed:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve bookings",
      });
    }
  }
);


// STAFF DAILY / DATE-RANGE BOOKING CSV EXPORT
router.get(
  "/export",
  authenticate,
  authorize("ADMIN", "RESERVATIONS", "GM", "DEV"),
  async (req, res) => {
    const querySchema = z.object({
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    }).refine(
      (data) => Boolean(data.from) === Boolean(data.to),
      { message: "Provide both from and to dates, or neither" }
    );

    const parsed = querySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid date range. Provide both from and to as YYYY-MM-DD.",
        errors: parsed.error.issues,
      });
    }

    try {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(new Date());

      const from = parsed.data.from || today;
      const to = parsed.data.to || today;

      if (from > to) {
        return res.status(400).json({
          success: false,
          message: "'from' date cannot be after 'to' date",
        });
      }

      // Convert Indian local-day boundaries to UTC instants.
      const startDate = new Date(`${from}T00:00:00+05:30`);
      const endDate = new Date(
        new Date(`${to}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000
      );

      const bookings = await prisma.booking.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        select: {
          id: true,
          guestName: true,
          guestEmail: true,
          guestPhone: true,
          checkIn: true,
          checkOut: true,
          adults: true,
          children: true,
          status: true,
          subtotal: true,
          gstAmount: true,
          discountAmount: true,
          totalAmount: true,
          createdAt: true,
          items: {
            select: {
              quantity: true,
              roomType: {
                select: {
                  name: true,
                },
              },
            },
          },
          roomAssignments: {
            select: {
              room: {
                select: {
                  roomNumber: true,
                  roomType: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          payments: {
            select: {
              status: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      const csvCell = (value) => {
        let text = value == null ? "" : String(value);

        // Prevent spreadsheet formula injection from guest-provided data.
        if (/^[\t\r=+\-@]/.test(text)) {
          text = `'${text}`;
        }

        return `"${text.replaceAll('"', '""')}"`;
      };

      const headers = [
        "Booking ID",
        "Booking Created At",
        "Guest Name",
        "Guest Email",
        "Guest Phone",
        "Check In",
        "Check Out",
        "Adults",
        "Children",
        "Room Categories",
        "Assigned Room Numbers",
        "Booking Status",
        "Payment Status",
        "Subtotal",
        "Discount",
        "GST",
        "Total Amount",
      ];

      const rows = bookings.map((booking) => {
        const categories = booking.items
          .map((item) => `${item.roomType.name} x ${item.quantity}`)
          .join("; ");

        const assignedRooms = booking.roomAssignments
          .map((assignment) => {
            const room = assignment.room;
            return `${room.roomType.name}: ${room.roomNumber}`;
          })
          .join("; ");

        const latestPaymentStatus =
          booking.payments[0]?.status || "NO_PAYMENT";

        return [
          booking.id,
          booking.createdAt.toISOString(),
          booking.guestName,
          booking.guestEmail,
          booking.guestPhone,
          booking.checkIn.toISOString().slice(0, 10),
          booking.checkOut.toISOString().slice(0, 10),
          booking.adults,
          booking.children,
          categories,
          assignedRooms,
          booking.status,
          latestPaymentStatus,
          booking.subtotal,
          booking.discountAmount,
          booking.gstAmount,
          booking.totalAmount,
        ];
      });

      const csv = [
        headers.map(csvCell).join(","),
        ...rows.map((row) => row.map(csvCell).join(",")),
      ].join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="bookings-${from}-to-${to}.csv"`
      );

      return res.send(`\uFEFF${csv}`);
    } catch (error) {
      console.error("Booking CSV export failed:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to export bookings",
      });
    }
  }
);


// STAFF BOOKING LOOKUP
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "RESERVATIONS", "GM", "DEV"),
  async (req, res) => {
    try {
      const idResult = z.string().uuid().safeParse(req.params.id);

      if (!idResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
      }

      const booking = await prisma.booking.findUnique({
        where: {
          id: idResult.data,
        },
        include: {
          items: {
            include: {
              roomType: true,
            },
          },
          roomAssignments: {
            include: {
              room: {
                include: {
                  roomType: true,
                },
              },
            },
          },
          payments: true,
        },
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      const { cancellationTokenHash, ...safeBooking } = booking;

      return res.json({
        success: true,
        booking: safeBooking,
      });
    } catch (error) {
      console.error("Booking lookup failed:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve booking",
      });
    }
  }
);

export default router;
