import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

const createRoomSchema = z.object({
  roomNumber: z.string().trim().min(1),
  roomTypeId: z.string().uuid(),
});

const updateRoomStatusSchema = z.object({
  isActive: z.boolean(),
});

const updateRoomCategorySchema = z.object({
  roomTypeId: z.string().uuid(),
});

const roomInclude = {
  roomType: {
    select: {
      id: true,
      name: true,
      totalUnits: true,
    },
  },
};

const parseBooleanQuery = (value) =>
  z.enum(["true", "false"]).optional().safeParse(value);

// Check for confirmed bookings and unexpired payment holds.
async function hasActiveAssignment(tx, roomId) {
  const now = new Date();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const assignment = await tx.roomAssignment.findFirst({
    where: {
      roomId,
      booking: {
        checkOut: {
          gt: today,
        },
        OR: [
          { status: "CONFIRMED" },
          {
            status: "PENDING_PAYMENT",
            holdExpiresAt: { gt: now },
          },
        ],
      },
    },
    select: { id: true },
  });

  return Boolean(assignment);
}

// Lock categories in sorted order to avoid deadlocks.
async function lockRoomTypes(tx, ids) {
  const sortedIds = [...new Set(ids)].sort();

  for (const id of sortedIds) {
    await tx.$queryRaw`
      SELECT "id"
      FROM "RoomType"
      WHERE "id" = ${id}
      FOR UPDATE
    `;
  }
}

async function lockRoom(tx, id) {
  await tx.$queryRaw`
    SELECT "id"
    FROM "Room"
    WHERE "id" = ${id}
    FOR UPDATE
  `;
}

// REGISTER PHYSICAL ROOM
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
      const room = await prisma.$transaction(async (tx) => {
        await lockRoomTypes(tx, [roomTypeId]);

        const roomType = await tx.roomType.findUnique({
          where: { id: roomTypeId },
        });

        if (!roomType) {
          throw new Error("ROOM_TYPE_NOT_FOUND");
        }

        if (!roomType.isActive) {
          throw new Error("ROOM_TYPE_INACTIVE");
        }

        const newRoom = await tx.room.create({
          data: { roomNumber, roomTypeId },
          include: roomInclude,
        });

        await tx.roomType.update({
          where: { id: roomTypeId },
          data: {
            totalUnits: { increment: 1 },
          },
        });

        return newRoom;
      });

      return res.status(201).json({
        message: "Room registered successfully",
        room,
      });
    } catch (error) {
      if (error.message === "ROOM_TYPE_NOT_FOUND") {
        return res.status(404).json({
          message: "Room category not found",
        });
      }

      if (error.message === "ROOM_TYPE_INACTIVE") {
        return res.status(409).json({
          message: "Cannot add a room to an inactive category",
        });
      }

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
  }
);

// LIST PHYSICAL ROOMS
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "RESERVATIONS", "GM"),
  async (req, res) => {
    const { roomTypeId } = req.query;

    const isActive = parseBooleanQuery(req.query.isActive);
    const isRetired = parseBooleanQuery(req.query.isRetired);

    if (!isActive.success || !isRetired.success) {
      return res.status(400).json({
        message: "isActive and isRetired must be true or false",
      });
    }

    try {
      const rooms = await prisma.room.findMany({
        where: {
          ...(roomTypeId ? { roomTypeId } : {}),
          ...(isActive.data !== undefined
            ? { isActive: isActive.data === "true" }
            : {}),
          isRetired:
            isRetired.data !== undefined
              ? isRetired.data === "true"
              : false,
        },
        include: roomInclude,
        orderBy: { roomNumber: "asc" },
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
  }
);

// BLOCK OR UNBLOCK ROOM
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
      const room = await prisma.$transaction(async (tx) => {
        const existingRoom = await tx.room.findUnique({
          where: { id },
        });

        if (!existingRoom) {
          throw new Error("ROOM_NOT_FOUND");
        }

        if (existingRoom.isRetired) {
          throw new Error("ROOM_RETIRED");
        }

        await lockRoomTypes(tx, [existingRoom.roomTypeId]);
        await lockRoom(tx, id);

        const currentRoom = await tx.room.findUnique({
          where: { id },
        });

        if (
          !currentRoom ||
          currentRoom.isRetired ||
          currentRoom.roomTypeId !== existingRoom.roomTypeId
        ) {
          throw new Error("ROOM_CHANGED");
        }

        if (currentRoom.isActive === parsed.data.isActive) {
          return tx.room.findUnique({
            where: { id },
            include: roomInclude,
          });
        }

        if (await hasActiveAssignment(tx, id)) {
          throw new Error("ROOM_HAS_ACTIVE_ASSIGNMENT");
        }

        return tx.room.update({
          where: { id },
          data: { isActive: parsed.data.isActive },
          include: roomInclude,
        });
      });

      return res.status(200).json({
        message: "Room status updated successfully",
        room,
      });
    } catch (error) {
      if (error.message === "ROOM_NOT_FOUND") {
        return res.status(404).json({ message: "Room not found" });
      }

      if (error.message === "ROOM_RETIRED") {
        return res.status(409).json({
          message: "Retired rooms cannot be modified",
        });
      }

      if (error.message === "ROOM_CHANGED") {
        return res.status(409).json({
          message: "Room changed concurrently. Please retry.",
        });
      }

      if (error.message === "ROOM_HAS_ACTIVE_ASSIGNMENT") {
        return res.status(409).json({
          message:
            "This room has an active booking or payment hold and cannot be modified",
        });
      }

      console.error("Update room status error:", error);

      return res.status(500).json({
        message: "Failed to update room status",
      });
    }
  }
);

