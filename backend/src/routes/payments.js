import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";
import crypto from "node:crypto";

const router = express.Router();

async function releasePromoUse(tx, booking) {
  if (!booking.promoCodeId) return;

  await tx.promoCode.updateMany({
    where: {
      id: booking.promoCodeId,
      usedCount: { gt: 0 },
    },
    data: {
      usedCount: { decrement: 1 },
    },
  });
}

const demoPaymentSchema = z.discriminatedUnion("paymentMethod", [
  z.object({
    paymentMethod: z.literal("UPI"),
    upiId: z
      .string()
      .trim()
      .regex(
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/,
        "Enter a valid UPI ID",
      ),
  }),
  z.object({
    paymentMethod: z.literal("CARD"),
    cardholderName: z.string().trim().min(2).max(100),
    cardNumber: z
      .string()
      .transform((value) => value.replace(/[\s-]/g, ""))
      .refine((value) => /^\d{13,19}$/.test(value), "Invalid card number")
      .refine((value) => {
        let sum = 0;
        let doubleDigit = false;

        for (let i = value.length - 1; i >= 0; i--) {
          let digit = Number(value[i]);

          if (doubleDigit) {
            digit *= 2;
            if (digit > 9) digit -= 9;
          }

          sum += digit;
          doubleDigit = !doubleDigit;
        }

        return sum % 10 === 0;
      }, "Invalid card number"),
    expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY"),
    cvv: z.string().regex(/^\d{3,4}$/, "Invalid CVV"),
  }).superRefine((data, ctx) => {
    const [month, year] = data.expiry.split("/").map(Number);
    const expiryDate = new Date(2000 + year, month, 0, 23, 59, 59);

    if (expiryDate < new Date()) {
      ctx.addIssue({
        code: "custom",
        path: ["expiry"],
        message: "Card has expired",
      });
    }
  }),
]);

// Create a payment attempt.
router.post("/bookings/:id/pay", async (req, res) => {
  const { id } = req.params;

  const schema = z.object({
    paymentMethod: z.enum(["UPI", "CARD"]),
  });

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Select a valid payment method",
    });
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "Booking"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      const booking = await tx.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        return { status: 404, message: "Booking not found" };
      }

      if (booking.status !== "PENDING_PAYMENT") {
        return { status: 409, message: "Booking cannot accept payment" };
      }

      if (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) {
        await tx.booking.update({
          where: { id },
          data: { status: "EXPIRED", holdExpiresAt: null },
        });

        await releasePromoUse(tx, booking);

        return { status: 409, message: "Booking hold has expired" };
      }

      const existingPayment = await tx.payment.findFirst({
        where: { bookingId: id, status: "PENDING" },
      });

      if (existingPayment) {
        return {
          status: 200,
          payment: existingPayment,
          message: "Existing payment attempt",
        };
      }

      const payment = await tx.payment.create({
        data: {
          bookingId: id,
          amount: booking.totalAmount,
          status: "PENDING",
          paymentMethod: parsed.data.paymentMethod,
        },
      });

      return { status: 201, payment };
    });

    return res.status(outcome.status).json({
      success: outcome.status < 400,
      ...outcome,
    });
  } catch (error) {
    console.error("Payment initiation failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to initiate payment",
    });
  }
});

router.post("/payments/:id/demo-checkout", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({
      success: false,
      message: "Demo payments are disabled",
    });
  }

  const parsed = demoPaymentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || "Invalid payment details",
    });
  }

  const { id } = req.params;
  const { paymentMethod } = parsed.data;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "RoomType"
        ORDER BY "id"
        FOR UPDATE
      `;

      await tx.$queryRaw`
        SELECT "id" FROM "Payment"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      const payment = await tx.payment.findUnique({
        where: { id },
      });

      if (!payment) {
        return { status: 404, message: "Payment not found" };
      }

      await tx.$queryRaw`
        SELECT "id" FROM "Booking"
        WHERE "id" = ${payment.bookingId}
        FOR UPDATE
      `;

      const booking = await tx.booking.findUnique({
        where: { id: payment.bookingId },
      });

      if (payment.status === "SUCCESS" && booking.status === "CONFIRMED") {
        return {
          status: 200,
          message: "Booking already confirmed",
          payment,
          booking,
        };
      }

      if (payment.status !== "PENDING") {
        return {
          status: 409,
          message: "This payment has already been processed",
        };
      }

      if (
        payment.paymentMethod !== paymentMethod ||
        booking.status !== "PENDING_PAYMENT"
      ) {
        return {
          status: 409,
          message: "Payment or booking status is invalid",
        };
      }

      if (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) {
        await tx.payment.update({
          where: { id },
          data: { status: "FAILED" },
        });

        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "EXPIRED", holdExpiresAt: null },
        });

        await releasePromoUse(tx, booking);

        return {
          status: 409,
          message: "Booking hold expired. Please book again.",
        };
      }

      const transactionId = `DEMO-${crypto.randomUUID()}`;

      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: "SUCCESS",
          transactionId,
        },
      });

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          holdExpiresAt: null,
        },
      });

      return {
        status: 200,
        message: "Demo payment successful. Booking confirmed!",
        payment: updatedPayment,
        booking: updatedBooking,
      };
    });

    const { booking, ...safeOutcome } = outcome;

    const safeBooking = booking
      ? (({ cancellationTokenHash, ...data }) => data)(booking)
      : undefined;

    return res.status(outcome.status).json({
      success: outcome.status < 400,
      ...safeOutcome,
      ...(safeBooking ? { booking: safeBooking } : {}),
    });
  } catch (error) {
    console.error("Demo checkout failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process demo payment",
    });
  }
});

