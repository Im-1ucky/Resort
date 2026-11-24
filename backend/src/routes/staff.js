import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
const STAFF_ROLES = ["RESERVATIONS", "SALES", "ADMIN", "GM"];

const staffSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
};

router.use(authenticate);

// GET /api/staff — List all staff (accessible to ADMIN & GM for assignment)
router.get("/", authorize("ADMIN", "GM"), async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES } },
      select: staffSelect,
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return res.json({ success: true, staff });
  } catch (error) {
    console.error("List staff error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch staff" });
  }
});

// POST /api/staff — Create staff member (ADMIN only)
const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(254)
    .transform((v) => v.toLowerCase()),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number")
    .optional()
    .nullable(),
  role: z.enum(STAFF_ROLES),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "Password is too long"),
});

router.post("/", authorize("ADMIN"), async (req, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || "Invalid staff details",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const member = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        role: parsed.data.role,
        passwordHash,
        isActive: true,
      },
      select: staffSelect,
    });

    return res.status(201).json({
      success: true,
      message: "Staff member created",
      staff: member,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
    console.error("Create staff error:", error);
    return res.status(500).json({ success: false, message: "Failed to create staff member" });
  }
});

// PATCH /api/staff/:id — Edit details, role, active status, or reset password (ADMIN only)
const updateStaffSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase())
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number")
      .nullable()
      .optional(),
    role: z.enum(STAFF_ROLES).optional(),
    isActive: z.boolean().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "Password is too long")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

router.patch("/:id", authorize("ADMIN"), async (req, res) => {
  const idParsed = z.string().uuid().safeParse(req.params.id);
  if (!idParsed.success) {
    return res.status(400).json({ success: false, message: "Invalid staff ID" });
  }

  const parsed = updateStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || "Invalid update payload",
    });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: idParsed.data } });
      if (!target || target.role === "GUEST") {
        const err = new Error("Staff member not found");
        err.status = 404;
        throw err;
      }

      const willLoseActiveAdmin =
        target.role === "ADMIN" &&
        target.isActive &&
        ((parsed.data.role && parsed.data.role !== "ADMIN") || parsed.data.isActive === false);

      if (willLoseActiveAdmin) {
        const activeAdmins = await tx.user.count({
          where: { role: "ADMIN", isActive: true },
        });
        if (activeAdmins <= 1) {
          const err = new Error("Cannot demote or deactivate the last active Admin account");
          err.status = 400;
          throw err;
        }
      }

      const { password, ...rest } = parsed.data;
      const data = {
        ...rest,
        ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
      };

      return tx.user.update({
        where: { id: idParsed.data },
        data,
        select: staffSelect,
      });
    });

    return res.json({ success: true, staff: updated });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
    console.error("Update staff error:", error);
    return res.status(500).json({ success: false, message: "Failed to update staff member" });
  }
});

// DELETE /api/staff/:id — Delete staff account while protecting the last Admin (ADMIN only)
router.delete("/:id", authorize("ADMIN"), async (req, res) => {
  const idParsed = z.string().uuid().safeParse(req.params.id);
  if (!idParsed.success) {
    return res.status(400).json({ success: false, message: "Invalid staff ID" });
  }

  if (idParsed.data === req.user.id) {
    return res.status(400).json({
      success: false,
      message: "You cannot delete your own account while signed in",
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: idParsed.data } });
      if (!target || target.role === "GUEST") {
        const err = new Error("Staff member not found");
        err.status = 404;
        throw err;
      }

      if (target.role === "ADMIN" && target.isActive) {
        const activeAdmins = await tx.user.count({
          where: { role: "ADMIN", isActive: true },
        });
        if (activeAdmins <= 1) {
          const err = new Error("Cannot delete the last active Admin account");
          err.status = 400;
          throw err;
        }
      }

      await tx.user.delete({ where: { id: idParsed.data } });
    });

    return res.json({ success: true, message: "Staff member deleted" });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Delete staff error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete staff member" });
  }
});

export default router;
