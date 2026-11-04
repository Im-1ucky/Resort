
import prisma from "../src/lib/prisma.js";

const API_URL = "http://localhost:3000/api/bookings";

const checkIn = "2026-11-20";
const checkOut = "2026-11-22";

const testEmails = [
  "concurrency-a@example.com",
  "concurrency-b@example.com",
];

async function main() {
  const room = await prisma.roomType.findUnique({
    where: { category: "ROOM" },
  });

  if (!room) {
    throw new Error("ROOM category not found");
  }

  const dates = [
    new Date(`${checkIn}T00:00:00.000Z`),
    new Date("2026-11-21T00:00:00.000Z"),
  ];

  // Save existing allotments so we can restore them afterward.
  const previousAllotments = await prisma.websiteAllotment.findMany({
    where: {
      roomTypeId: room.id,
      date: { in: dates },
    },
  });

  try {
    // Temporarily make only one ROOM available on both nights.
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guestName: "Concurrency Tester",
          guestEmail: email,
          guestPhone: "9876543210",
          checkIn,
          checkOut,
          adults: 1,
          children: 0,
          items: [
            { category: "ROOM", quantity: 1 },
          ],
        }),
      });

    console.log("Sending two booking requests simultaneously...");

    const responses = await Promise.all(
      testEmails.map(createRequest)
    );

    const results = await Promise.all(
      responses.map(async (response) => ({
        status: response.status,
        body: await response.json(),
      }))
    );

    console.log("\nResults:");
    console.log(JSON.stringify(results, null, 2));

    const successful = results.filter(
      (result) => result.status === 201
    );

    const rejected = results.filter(
      (result) => result.status === 409
    );

    if (successful.length === 1 && rejected.length === 1) {
      console.log("\nPASS: Exactly one booking succeeded.");
      console.log("PASS: The other booking was rejected.");
    } else {
      throw new Error(
        `Expected one 201 and one 409, got: ${results
          .map((result) => result.status)
          .join(", ")}`
      );
    }
  } finally {
    // Remove only bookings created by this test.
    const bookings = await prisma.booking.findMany({
      where: {
        guestEmail: { in: testEmails },
      },
      select: { id: true },
    });

    const bookingIds = bookings.map((booking) => booking.id);

    await prisma.bookingItem.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });

    await prisma.booking.deleteMany({
      where: { id: { in: bookingIds } },
    });

    // Restore previous allotments.
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
          where: {
            roomTypeId: room.id,
            date,
          },
        });
      }
    }

    console.log("\nTest bookings removed and allotments restored.");
  }
}

main()
  .catch((error) => {
    console.error("\nConcurrency test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
