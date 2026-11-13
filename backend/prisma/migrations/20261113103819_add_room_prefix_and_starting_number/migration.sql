/*
  Warnings:

  - You are about to drop the column `bedConfiguration` on the `RoomType` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[roomPrefix]` on the table `RoomType` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `roomPrefix` to the `RoomType` table without a default value. This is not possible if the table is not empty.

*/
ALTER TABLE "RoomType"
ADD COLUMN "roomPrefix" TEXT,
ADD COLUMN "startingNumber" INTEGER NOT NULL DEFAULT 101;

UPDATE "RoomType"
SET "roomPrefix" = CASE UPPER("name")
    WHEN 'DELUXE ROOM' THEN 'DR'
    WHEN 'DELUXE VILLA' THEN 'DV'
    WHEN 'ROOM' THEN 'R'
    WHEN 'VILLA' THEN 'V'
END;

ALTER TABLE "RoomType"
ALTER COLUMN "roomPrefix" SET NOT NULL;

CREATE UNIQUE INDEX "RoomType_roomPrefix_key"
ON "RoomType"("roomPrefix");
