
import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);
router.use(authorize("ADMIN", "GM", "DEV"));

router.get("/dashboard", async (req, res, next) => {
  try {
    const [
      totalBookings,
      confirmedBookings,
      pendingPayments,
      cancelledBookings,
      revenue,
      totalEnquiries,
      enquiriesByDepartment,
      recentBookings,
      recentEnquiries,
    ] = await Promise.all([
      prisma.booking.count(),

      prisma.booking.count({
        where: { status: "CONFIRMED" },
      }),

      prisma.booking.count({
        where: { status: "PENDING_PAYMENT" },
      }),

      prisma.booking.count({
        where: { status: "CANCELLED" },
      }),

      prisma.booking.aggregate({
        where: { status: "CONFIRMED" },
        _sum: { totalAmount: true },
      }),

      prisma.enquiry.count(),

      prisma.enquiry.groupBy({
        by: ["department"],
        _count: { id: true },
      }),

      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          guestName: true,
          checkIn: true,
          checkOut: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
      }),

      prisma.enquiry.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          guestName: true,
          subject: true,
          category: true,
          department: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return res.json({
      success: true,
      dashboard: {
        bookings: {
          total: totalBookings,
          confirmed: confirmedBookings,
          pendingPayments,
          cancelled: cancelledBookings,
        },
        revenue: revenue._sum.totalAmount ?? 0,
        enquiries: {
          total: totalEnquiries,
          byDepartment: enquiriesByDepartment.map((item) => ({
            department: item.department,
            count: item._count.id,
          })),
        },
        recentBookings,
        recentEnquiries,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
