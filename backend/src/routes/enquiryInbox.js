import { Router } from "express";
import { z } from "zod";
import {
  classifyEnquiry,
  generateReplyDraft,
} from "../services/aiService.js";
import prisma from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);
router.use(authorize("ADMIN", "GM", "DEV", "RESERVATIONS", "SALES"));

function getEnquiryScope(user) {
  if (["ADMIN", "GM", "DEV"].includes(user.role)) {
    return {};
  }

  if (user.role === "RESERVATIONS") {
    return { department: "RESERVATIONS" };
  }

  if (user.role === "SALES") {
    return { department: "SALES" };
  }

  return { id: "__NO_ACCESS__" };
}


// GET /api/enquiries - Staff inbox with search and priority pagination.
router.get("/", async (req, res, next) => {
  try {
    const querySchema = z.object({
      department: z.enum(["UNSORTED", "RESERVATIONS", "SALES", "GM"]).optional(),
      status: z.enum([
        "NEW",
        "ASSIGNED",
        "IN_PROGRESS",
        "WAITING_FOR_GUEST",
        "RESOLVED",
        "CLOSED",
      ]).optional(),
      category: z.enum([
        "UNCLASSIFIED",
        "ROOM_BOOKING",
        "WEDDING_EVENT",
        "CORPORATE_OFFSITE",
        "COMPLAINT",
        "GENERAL",
      ]).optional(),
      search: z.string().trim().max(200).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    });

    const parsed = querySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.issues,
      });
    }

    const {
      department,
      status,
      category,
      search,
      page,
      limit,
    } = parsed.data;

    const scope = getEnquiryScope(req.user);

    const where = {
      ...scope,
      ...(department && { department }),
      ...(status && { status }),
      ...(category && { category }),
      ...(search && {
        OR: [
          { guestName: { contains: search, mode: "insensitive" } },
          { guestEmail: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const pendingStatuses = [
      "NEW",
      "ASSIGNED",
      "IN_PROGRESS",
      "WAITING_FOR_GUEST",
    ];

    const pendingWhere = {
      ...where,
      status: { in: status ? [status].filter((s) => pendingStatuses.includes(s)) : pendingStatuses },
    };

    const completedWhere = {
      ...where,
      status: { in: status ? [status].filter((s) => ["RESOLVED", "CLOSED"].includes(s)) : ["RESOLVED", "CLOSED"] },
    };

    const [pendingTotal, completedTotal] = await Promise.all([
      prisma.enquiry.count({ where: pendingWhere }),
      prisma.enquiry.count({ where: completedWhere }),
    ]);

    const offset = (page - 1) * limit;

    const orderBy = [
      { lastMessageAt: "desc" },
      { createdAt: "desc" },
    ];

    const include = {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      messages: {
        where: { senderType: "GUEST" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
      _count: {
        select: { messages: true },
      },
    };

    let enquiries = [];

    if (offset < pendingTotal) {
      const pendingTake = Math.min(limit, pendingTotal - offset);

      const pendingEnquiries = await prisma.enquiry.findMany({
        where: pendingWhere,
        orderBy,
        skip: offset,
        take: pendingTake,
        include,
      });

      enquiries.push(...pendingEnquiries);

      const remaining = limit - pendingEnquiries.length;

      if (remaining > 0) {
        const completedEnquiries = await prisma.enquiry.findMany({
          where: completedWhere,
          orderBy,
          skip: 0,
          take: remaining,
          include,
        });

        enquiries.push(...completedEnquiries);
      }
    } else {
      enquiries = await prisma.enquiry.findMany({
        where: completedWhere,
        orderBy,
        skip: offset - pendingTotal,
        take: limit,
        include,
      });
    }

    const total = pendingTotal + completedTotal;

    return res.json({
      success: true,
      enquiries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        pending: pendingTotal,
        solved: completedTotal,
      },
    });
  } catch (error) {
    next(error);
  }
});


// GET /api/enquiries/:id - Conversation details
router.get("/:id", async (req, res, next) => {
  try {
    const enquiry = await prisma.enquiry.findFirst({
      where: {
        id: req.params.id,
        ...getEnquiryScope(req.user),
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            senderUser: {
              select: { id: true, name: true, role: true },
            },
          },
        },
        notes: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: { id: true, name: true },
            },
          },
        },
        replyDrafts: {
          orderBy: { createdAt: "desc" },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    return res.json({
      success: true,
      enquiry,
    });
  } catch (error) {
    next(error);
  }
});


const staffActionRoles = [
  "ADMIN",
  "GM",
  "RESERVATIONS",
  "SALES",
];

function canManageEnquiry(user, enquiry) {
  if (["ADMIN", "GM"].includes(user.role)) return true;

  if (user.role === "RESERVATIONS") {
    return enquiry.department === "RESERVATIONS";
  }

  if (user.role === "SALES") {
    return enquiry.department === "SALES";
  }

  return false;
}

async function findManageableEnquiry(id, user) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
  });

  if (!enquiry || !canManageEnquiry(user, enquiry)) {
    return null;
  }

  return enquiry;
}

