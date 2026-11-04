import prisma from "../src/lib/prisma.js";

async function main() {
  const roomTypes = await prisma.roomType.findMany();

  const room = roomTypes.find((item) => item.category === "ROOM");
  const villa = roomTypes.find((item) => item.category === "VILLA");

  const dates = [
    new Date("2026-11-14T00:00:00.000Z"),
    new Date("2026-11-15T00:00:00.000Z"),
  ];

  for (const date of dates) {
    await prisma.websiteAllotment.upsert({
      where: {
        roomTypeId_date: {
          roomTypeId: room.id,
          date,
        },
      },
      update: {
        allottedUnits: 5,
      },
      create: {
        roomTypeId: room.id,
        date,
        allottedUnits: 5,
      },
    });

    await prisma.websiteAllotment.upsert({
      where: {
        roomTypeId_date: {
          roomTypeId: villa.id,
          date,
        },
      },
      update: {
        allottedUnits: 4,
      },
      create: {
        roomTypeId: villa.id,
        date,
        allottedUnits: 4,
      },
    });
  }

  console.log("Test allotments created successfully!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
