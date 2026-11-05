-- DropIndex
DROP INDEX "Room_roomTypeId_isActive_idx";

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "isRetired" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Room_roomTypeId_isActive_isRetired_idx" ON "Room"("roomTypeId", "isActive", "isRetired");
