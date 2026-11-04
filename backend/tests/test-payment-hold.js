import prisma from "../src/lib/prisma.js";

async function main() {
  const room = await prisma.roomType.findUnique({
    where: {
      category: "ROOM",
    },
  });

  const booking = await prisma.booking.create({
    data: {
      guestName: "Payment Hold Tester",
      guestEmail: "holdtest@example.com",
      guestPhone: "9999999993",
      checkIn: new Date("2026-11-14T00:00:00.000Z"),
      checkOut: new Date("2026-11-16T00:00:00.000Z"),
      adults: 2,
      children: 0,
      status: "PENDING_PAYMENT",
      holdExpiresAt: new Date(Date.now() + 10 * 1000),
      items: {
        create: {
          roomTypeId: room.id,
          quantity: 1,
        },
      },
    },
  });

  console.log("10-second payment hold created!");
  console.log("Booking ID:", booking.id);
  console.log("Expires at:", booking.holdExpiresAt);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
