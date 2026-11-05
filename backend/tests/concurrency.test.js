
import { test, expect, afterAll } from "bun:test";
import prisma from "../src/lib/prisma.js";

const API_URL = "http://localhost:3000/api/bookings";

const checkIn = "2026-11-20";
const checkOut = "2026-11-22";

const testEmails = [
  "concurrency-a@example.com",
  "concurrency-b@example.com",
];

afterAll(async () => {
  await prisma.$disconnect();
});

test("concurrent bookings must not oversell inventory", async () => {
  const room = await prisma.roomType.findUnique({
    where: { name: "ROOM" },
  });

  expect(room).not.toBeNull();

  const dates = [
    new Date(`${checkIn}T00:00:00.000Z`),
    new Date("2026-11-21T00:00:00.000Z"),
  ];

  const previousAllotments = await prisma.websiteAllotment.findMany({
    where: {
      roomTypeId: room.id,
      date: { in: dates },
    },
  });

  try {
    for (const date of dates) {
      await prisma.websiteAllotment.upsert({
        where: {
          roomTypeId_date: {
            roomTypeId: room.id,
            date,
          },
        },
        update: { allottedUnits: 1 },
        create: {
          roomTypeId: room.id,
          date,
          allottedUnits: 1,
        },
      });
    }

    const createRequest = (email) =>
      fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: "Concurrency Tester",
          guestEmail: email,
          guestPhone: "9876543210",
          checkIn,
          checkOut,
          adults: 1,
          children: 0,
          items: [{ roomTypeId: room.id, quantity: 1 }],
        }),
      });

    const responses = await Promise.all(
      testEmails.map(createRequest)
    );

    const results = await Promise.all(
      responses.map(async (response) => ({
        status: response.status,
        body: await response.json(),
      }))
    );

    console.log("Booking responses:", JSON.stringify(results, null, 2));

    const statuses = results.map((result) => result.status);

    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(1);
  } finally {
    const bookings = await prisma.booking.findMany({
      where: { guestEmail: { in: testEmails } },
      select: { id: true },
    });

    const bookingIds = bookings.map((booking) => booking.id);

    await prisma.$transaction([
      prisma.bookingItem.deleteMany({
        where: { bookingId: { in: bookingIds } },
      }),
      prisma.roomAssignment.deleteMany({
        where: { bookingId: { in: bookingIds } },
      }),
      prisma.payment.deleteMany({
        where: { bookingId: { in: bookingIds } },
      }),
      prisma.booking.deleteMany({
        where: { id: { in: bookingIds } },
      }),
    ]);

    for (const date of dates) {
      const previous = previousAllotments.find(
        (item) => item.date.getTime() === date.getTime()
      );

      if (previous) {
        await prisma.websiteAllotment.update({
          where: { id: previous.id },
          data: { allottedUnits: previous.allottedUnits },
        });
      } else {
        await prisma.websiteAllotment.deleteMany({
          where: { roomTypeId: room.id, date },
        });
      }
    }
  }
});
