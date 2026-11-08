import express from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();


const roomContentFields = {
  shortDescription: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(3000).nullable().optional(),
  area: z.number().int().positive().nullable().optional(),
  bedConfiguration: z.string().trim().max(100).nullable().optional(),
  amenities: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  images: z.array(z.string().trim().min(1)).max(20).optional(),
};

const createRoomTypeSchema = z.object({
  name: z.string().trim().min(1).max(50),
  maxGuests: z.number().int().min(1).max(50),
  ...roomContentFields,
});

const updateRoomTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    maxGuests: z.number().int().min(1).max(50).optional(),
    isActive: z.boolean().optional(),
    ...roomContentFields,
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided" }
  );


// CREATE ROOM TYPE
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
    const parsed = createRoomTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid room category details",
        errors: parsed.error.flatten(),
      });
    }

    try {
      const roomType = await prisma.roomType.create({
        data: {
          ...parsed.data,
          totalUnits: 0,
        },
      });

      return res.status(201).json({
        message: "Room category created successfully",
        roomType,
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({
          message: "A room category with this name already exists",
        });
      }

      console.error("Create room type error:", error);

      return res.status(500).json({
        message: "Failed to create room category",
      });
    }
  }
);


// PUBLIC: LIST ACTIVE ROOM CATEGORIES
router.get("/public", async (req, res) => {
  try {
    const roomTypes = await prisma.roomType.findMany({
      where: {
        isActive: true,
        totalUnits: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        shortDescription: true,
        description: true,
        maxGuests: true,
        totalUnits: true,
        area: true,
        bedConfiguration: true,
        amenities: true,
        images: true,
      },
    });

    return res.status(200).json({
      success: true,
      count: roomTypes.length,
      roomTypes,
    });
  } catch (error) {
    console.error("Public room types error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch rooms",
    });
  }
});

// PUBLIC: GET ONE ROOM CATEGORY
router.get("/public/:id", async (req, res) => {
  try {
    const roomType = await prisma.roomType.findFirst({
      where: {
        id: req.params.id,
        isActive: true,
        totalUnits: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        shortDescription: true,
        description: true,
        maxGuests: true,
        totalUnits: true,
        area: true,
        bedConfiguration: true,
        amenities: true,
        images: true,
      },
    });

    if (!roomType) {
      return res.status(404).json({
        success: false,
        message: "Room category not found",
      });
    }

    return res.status(200).json({
      success: true,
      roomType,
    });
  } catch (error) {
    console.error("Public room detail error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch room details",
    });
  }
});


// LIST ROOM TYPES
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "RESERVATIONS", "GM"),
  async (req, res) => {
    const isActive = z.enum(["true", "false"]).optional().safeParse(
      req.query.isActive
    );

    if (!isActive.success) {
      return res.status(400).json({
        message: "isActive must be true or false",
      });
    }

    try {
      const roomTypes = await prisma.roomType.findMany({
        where: {
          ...(isActive.data !== undefined
            ? { isActive: isActive.data === "true" }
            : {}),
        },
        include: {
          _count: {
            select: {
              rooms: true,
              bookingItems: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      return res.status(200).json({
        count: roomTypes.length,
        roomTypes,
      });
    } catch (error) {
      console.error("Fetch room types error:", error);

      return res.status(500).json({
        message: "Failed to fetch room categories",
      });
    }
  }
);

// UPDATE ROOM TYPE
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  async (req, res) => {
    const { id } = req.params;
    const parsed = updateRoomTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid room category update",
        errors: parsed.error.flatten(),
      });
    }

    try {
      const existing = await prisma.roomType.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          message: "Room category not found",
        });
      }

      const roomType = await prisma.roomType.update({
        where: { id },
        data: parsed.data,
      });

      return res.status(200).json({
        message: "Room category updated successfully",
        roomType,
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({
          message: "A room category with this name already exists",
        });
      }

      console.error("Update room type error:", error);

      return res.status(500).json({
        message: "Failed to update room category",
      });
    }
  }
);

export default router;
