-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CARD');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paymentMethod" "PaymentMethod";
