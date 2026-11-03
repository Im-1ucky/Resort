import prisma from "../src/lib/prisma.js";

async function main() {
  const roomTypes = [
    {
      category: "ROOM",
      maxGuests: 4,
      totalUnits: 64,
    },
    {
      category: "VILLA",
      maxGuests: 8,
      totalUnits: 12,
    },
  ];

  for (const roomType of roomTypes) {
    await prisma.roomType.upsert({
      where: {
        category: roomType.category,
      },
      update: {
        maxGuests: roomType.maxGuests,
        totalUnits: roomType.totalUnits,
      },
      create: roomType,
    });
  }

  console.log("Room categories seeded successfully!");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