function recordHistory(tx, enquiry, userId, changes, note) {
  return tx.enquiryStatusHistory.create({
    data: {
      enquiryId: enquiry.id,
      changedById: userId,
      fromStatus: enquiry.status,
      toStatus: changes.status ?? enquiry.status,
      fromDepartment: enquiry.department,
      toDepartment: changes.department ?? enquiry.department,
      note,
    },
  });
}

// Assign an enquiry to a staff member.
// PATCH /api/enquiries/:id/assign
router.patch("/:id/assign", authorize(...staffActionRoles), async (req, res, next) => {
  try {
    const parsed = z.object({
      assignedToId: z.string().uuid(),
      department: z.enum(["RESERVATIONS", "SALES", "GM"]),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.issues,
      });
    }

    const enquiry = await findManageableEnquiry(req.params.id, req.user);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    const { assignedToId, department } = parsed.data;

    if (
      !["ADMIN", "GM"].includes(req.user.role) &&
      department !== req.user.role
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot assign enquiries to another department",
      });
    }

    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!assignee || assignee.role !== department) {
      return res.status(400).json({
        success: false,
        message: "Assignee must belong to the selected department",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.enquiry.update({
        where: { id: enquiry.id },
        data: {
          assignedToId,
          department,
          status: "ASSIGNED",
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      await recordHistory(
        tx,
        enquiry,
        req.user.id,
        { department, status: "ASSIGNED" },
        `Assigned to ${assignee.name}`,
      );

      return result;
    });

    return res.json({
      success: true,
      enquiry: updated,
    });
  } catch (error) {
    next(error);
  }
});


// Change enquiry department.
// PATCH /api/enquiries/:id/route
router.patch("/:id/route", authorize(...staffActionRoles), async (req, res, next) => {
  try {
    const parsed = z.object({
      department: z.enum(["UNSORTED", "RESERVATIONS", "SALES", "GM"]),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.issues,
      });
    }

    const enquiry = await findManageableEnquiry(req.params.id, req.user);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    const { department } = parsed.data;

    if (
      !["ADMIN", "GM"].includes(req.user.role) &&
      ![req.user.role, "UNSORTED"].includes(department)
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot route enquiries to another department",
      });
    }

    const departmentChanged = enquiry.department !== department;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.enquiry.update({
        where: { id: enquiry.id },
        data: {
          department,
          ...(departmentChanged && {
            assignedToId: null,
            ...(enquiry.status === "ASSIGNED" && {
              status: "NEW",
            }),
          }),
        },
      });

      if (departmentChanged) {
        await recordHistory(
          tx,
          enquiry,
          req.user.id,
          {
            department,
            ...(enquiry.status === "ASSIGNED" && {
              status: "NEW",
            }),
          },
          `Department changed from ${enquiry.department} to ${department}`,
        );
      }

      return result;
    });

    return res.json({
      success: true,
      enquiry: updated,
    });
  } catch (error) {
    next(error);
  }
});

// Update enquiry status.
// PATCH /api/enquiries/:id/status
router.patch("/:id/status", authorize(...staffActionRoles), async (req, res, next) => {
  try {
    const parsed = z.object({
      status: z.enum([
        "NEW",
        "ASSIGNED",
        "IN_PROGRESS",
        "WAITING_FOR_GUEST",
        "RESOLVED",
        "CLOSED",
      ]),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.issues,
      });
    }

    const enquiry = await findManageableEnquiry(req.params.id, req.user);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    const { status } = parsed.data;

    if (status === "ASSIGNED" && !enquiry.assignedToId) {
      return res.status(400).json({
        success: false,
        message: "Assign the enquiry to a staff member before setting its status to ASSIGNED",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.enquiry.update({
        where: { id: enquiry.id },
        data: { status },
      });

      await recordHistory(
        tx,
        enquiry,
        req.user.id,
        { status },
        `Status changed to ${status}`,
      );

      return result;
    });

    return res.json({
      success: true,
      enquiry: updated,
    });
  } catch (error) {
    next(error);
  }
});