// CHANGE ROOM CATEGORY
router.patch(
  "/:id/category",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
    const { id } = req.params;
    const parsed = updateRoomCategorySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid room category",
        errors: parsed.error.flatten(),
      });
    }

    const { roomTypeId: targetTypeId } = parsed.data;

    try {
      const room = await prisma.$transaction(async (tx) => {
        const existingRoom = await tx.room.findUnique({
          where: { id },
        });

        if (!existingRoom) {
          throw new Error("ROOM_NOT_FOUND");
        }

        if (existingRoom.isRetired) {
          throw new Error("ROOM_RETIRED");
        }

        if (existingRoom.roomTypeId === targetTypeId) {
          throw new Error("SAME_CATEGORY");
        }

        await lockRoomTypes(tx, [
          existingRoom.roomTypeId,
          targetTypeId,
        ]);

        await lockRoom(tx, id);

        const currentRoom = await tx.room.findUnique({
          where: { id },
        });

        if (
          !currentRoom ||
          currentRoom.isRetired ||
          currentRoom.roomTypeId !== existingRoom.roomTypeId
        ) {
          throw new Error("ROOM_CHANGED");
        }

        const targetType = await tx.roomType.findUnique({
          where: { id: targetTypeId },
        });

        if (!targetType) {
          throw new Error("TARGET_TYPE_NOT_FOUND");
        }

        if (!targetType.isActive) {
          throw new Error("TARGET_TYPE_INACTIVE");
        }

        if (await hasActiveAssignment(tx, id)) {
          throw new Error("ROOM_HAS_ACTIVE_ASSIGNMENT");
        }

        await tx.roomType.update({
          where: { id: currentRoom.roomTypeId },
          data: {
            totalUnits: { decrement: 1 },
          },
        });

        await tx.roomType.update({
          where: { id: targetTypeId },
          data: {
            totalUnits: { increment: 1 },
          },
        });

        return tx.room.update({
          where: { id },
          data: { roomTypeId: targetTypeId },
          include: roomInclude,
        });
      });

      return res.status(200).json({
        message: "Room category changed successfully",
        room,
      });
    } catch (error) {
      if (error.message === "ROOM_NOT_FOUND") {
        return res.status(404).json({ message: "Room not found" });
      }

      if (error.message === "ROOM_RETIRED") {
        return res.status(409).json({
          message: "Retired rooms cannot be modified",
        });
      }

      if (error.message === "SAME_CATEGORY") {
        return res.status(400).json({
          message: "Room already belongs to this category",
        });
      }

      if (error.message === "TARGET_TYPE_NOT_FOUND") {
        return res.status(404).json({
          message: "Target room category not found",
        });
      }

      if (error.message === "TARGET_TYPE_INACTIVE") {
        return res.status(409).json({
          message: "Cannot move a room to an inactive category",
        });
      }

      if (error.message === "ROOM_CHANGED") {
        return res.status(409).json({
          message: "Room changed concurrently. Please retry.",
        });
      }

      if (error.message === "ROOM_HAS_ACTIVE_ASSIGNMENT") {
        return res.status(409).json({
          message:
            "This room has an active booking or payment hold and cannot be moved",
        });
      }

      console.error("Change room category error:", error);

      return res.status(500).json({
        message: "Failed to change room category",
      });
    }
  }
);

// PERMANENTLY RETIRE ROOM (SOFT DELETE)
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const room = await prisma.$transaction(async (tx) => {
        const existingRoom = await tx.room.findUnique({
          where: { id },
        });

        if (!existingRoom) {
          throw new Error("ROOM_NOT_FOUND");
        }

        if (existingRoom.isRetired) {
          throw new Error("ROOM_ALREADY_RETIRED");
        }

        await lockRoomTypes(tx, [existingRoom.roomTypeId]);
        await lockRoom(tx, id);

        const currentRoom = await tx.room.findUnique({
          where: { id },
        });

        if (
          !currentRoom ||
          currentRoom.isRetired ||
          currentRoom.roomTypeId !== existingRoom.roomTypeId
        ) {
          throw new Error("ROOM_CHANGED");
        }

        if (await hasActiveAssignment(tx, id)) {
          throw new Error("ROOM_HAS_ACTIVE_ASSIGNMENT");
        }

        await tx.roomType.update({
          where: { id: currentRoom.roomTypeId },
          data: {
            totalUnits: { decrement: 1 },
          },
        });

        return tx.room.update({
          where: { id },
          data: {
            isActive: false,
            isRetired: true,
          },
          include: roomInclude,
        });
      });

      return res.status(200).json({
        message: "Room permanently retired successfully",
        room,
      });
    } catch (error) {
      if (error.message === "ROOM_NOT_FOUND") {
        return res.status(404).json({ message: "Room not found" });
      }

      if (error.message === "ROOM_ALREADY_RETIRED") {
        return res.status(409).json({
          message: "Room is already retired",
        });
      }

      if (error.message === "ROOM_CHANGED") {
        return res.status(409).json({
          message: "Room changed concurrently. Please retry.",
        });
      }

      if (error.message === "ROOM_HAS_ACTIVE_ASSIGNMENT") {
        return res.status(409).json({
          message:
            "This room has an active booking or payment hold and cannot be retired",
        });
      }

      console.error("Retire room error:", error);

      return res.status(500).json({
        message: "Failed to retire room",
      });
    }
  }
);

export default router;
