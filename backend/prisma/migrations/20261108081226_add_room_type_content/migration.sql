-- AlterTable
ALTER TABLE "RoomType" ADD COLUMN     "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "area" INTEGER,
ADD COLUMN     "bedConfiguration" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "shortDescription" TEXT;