// Add a private internal note.
// POST /api/enquiries/:id/notes
router.post("/:id/notes", authorize(...staffActionRoles), async (req, res, next) => {
  try {
    const parsed = z.object({
      content: z.string().trim().min(1).max(5000),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.issues,
      });
    }

    const enquiry = await findManageableEnquiry(req.params.id, req.user);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    const note = await prisma.enquiryNote.create({
      data: {
        enquiryId: enquiry.id,
        authorId: req.user.id,
        content: parsed.data.content,
      },
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    });

    return res.status(201).json({
      success: true,
      note,
    });
  } catch (error) {
    next(error);
  }
});

// Add a staff reply to the conversation.
// This records the reply; it does not send it to an external provider.
// POST /api/enquiries/:id/replies
router.post("/:id/replies", authorize(...staffActionRoles), async (req, res, next) => {
  try {
    const parsed = z.object({
      content: z.string().trim().min(1).max(5000),
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.issues,
      });
    }

    const enquiry = await findManageableEnquiry(req.params.id, req.user);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.enquiryMessage.create({
        data: {
          enquiryId: enquiry.id,
          senderType: "STAFF",
          direction: "OUTBOUND",
          source: enquiry.source,
          senderUserId: req.user.id,
          content: parsed.data.content,
        },
        include: {
          senderUser: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      await tx.enquiry.update({
        where: { id: enquiry.id },
        data: { lastMessageAt: new Date() },
      });

      return created;
    });

    return res.status(201).json({
      success: true,
      message,
      delivery: "SIMULATED",
    });
  } catch (error) {
    next(error);
  }
});


// Manually classify an enquiry using Gemini.
// POST /api/enquiries/:id/classify
router.post(
  "/:id/classify",
  authorize(...staffActionRoles),
  async (req, res, next) => {
    try {
      const enquiry = await findManageableEnquiry(
        req.params.id,
        req.user,
      );

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found",
        });
      }

      // Analyse the latest inbound guest message.
      const latestMessage = await prisma.enquiryMessage.findFirst({
        where: {
          enquiryId: enquiry.id,
          senderType: "GUEST",
          direction: "INBOUND",
        },
        orderBy: { createdAt: "desc" },
      });

      if (!latestMessage) {
        return res.status(400).json({
          success: false,
          message: "No guest message available to classify",
        });
      }

      const aiResult = await classifyEnquiry({
        guestName: enquiry.guestName,
        subject: enquiry.subject,
        content: latestMessage.content,
      });

      const departmentChanged =
        enquiry.department !== aiResult.department;

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.enquiry.update({
          where: { id: enquiry.id },
          data: {
            category: aiResult.category,
            department: aiResult.department,
            aiConfidence: aiResult.confidence,
            aiSummary: aiResult.summary,
            aiExtractedData: aiResult.extractedData,
            ...(departmentChanged && {
              assignedToId: null,
              ...(enquiry.status === "ASSIGNED" && {
                status: "NEW",
              }),
            }),
          },
        });

        if (departmentChanged) {
          await recordHistory(
            tx,
            enquiry,
            req.user.id,
            {
              department: aiResult.department,
              ...(enquiry.status === "ASSIGNED" && {
                status: "NEW",
              }),
            },
            `AI classified enquiry and recommended ${aiResult.department}`,
          );
        }

        return result;
      });

      return res.json({
        success: true,
        enquiry: updated,
        ai: {
          category: aiResult.category,
          department: aiResult.department,
          confidence: aiResult.confidence,
          summary: aiResult.summary,
          extractedData: aiResult.extractedData,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);


router.post(
  "/:id/reply-drafts",
  authorize(...staffActionRoles),
  async (req, res, next) => {
  try {
    const enquiry = await findManageableEnquiry(
      req.params.id,
      req.user,
    );

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found or access denied",
      },
      );
    }

    const enquiryWithMessages = await prisma.enquiry.findUnique({
      where: { id: enquiry.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const draftContent = await generateReplyDraft(
      enquiryWithMessages,
    );

    const draft = await prisma.enquiryReplyDraft.create({
      data: {
        enquiryId: enquiry.id,
        content: draftContent,
        status: "PENDING_REVIEW",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Reply draft generated successfully",
      draft,
    });
  } catch (error) {
    console.error("Reply draft generation failed:", error);

    return res.status(502).json({
      success: false,
      message: "Unable to generate reply draft. Please try again.",
    });
  }
});


const draftContentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

// PATCH /api/enquiries/:id/reply-drafts/:draftId
// Edit a pending AI-generated draft.
router.patch(
  "/:id/reply-drafts/:draftId",
  authorize(...staffActionRoles),
  async (req, res, next) => {
    try {
      const parsed = draftContentSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.issues,
        });
      }

      const enquiry = await findManageableEnquiry(
        req.params.id,
        req.user,
      );

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found",
        });
      }

      const result = await prisma.enquiryReplyDraft.updateMany({
        where: {
          id: req.params.draftId,
          enquiryId: enquiry.id,
          status: "PENDING_REVIEW",
        },
        data: {
          content: parsed.data.content,
        },
      });

      if (result.count === 0) {
        return res.status(409).json({
          success: false,
          message: "Draft not found or is no longer editable",
        });
      }

      const draft = await prisma.enquiryReplyDraft.findUnique({
        where: { id: req.params.draftId },
      });

      return res.json({
        success: true,
        message: "Draft updated successfully",
        draft,
      });
    } catch (error) {
      next(error);
    }
  },
);


