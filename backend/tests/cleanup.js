import prisma from "../src/lib/prisma.js";

async function main() {
  // Identify only the bookings created by our tests.
  const testEmails = [
    "roomtest@example.com",
    "villatest@example.com",
    "holdtest@example.com",
    "rahul@example.com",
  ];

  const testBookings = await prisma.booking.findMany({
    where: {
      guestEmail: { in: testEmails },
    },
    select: { id: true },
  });

  const bookingIds = testBookings.map((booking) => booking.id);

  // Delete booking items before their parent bookings.
  const deletedItems = await prisma.bookingItem.deleteMany({
    where: {
      bookingId: { in: bookingIds },
    },
  });

  const deletedBookings = await prisma.booking.deleteMany({
    where: {
      id: { in: bookingIds },
    },
  });

  // Find our two seeded categories.
  const roomTypes = await prisma.roomType.findMany({
    where: {
      name: {
        in: ["ROOM", "VILLA"],
      },
    },
  });

  const room = roomTypes.find(
    (roomType) => roomType.name === "ROOM"
  );

  const villa = roomTypes.find(
    (roomType) => roomType.name === "VILLA"
  );

  // Delete only the allotment overrides created by our test.
  const deletedAllotments = await prisma.websiteAllotment.deleteMany({
    where: {
      date: {
        gte: new Date("2026-11-14T00:00:00.000Z"),
        lt: new Date("2026-11-16T00:00:00.000Z"),
      },
      OR: [
        { roomTypeId: room.id, allottedUnits: 5 },
        { roomTypeId: villa.id, allottedUnits: 4 },
      ],
    },
  });

  console.log(`Deleted booking items: ${deletedItems.count}`);
  console.log(`Deleted test bookings: ${deletedBookings.count}`);
  console.log(`Deleted test allotments: ${deletedAllotments.count}`);
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
