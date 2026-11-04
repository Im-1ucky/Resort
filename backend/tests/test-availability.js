import prisma from "../src/lib/prisma.js";

async function main() {
  const roomTypes = await prisma.roomType.findMany();

  const room = roomTypes.find((item) => item.category === "ROOM");
  const villa = roomTypes.find((item) => item.category === "VILLA");

  const testBookings = [
    {
      guestName: "Test Room Guest",
      guestEmail: "roomtest@example.com",
      guestPhone: "9999999991",
      checkIn: new Date("2026-11-14T00:00:00.000Z"),
      checkOut: new Date("2026-11-16T00:00:00.000Z"),
      adults: 2,
      children: 0,
      status: "CONFIRMED",
      items: {
        create: {
          roomTypeId: room.id,
          quantity: 3,
        },
      },
    },
    {
      guestName: "Test Villa Guest",
      guestEmail: "villatest@example.com",
      guestPhone: "9999999992",
      checkIn: new Date("2026-11-14T00:00:00.000Z"),
      checkOut: new Date("2026-11-16T00:00:00.000Z"),
      adults: 2,
      children: 0,
      status: "CONFIRMED",
      items: {
        create: {
          roomTypeId: villa.id,
          quantity: 2,
        },
      },
    },
  ];

  for (const booking of testBookings) {
    await prisma.booking.create({
      data: booking,
    });
  }

  console.log("Test bookings created successfully!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
