-- CreateEnum
CREATE TYPE "EnquirySource" AS ENUM ('WEBSITE', 'EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "EnquiryCategory" AS ENUM ('UNCLASSIFIED', 'ROOM_BOOKING', 'WEDDING_EVENT', 'CORPORATE_OFFSITE', 'COMPLAINT', 'GENERAL');

-- CreateEnum
CREATE TYPE "EnquiryDepartment" AS ENUM ('UNSORTED', 'RESERVATIONS', 'SALES', 'GM');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_GUEST', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EnquiryMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "EnquiryMessageSender" AS ENUM ('GUEST', 'STAFF', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReplyDraftStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SENT');

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT,
    "subject" TEXT NOT NULL,
    "source" "EnquirySource" NOT NULL DEFAULT 'WEBSITE',
    "category" "EnquiryCategory" NOT NULL DEFAULT 'UNCLASSIFIED',
    "department" "EnquiryDepartment" NOT NULL DEFAULT 'UNSORTED',
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "aiConfidence" DECIMAL(5,4),
    "aiSummary" TEXT,
    "aiExtractedData" JSONB,
    "assignedToId" TEXT,
    "relatedBookingId" TEXT,
    "eventType" TEXT,
    "eventDate" DATE,
    "eventGuestCount" INTEGER,
    "eventBudget" DECIMAL(12,2),
    "externalThreadId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryMessage" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "senderType" "EnquiryMessageSender" NOT NULL,
    "direction" "EnquiryMessageDirection" NOT NULL,
    "source" "EnquirySource" NOT NULL,
    "senderUserId" TEXT,
    "content" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryNote" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryReplyDraft" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ReplyDraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "approvedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnquiryReplyDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryStatusHistory" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "changedById" TEXT,
    "fromStatus" "EnquiryStatus",
    "toStatus" "EnquiryStatus",
    "fromDepartment" "EnquiryDepartment",
    "toDepartment" "EnquiryDepartment",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Enquiry_department_status_createdAt_idx" ON "Enquiry"("department", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Enquiry_assignedToId_status_idx" ON "Enquiry"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Enquiry_category_createdAt_idx" ON "Enquiry"("category", "createdAt");

-- CreateIndex
CREATE INDEX "Enquiry_guestEmail_idx" ON "Enquiry"("guestEmail");

-- CreateIndex
CREATE INDEX "Enquiry_externalThreadId_idx" ON "Enquiry"("externalThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryMessage_externalMessageId_key" ON "EnquiryMessage"("externalMessageId");

-- CreateIndex
CREATE INDEX "EnquiryMessage_enquiryId_createdAt_idx" ON "EnquiryMessage"("enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "EnquiryNote_enquiryId_createdAt_idx" ON "EnquiryNote"("enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "EnquiryReplyDraft_enquiryId_status_idx" ON "EnquiryReplyDraft"("enquiryId", "status");

-- CreateIndex
CREATE INDEX "EnquiryStatusHistory_enquiryId_createdAt_idx" ON "EnquiryStatusHistory"("enquiryId", "createdAt");

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_relatedBookingId_fkey" FOREIGN KEY ("relatedBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryReplyDraft" ADD CONSTRAINT "EnquiryReplyDraft_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryReplyDraft" ADD CONSTRAINT "EnquiryReplyDraft_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryStatusHistory" ADD CONSTRAINT "EnquiryStatusHistory_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryStatusHistory" ADD CONSTRAINT "EnquiryStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
