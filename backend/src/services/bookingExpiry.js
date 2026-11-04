import prisma from "../lib/prisma.js";

export async function expirePendingBookings() {
  const now = new Date();

  const expiredBookings = await prisma.booking.findMany({
    where: {
      status: "PENDING_PAYMENT",
      holdExpiresAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      promoCodeId: true,
    },
  });

  if (expiredBookings.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const booking of expiredBookings) {
      const updated = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: "PENDING_PAYMENT",
          holdExpiresAt: { lte: now },
        },
        data: {
          status: "EXPIRED",
          holdExpiresAt: null,
        },
      });

      if (updated.count === 1 && booking.promoCodeId) {
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
    }
  });
}
