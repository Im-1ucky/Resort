/*
  Warnings:

  - The values [DEV] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `bedConfiguration` on the `RoomType` table. All the data in the column will be lost.

*/
-- AlterEnum
-- Remove DEV from UserRole enum
BEGIN;

CREATE TYPE "UserRole_new" AS ENUM (
    'GUEST',
    'RESERVATIONS',
    'SALES',
    'ADMIN',
    'GM'
);

ALTER TABLE "User"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
ALTER COLUMN "role" TYPE "UserRole_new"
USING ("role"::text::"UserRole_new");

ALTER TYPE "UserRole" RENAME TO "UserRole_old";

ALTER TYPE "UserRole_new" RENAME TO "UserRole";

DROP TYPE "UserRole_old";

ALTER TABLE "User"
ALTER COLUMN "role" SET DEFAULT 'GUEST';

COMMIT;

-- Add isActive to User
ALTER TABLE "User"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
