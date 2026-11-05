/*
  Warnings:

  - A unique constraint covering the columns `[cancellationTokenHash]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_cancellationTokenHash_key" ON "Booking"("cancellationTokenHash");
