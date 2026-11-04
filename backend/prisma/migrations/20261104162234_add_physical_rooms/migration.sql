-- CreateIndex
CREATE INDEX "Room_roomTypeId_isActive_idx" ON "Room"("roomTypeId", "isActive");

-- CreateIndex
CREATE INDEX "RoomAssignment_bookingId_idx" ON "RoomAssignment"("bookingId");
