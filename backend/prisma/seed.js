
import prisma from "../src/lib/prisma.js";

async function main() {
  // 1. Seed room categories
  const roomTypes = [
    {
      name: "ROOM",
      maxGuests: 4,
      totalUnits: 64,
    },
    {
      name: "VILLA",
      maxGuests: 8,
      totalUnits: 12,
    },
  ];

  for (const roomType of roomTypes) {
    await prisma.roomType.upsert({
      where: {
        name: roomType.name,
      },
      update: {
        maxGuests: roomType.maxGuests,
        totalUnits: roomType.totalUnits,
      },
      create: roomType,
    });
  }

  console.log("Room categories seeded successfully!");

  // 2. Create the default rate plan
  const ratePlan = await prisma.ratePlan.upsert({
    where: {
      name: "STANDARD",
    },
    update: {},
    create: {
      name: "STANDARD",
    },
  });

  // 3. Get the seeded room categories
  const seededRoomTypes = await prisma.roomType.findMany();

  // 4. Seed starting demo rates
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const defaultRates = {
    ROOM: 5000,
    VILLA: 10000,
  };

  for (const roomType of seededRoomTypes) {
    await prisma.dailyRate.upsert({
      where: {
        roomTypeId_ratePlanId_date: {
          roomTypeId: roomType.id,
          ratePlanId: ratePlan.id,
          date: today,
        },
      },
      update: {},
      create: {
        roomTypeId: roomType.id,
        ratePlanId: ratePlan.id,
        date: today,
        price: defaultRates[roomType.name],
        gstRate: 18,
      },
    });
  }

  console.log("Default rate plan and demo rates seeded successfully!");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
