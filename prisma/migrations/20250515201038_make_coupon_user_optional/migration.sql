-- DropForeignKey
ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_userId_fkey";

-- AlterTable
ALTER TABLE "Coupon" ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
