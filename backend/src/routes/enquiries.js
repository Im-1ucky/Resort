
import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { ingestInboundMessage } from "../services/enquiryService.js";

const router = Router();

const websiteSchema = z.object({
  guestName: z.string().trim().min(2).max(100),
  guestEmail: z.string().trim().email(),
  guestPhone: z.string().trim().min(7).max(20).optional(),
  subject: z.string().trim().min(3).max(200),
  content: z.string().trim().min(5).max(5000),
});

const eventSchema = z.object({
  guestName: z.string().trim().min(2).max(100),
  guestEmail: z.string().trim().email(),
  guestPhone: z.string().trim().min(7).max(20).optional(),
  eventType: z.enum(["WEDDING", "CORPORATE_OFFSITE", "OTHER"]),
  eventDate: z.coerce.date().refine(
    (date) => date >= new Date(new Date().setHours(0, 0, 0, 0)),
    "Event date cannot be in the past"
  ),
  eventGuestCount: z.coerce.number().int().positive().max(10000),
  eventBudget: z.coerce.number().positive().optional(),
  content: z.string().trim().max(5000).optional(),
});

const webhookSchema = z.object({
  guestName: z.string().trim().min(2).max(100),
  guestEmail: z.string().trim().email().optional(),
  guestPhone: z.string().trim().min(7).max(20).optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(5000),
  externalThreadId: z.string().trim().max(255).optional(),
  externalMessageId: z.string().trim().max(255).optional(),
  enquiryId: z.string().uuid().optional(),
});

function validateWebhookSecret(req, res, next) {
  const expected = process.env.INBOUND_WEBHOOK_SECRET;
  const received = req.get("x-webhook-secret");

  if (!expected || !received) {
    return res.status(401).json({
      success: false,
      message: "Invalid webhook credentials",
    });
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid webhook credentials",
    });
  }

  next();
}

function handleValidation(schema, req, res) {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request data",
      errors: result.error.issues,
    });
    return null;
  }

  return result.data;
}

// Website enquiry form
router.post("/enquiries", async (req, res, next) => {
  try {
    const data = handleValidation(websiteSchema, req, res);
    if (!data) return;

    const result = await ingestInboundMessage({
      ...data,
      source: "WEBSITE",
    });

    return res.status(201).json({
      success: true,
      duplicate: result.duplicate,
      message: "Your enquiry has been received",
      enquiryId: result.enquiry.id,
    });
  } catch (error) {
    next(error);
  }
});

// Structured wedding and event enquiry form
router.post("/enquiries/events", async (req, res, next) => {
  try {
    const data = handleValidation(eventSchema, req, res);
    if (!data) return;

    const category =
      data.eventType === "WEDDING"
        ? "WEDDING_EVENT"
        : data.eventType === "CORPORATE_OFFSITE"
          ? "CORPORATE_OFFSITE"
          : "GENERAL";

    const result = await ingestInboundMessage({
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone,
      subject: `${data.eventType.replaceAll("_", " ")} enquiry`,
      source: "WEBSITE",
      category,
      department: "SALES",
      eventType: data.eventType,
      eventDate: data.eventDate,
      eventGuestCount: data.eventGuestCount,
      eventBudget: data.eventBudget,
      content: data.content || [
        `Event type: ${data.eventType}`,
        `Event date: ${data.eventDate.toISOString().slice(0, 10)}`,
        `Expected guests: ${data.eventGuestCount}`,
        data.eventBudget ? `Budget: ₹${data.eventBudget}` : null,
      ].filter(Boolean).join("\n"),
    });

    return res.status(201).json({
      success: true,
      message: "Your event enquiry has been received",
      enquiryId: result.enquiry.id,
    });
  } catch (error) {
    next(error);
  }
});

// Simulated WhatsApp webhook
router.post(
  "/webhooks/whatsapp",
  validateWebhookSecret,
  async (req, res, next) => {
    try {
      const data = handleValidation(webhookSchema, req, res);
      if (!data) return;

      if (!data.guestPhone) {
        return res.status(400).json({
          success: false,
          message: "WhatsApp sender phone is required",
        });
      }

      const result = await ingestInboundMessage({
        ...data,
        subject: data.subject || "WhatsApp enquiry",
        source: "WHATSAPP",
      });

      return res.status(200).json({
        success: true,
        duplicate: result.duplicate,
        enquiryId: result.enquiry.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Simulated forwarded email webhook
router.post(
  "/webhooks/email",
  validateWebhookSecret,
  async (req, res, next) => {
    try {
      const data = handleValidation(webhookSchema, req, res);
      if (!data) return;

      if (!data.guestEmail) {
        return res.status(400).json({
          success: false,
          message: "Email sender address is required",
        });
      }

      const result = await ingestInboundMessage({
        ...data,
        subject: data.subject || "Email enquiry",
        source: "EMAIL",
      });

      return res.status(200).json({
        success: true,
        duplicate: result.duplicate,
        enquiryId: result.enquiry.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
