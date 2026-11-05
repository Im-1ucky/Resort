import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";

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

// Create a payment attempt.
router.post("/bookings/:id/pay", async (req, res) => {
  const { id } = req.params;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // Lock this booking to prevent concurrent payment attempts.
      await tx.$queryRaw`
        SELECT "id"
        FROM "Booking"
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
        return {
          status: 409,
          message: `Booking cannot accept payment. Current status: ${booking.status}`,
        };
      }

      if (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) {
        await tx.booking.update({
          where: { id },
          data: {
            status: "EXPIRED",
            holdExpiresAt: null,
          },
        });

        await releasePromoUse(tx, booking);

        return { status: 409, message: "Booking hold has expired" };
      }

      // Prevent multiple pending payment attempts.
      const existingPayment = await tx.payment.findFirst({
        where: {
          bookingId: id,
          status: "PENDING",
        },
      });

      if (existingPayment) {
        return {
          status: 409,
          message: "A payment attempt is already pending for this booking",
        };
      }

      const payment = await tx.payment.create({
        data: {
          bookingId: id,
          amount: booking.totalAmount,
          status: "PENDING",
        },
      });

      return { status: 201, payment };
    });

    return res.status(outcome.status).json({
      success: outcome.status === 201,
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

// Simulate a payment provider notification.
const simulatePaymentSchema = z.object({
  outcome: z.enum(["SUCCESS", "FAILED"]),
});

router.post("/payments/:id/simulate", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({
      success: false,
      message: "Payment simulation is disabled",
    });
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
