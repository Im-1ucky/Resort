import { test, expect, afterAll } from "bun:test";
import prisma from "../src/lib/prisma.js";
import { appendEnquiryMessage } from "../src/services/enquiryService.js";

afterAll(async () => {
  await prisma.$disconnect();
});

test("inbound messages preserve active enquiry statuses and reopen closed enquiries", async () => {
  const cases = [
    ["NEW", "NEW"],
    ["ASSIGNED", "ASSIGNED"],
    ["IN_PROGRESS", "IN_PROGRESS"],
    ["WAITING_FOR_GUEST", "WAITING_FOR_GUEST"],
    ["RESOLVED", "NEW"],
    ["CLOSED", "NEW"],
  ];

  for (const [initialStatus, expectedStatus] of cases) {
    const enquiry = await prisma.enquiry.create({
      data: {
        guestName: "Status Test",
        subject: `Testing ${initialStatus}`,
        source: "WEBSITE",
        status: initialStatus,
      },
    });

    try {
      const result = await appendEnquiryMessage({
        enquiryId: enquiry.id,
        content: "Following up on my enquiry.",
        source: "WEBSITE",
      });

      expect(result.enquiry.status).toBe(expectedStatus);
    } finally {
      await prisma.enquiry.delete({
        where: { id: enquiry.id },
      });
    }
  }
});
