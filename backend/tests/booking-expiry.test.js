import { test, expect, afterAll } from "bun:test";
import { randomUUID } from "node:crypto";
import prisma from "../src/lib/prisma.js";
import { expirePendingBookings } from "../src/services/bookingExpiry.js";

afterAll(async () => {
  await prisma.$disconnect();
});

test("expired payment hold releases its physical room", async () => {
  const email = `expiry-${randomUUID()}@example.com`;

  let bookingId;

  try {
    const room = await prisma.room.findFirst({
      where: {
        isActive: true,
        isRetired: false,
        roomType: { isActive: true },
        assignments: {
          none: {
            booking: {
              status: {
                in: ["CONFIRMED", "PENDING_PAYMENT"],
              },
            },
          },
        },
      },
    });

    expect(room).not.toBeNull();

    const booking = await prisma.booking.create({
      data: {
        guestName: "Expiry Tester",
        guestEmail: email,
        guestPhone: "9876543210",
        checkIn: new Date("2026-12-10T00:00:00.000Z"),
        checkOut: new Date("2026-12-12T00:00:00.000Z"),
        adults: 1,
        children: 0,
        subtotal: 10000,
        gstAmount: 1800,
        totalAmount: 11800,
        status: "PENDING_PAYMENT",
        holdExpiresAt: new Date(Date.now() - 60_000),
        items: {
          create: {
            roomTypeId: room.roomTypeId,
            quantity: 1,
            subtotal: 10000,
            gstAmount: 1800,
            totalAmount: 11800,
          },
        },
        roomAssignments: {
          create: {
            roomId: room.id,
          },
        },
      },
    });

    bookingId = booking.id;

    await expirePendingBookings();

    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    expect(updatedBooking.status).toBe("EXPIRED");
    expect(updatedBooking.holdExpiresAt).toBeNull();

    const availableRoom = await prisma.room.findFirst({
      where: {
        id: room.id,
        assignments: {
          none: {
            booking: {
              checkIn: { lt: new Date("2026-12-12T00:00:00.000Z") },
              checkOut: { gt: new Date("2026-12-10T00:00:00.000Z") },
              OR: [
                { status: "CONFIRMED" },
                {
                  status: "PENDING_PAYMENT",
                  holdExpiresAt: { gt: new Date() },
                },
              ],
            },
          },
        },
      },
    });

    expect(availableRoom).not.toBeNull();
  } finally {
    if (bookingId) {
      await prisma.$transaction([
        prisma.roomAssignment.deleteMany({
          where: { bookingId },
        }),
        prisma.bookingItem.deleteMany({
          where: { bookingId },
        }),
        prisma.payment.deleteMany({
          where: { bookingId },
        }),
        prisma.booking.deleteMany({
          where: { id: bookingId },
        }),
      ]);
    }
  }
});
