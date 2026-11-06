import { test, expect, afterAll } from "bun:test";
import { randomUUID } from "node:crypto";
import prisma from "../src/lib/prisma.js";
import { ingestInboundMessage } from "../src/services/enquiryService.js";

afterAll(async () => {
  await prisma.$disconnect();
});

test("concurrent duplicate messages create only one enquiry message", async () => {
  const externalMessageId = `test-${randomUUID()}`;

  try {
    const payload = {
      guestName: "Duplicate Tester",
      guestEmail: "duplicate-test@example.com",
      guestPhone: "9876543210",
      subject: "Duplicate webhook test",
      source: "WHATSAPP",
      content: "Testing duplicate webhook handling",
      externalMessageId,
    };

    const results = await Promise.all([
      ingestInboundMessage(payload),
      ingestInboundMessage(payload),
    ]);

    expect(results).toHaveLength(2);
    expect(results.filter((r) => r.duplicate === false)).toHaveLength(1);
    expect(results.filter((r) => r.duplicate === true)).toHaveLength(1);

    expect(results[0].enquiry.id).toBe(results[1].enquiry.id);

    const messages = await prisma.enquiryMessage.findMany({
      where: { externalMessageId },
    });

    expect(messages).toHaveLength(1);
  } finally {
    await prisma.enquiryMessage.deleteMany({
      where: { externalMessageId },
    });

    await prisma.enquiry.deleteMany({
      where: {
        guestEmail: "duplicate-test@example.com",
        subject: "Duplicate webhook test",
      },
    });
  }
});
