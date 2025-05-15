-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "customName" TEXT,
ADD COLUMN     "expirationDate" TIMESTAMP(3),
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usageLimit" INTEGER;