// Simulate a payment provider notification.
const simulatePaymentSchema = z.object({
  outcome: z.enum(["SUCCESS", "FAILED"]),
});

router.post(
  "/payments/:id/simulate",
  authenticate,
  authorize("ADMIN", "DEV"),
  async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({
        success: false,
        message: "Payment simulation is disabled",
      }
    );
  }
  const result = simulatePaymentSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Outcome must be SUCCESS or FAILED",
    });
  }

  const { id } = req.params;
  const { outcome: paymentOutcome } = result.data;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Use the same inventory lock order as booking creation.
      await tx.$queryRaw`
        SELECT "id"
        FROM "RoomType"
        ORDER BY "id"
        FOR UPDATE
      `;

      // Lock this payment to prevent concurrent notifications.
      await tx.$queryRaw`
        SELECT "id"
        FROM "Payment"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      const payment = await tx.payment.findUnique({
        where: { id },
      });

      if (!payment) {
        return { status: 404, message: "Payment not found" };
      }

      // Lock the associated booking.
      await tx.$queryRaw`
        SELECT "id"
        FROM "Booking"
        WHERE "id" = ${payment.bookingId}
        FOR UPDATE
      `;

      // Fetch fresh booking data after acquiring the lock.
      const booking = await tx.booking.findUnique({
        where: { id: payment.bookingId },
      });

      // Make repeated notifications safe.
      if (payment.status !== "PENDING") {
        return {
          status: 200,
          message: "Payment notification already processed",
          payment,
          booking,
        };
      }
      // Record the payment result.
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: paymentOutcome,
          transactionId: `SIM-${payment.id}`,
        },
      });

      if (paymentOutcome === "FAILED") {
        let updatedBooking = booking;

        if (booking.status === "PENDING_PAYMENT") {
          updatedBooking = await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: "FAILED",
              holdExpiresAt: null,
            },
          });
          await releasePromoUse(tx, booking);
        }

        return {
          status: 200,
          message: "Payment failed. Booking inventory released.",
          payment: updatedPayment,
          booking: updatedBooking,
        };
      }

      // Don't downgrade an already confirmed booking.
      if (booking.status === "CONFIRMED") {
        return {
          status: 200,
          message: "Booking is already confirmed. Payment recorded.",
          payment: updatedPayment,
          booking,
        };
      }

      // A successful payment after cancellation needs manual refund handling.
      if (booking.status === "CANCELLED") {
        return {
          status: 200,
          message:
            "Payment succeeded after cancellation. Booking remains cancelled; refund reconciliation is required.",
          payment: updatedPayment,
          booking,
        };
      }

      // A successful payment for an expired or failed booking
      // requires manual reconciliation.
      if (
        booking.status !== "PENDING_PAYMENT" ||
        !booking.holdExpiresAt ||
        booking.holdExpiresAt <= new Date()
      ) {
        const updatedBooking =
          booking.status === "PAYMENT_REVIEW"
            ? booking
            : await tx.booking.update({
                where: { id: booking.id },
                data: { status: "PAYMENT_REVIEW" },
              });

        if (booking.status === "PENDING_PAYMENT") {
          await releasePromoUse(tx, booking);
        }

        return {
          status: 200,
          message: "Payment succeeded, but the booking requires manual review.",
          payment: updatedPayment,
          booking: updatedBooking,
        };
      }

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          holdExpiresAt: null,
        },
      });

      return {
        status: 200,
        message: "Payment successful. Booking confirmed.",
        payment: updatedPayment,
        booking: updatedBooking,
      };
    });

    const { booking, ...safeOutcome } = outcome;

    const safeBooking = booking
      ? (({ cancellationTokenHash, ...data }) => data)(booking)
      : undefined;

    return res.status(outcome.status).json({
      success: outcome.status < 400,
      ...safeOutcome,
      ...(booking ? { booking: safeBooking } : {}),
    });
  } catch (error) {
    console.error("Payment processing failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process payment notification",
    });
  }
});

export default router;
