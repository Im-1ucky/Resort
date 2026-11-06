import prisma from "../lib/prisma.js";

async function recoverDuplicateMessage(error, externalMessageId) {
  if (error?.code !== "P2002" || !externalMessageId) {
    throw error;
  }

  const existingMessage = await prisma.enquiryMessage.findUnique({
    where: { externalMessageId },
    include: { enquiry: true },
  });

  if (!existingMessage) {
    throw error;
  }

  return {
    duplicate: true,
    enquiry: existingMessage.enquiry,
    message: existingMessage,
  };
}

export async function createEnquiry({
  guestName,
  guestEmail,
  guestPhone,
  subject,
  source,
  content,
  externalThreadId,
  externalMessageId,
  category,
  department,
  eventType,
  eventDate,
  eventGuestCount,
  eventBudget,
}) {
  try {
    return await prisma.$transaction(async (tx) => {
    if (externalMessageId) {
      const existingMessage = await tx.enquiryMessage.findUnique({
        where: { externalMessageId },
        include: { enquiry: true },
      });

      if (existingMessage) {
        return {
          duplicate: true,
          enquiry: existingMessage.enquiry,
          message: existingMessage,
        };
      }
    }

    const now = new Date();

    const enquiry = await tx.enquiry.create({
      data: {
        guestName,
        guestEmail,
        guestPhone,
        subject,
        source,
        externalThreadId,
        category,
        department,
        eventType,
        eventDate,
        eventGuestCount,
        eventBudget,
        lastMessageAt: now,
        messages: {
          create: {
            senderType: "GUEST",
            direction: "INBOUND",
            source,
            content,
            externalMessageId,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    return {
      duplicate: false,
      enquiry,
      message: enquiry.messages[0],
    };
    });
  } catch (error) {
    return recoverDuplicateMessage(error, externalMessageId);
  }
}

export async function appendEnquiryMessage({
  enquiryId,
  content,
  source,
  externalMessageId,
}) {
  try {
    return await prisma.$transaction(async (tx) => {
    if (externalMessageId) {
      const existingMessage = await tx.enquiryMessage.findUnique({
        where: { externalMessageId },
        include: { enquiry: true },
      });

      if (existingMessage) {
        return {
          duplicate: true,
          enquiry: existingMessage.enquiry,
          message: existingMessage,
        };
      }
    }

    const enquiry = await tx.enquiry.findUnique({
      where: { id: enquiryId },
    });

    if (!enquiry) {
      const error = new Error("Enquiry not found");
      error.statusCode = 404;
      throw error;
    }

    const now = new Date();

    const message = await tx.enquiryMessage.create({
      data: {
        enquiryId,
        senderType: "GUEST",
        direction: "INBOUND",
        source,
        content,
        externalMessageId,
      },
    });

    const updatedEnquiry = await tx.enquiry.update({
      where: { id: enquiryId },
      data: {
        lastMessageAt: now,
        status: ["RESOLVED", "CLOSED"].includes(enquiry.status)
          ? "NEW"
          : enquiry.status,
      },
    });

    return {
      duplicate: false,
      enquiry: updatedEnquiry,
      message,
    };
    });
  } catch (error) {
    return recoverDuplicateMessage(error, externalMessageId);
  }
}


export async function ingestInboundMessage({
  guestName,
  guestEmail,
  guestPhone,
  subject,
  source,
  content,
  externalThreadId,
  externalMessageId,
  enquiryId,
  category,
  department,
  eventType,
  eventDate,
  eventGuestCount,
  eventBudget,
}) {
  // If an enquiry ID is supplied, append to that conversation.
  if (enquiryId) {
    return appendEnquiryMessage({
      enquiryId,
      content,
      source,
      externalMessageId,
    });
  }

  // Otherwise, try matching a provider conversation thread.
  if (externalThreadId) {
    const existingEnquiry = await prisma.enquiry.findFirst({
      where: {
        externalThreadId,
        source,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingEnquiry) {
      return appendEnquiryMessage({
        enquiryId: existingEnquiry.id,
        content,
        source,
        externalMessageId,
      });
    }
  }

  // No matching conversation: create a new enquiry.
  return createEnquiry({
    guestName,
    guestEmail,
    guestPhone,
    subject,
    source,
    content,
    externalThreadId,
    externalMessageId,
    category,
    department,
    eventType,
    eventDate,
    eventGuestCount,
    eventBudget,
  });
}
