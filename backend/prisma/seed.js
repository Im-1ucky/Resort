
import prisma from "../src/lib/prisma.js";

async function main() {
  // 1. Seed room categories
  const roomTypes = [
    { name: "ROOM", maxGuests: 4, totalUnits: 64 },
    { name: "VILLA", maxGuests: 8, totalUnits: 12 },
  ];

  for (const roomType of roomTypes) {
    await prisma.roomType.upsert({
      where: { name: roomType.name },
      update: { maxGuests: roomType.maxGuests },
      create: roomType,
    });
  }

  console.log("Room categories seeded successfully!");

  // 2. Seed default rate plan
  const ratePlan = await prisma.ratePlan.upsert({
    where: { name: "STANDARD" },
    update: {},
    create: { name: "STANDARD" },
  });

  // 3. Get seeded room categories
  const seededRoomTypes = await prisma.roomType.findMany({
    where: { name: { in: ["ROOM", "VILLA"] } },
  });

  const roomTypeMap = Object.fromEntries(
    seededRoomTypes.map((type) => [type.name, type.id])
  );

  if (!roomTypeMap.ROOM || !roomTypeMap.VILLA) {
    throw new Error("ROOM or VILLA room type missing");
  }

  // 4. Synchronize category inventory with existing physical rooms
  for (const roomType of seededRoomTypes) {
    const totalUnits = await prisma.room.count({
      where: {
        roomTypeId: roomType.id,
        isRetired: false,
      },
    });

    await prisma.roomType.update({
      where: { id: roomType.id },
      data: { totalUnits },
    });
  }

  console.log("Physical inventory synchronized successfully!");

  // 5. Seed today's demo rates
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

  console.log("Demo rates seeded successfully!");

  // 6. Seed assignment sample enquiries
  const sampleEnquiries = [
    {
      externalMessageId: "ENQ-4410",
      guestName: "Ananya Sharma",
      guestEmail: "ananya@example.com",
      subject: "Wedding venue enquiry - February 2027",
      content:
        "Venue for my sister's wedding in Feb 2027, about 250 guests, 2 nights",
      category: "WEDDING_EVENT",
      department: "SALES",
      eventType: "WEDDING",
      eventDate: new Date("2027-02-15"),
      eventGuestCount: 250,
    },
    {
      externalMessageId: "ENQ-4411",
      guestName: "Rahul Kumar",
      guestEmail: "rahul@example.com",
      subject: "Villa availability enquiry",
      content: "Is a villa free 14-16 Nov for 2 adults and a child?",
      category: "ROOM_BOOKING",
      department: "RESERVATIONS",
    },
    {
      externalMessageId: "ENQ-4412",
      guestName: "Arjun Mehta",
      guestEmail: "arjun@example.com",
      subject: "Corporate offsite enquiry - January",
      content: "Team of 45 wants a January offsite with a conference hall",
      category: "CORPORATE_OFFSITE",
      department: "SALES",
      eventType: "CORPORATE_OFFSITE",
      eventGuestCount: 45,
    },
  ];

  for (const sample of sampleEnquiries) {
    const existingMessage = await prisma.enquiryMessage.findUnique({
      where: {
        externalMessageId: sample.externalMessageId,
      },
    });

    if (existingMessage) continue;

    const { externalMessageId, content, ...enquiryData } = sample;

    await prisma.enquiry.create({
      data: {
        ...enquiryData,
        source: "WEBSITE",
        status: "NEW",
        lastMessageAt: new Date(),
        messages: {
          create: {
            senderType: "GUEST",
            direction: "INBOUND",
            source: "WEBSITE",
            content,
            externalMessageId,
          },
        },
      },
    });
  }

  console.log("Assignment sample enquiries seeded successfully!");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
