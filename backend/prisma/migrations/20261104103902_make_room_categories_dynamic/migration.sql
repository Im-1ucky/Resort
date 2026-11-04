-- Remove the old unique index
DROP INDEX "RoomType_category_key";

-- Add the new name column temporarily as nullable
ALTER TABLE "RoomType"
ADD COLUMN "name" TEXT;

-- Copy existing category names into the new column
UPDATE "RoomType"
SET "name" = "category"::TEXT;

-- Make name mandatory
ALTER TABLE "RoomType"
ALTER COLUMN "name" SET NOT NULL;

-- Add active/inactive toggle
ALTER TABLE "RoomType"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Remove old category column
ALTER TABLE "RoomType"
DROP COLUMN "category";

-- Remove old enum
DROP TYPE "RoomCategory";

-- Add unique constraint
CREATE UNIQUE INDEX "RoomType_name_key"
ON "RoomType"("name");
