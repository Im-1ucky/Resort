import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

const createRoomSchema = z.object({
  roomNumber: z.string().trim().min(1),
  roomTypeId: z.string().uuid(),
});

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
  const parsed = createRoomSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid room details",
      errors: parsed.error.flatten(),
    });
  }

  const { roomNumber, roomTypeId } = parsed.data;

  try {
    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });

    if (!roomType) {
      return res.status(404).json({
        message: "Room category not found",
      });
    }

    const room = await prisma.room.create({
      data: {
        roomNumber,
        roomTypeId,
      },
      include: {
        roomType: true,
      },
    });

    return res.status(201).json({
      message: "Room registered successfully",
      room,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "A room with this number already exists",
      });
    }

    console.error("Room registration error:", error);

    return res.status(500).json({
      message: "Failed to register room",
    });
  }
});

router.get(
  "/",
  authenticate,
  authorize("ADMIN", "RESERVATIONS", "GM"),
  async (req, res) => {
  const roomTypeId = req.query.roomTypeId;
  const isActive = z.enum(["true", "false"]).optional().safeParse(
    req.query.isActive
  );

  if (!isActive.success) {
    return res.status(400).json({
      message: "isActive must be true or false",
    });
  }

  try {
    const rooms = await prisma.room.findMany({
      where: {
        ...(roomTypeId ? { roomTypeId } : {}),
        ...(isActive.data !== undefined
          ? { isActive: isActive.data === "true" }
          : {}),
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        roomNumber: "asc",
      },
    });

    return res.status(200).json({
      count: rooms.length,
      rooms,
    });
  } catch (error) {
    console.error("Fetch rooms error:", error);

    return res.status(500).json({
      message: "Failed to fetch rooms",
    });
  }
});

const updateRoomStatusSchema = z.object({
  isActive: z.boolean(),
});

router.patch(
  "/:id/status",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
  const { id } = req.params;
  const parsed = updateRoomStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "isActive must be a boolean",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const existingRoom = await prisma.room.findUnique({
      where: { id },
    });

    if (!existingRoom) {
      return res.status(404).json({
        message: "Room not found",
      });
    }

    const room = await prisma.room.update({
      where: { id },
      data: {
        isActive: parsed.data.isActive,
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Room status updated successfully",
      room,
    });
  } catch (error) {
    console.error("Update room status error:", error);

    return res.status(500).json({
      message: "Failed to update room status",
    });
  }
});

export default router;