// POST /api/enquiries/:id/reply-drafts/:draftId/approve
// Approve and simulate sending the exact edited content.
router.post(
  "/:id/reply-drafts/:draftId/approve",
  authorize(...staffActionRoles),
  async (req, res, next) => {
    try {
      const enquiry = await findManageableEnquiry(
        req.params.id,
        req.user,
      );

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const draft = await tx.enquiryReplyDraft.findFirst({
          where: {
            id: req.params.draftId,
            enquiryId: enquiry.id,
            status: "PENDING_REVIEW",
          },
        });

        if (!draft) {
          return null;
        }

        // Conditional update prevents duplicate approvals.
        const updated = await tx.enquiryReplyDraft.updateMany({
          where: {
            id: draft.id,
            status: "PENDING_REVIEW",
          },
          data: {
            status: "SENT",
            approvedById: req.user.id,
            reviewedAt: new Date(),
            sentAt: new Date(),
          },
        });

        if (updated.count === 0) {
          return null;
        }

        const message = await tx.enquiryMessage.create({
          data: {
            enquiryId: enquiry.id,
            senderType: "STAFF",
            direction: "OUTBOUND",
            source: enquiry.source,
            senderUserId: req.user.id,
            content: draft.content,
          },
          include: {
            senderUser: {
              select: { id: true, name: true, role: true },
            },
          },
        });

        await tx.enquiry.update({
          where: { id: enquiry.id },
          data: { lastMessageAt: new Date() },
        });

        return { draftId: draft.id, message };
      });

      if (!result) {
        return res.status(409).json({
          success: false,
          message: "Draft not found or already reviewed",
        });
      }

      return res.json({
        success: true,
        message: "Draft approved and simulated as sent",
        delivery: "SIMULATED",
        result,
      });
    } catch (error) {
      next(error);
    }
  },
);


// POST /api/enquiries/:id/reply-drafts/:draftId/reject
router.post(
  "/:id/reply-drafts/:draftId/reject",
  authorize(...staffActionRoles),
  async (req, res, next) => {
    try {
      const enquiry = await findManageableEnquiry(
        req.params.id,
        req.user,
      );

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found",
        });
      }

      const result = await prisma.enquiryReplyDraft.updateMany({
        where: {
          id: req.params.draftId,
          enquiryId: enquiry.id,
          status: "PENDING_REVIEW",
        },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return res.status(409).json({
          success: false,
          message: "Draft not found or already reviewed",
        });
      }

      const draft = await prisma.enquiryReplyDraft.findUnique({
        where: { id: req.params.draftId },
      });

      return res.json({
        success: true,
        message: "Draft rejected successfully",
        draft,
      });
    } catch (error) {
      next(error);
    }
  },
);

// DEV-only: permanently delete an enquiry.
// DELETE /api/enquiries/:id
router.delete("/:id", authorize("DEV"), async (req, res, next) => {
  try {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: req.params.id },
      select: { id: true, subject: true },
    });

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    await prisma.enquiry.delete({
      where: { id: enquiry.id },
    });

    return res.json({
      success: true,
      message: "Enquiry permanently deleted",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
