-- CreateEnum
CREATE TYPE "CouponApplicationMode" AS ENUM ('GENERAL', 'SPECIFIC');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "affiliateCommission" DOUBLE PRECISION,
ADD COLUMN     "couponId" INTEGER,
ADD COLUMN     "discountAmount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Coupon" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "applicationMode" "CouponApplicationMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponConfiguration" (
    "id" SERIAL NOT NULL,
    "couponId" INTEGER NOT NULL,
    "courseId" INTEGER,
    "courseModalityId" INTEGER,
    "baseValue" DOUBLE PRECISION,
    "discountValue" DOUBLE PRECISION,
    "discountPercent" DOUBLE PRECISION,
    "commissionValue" DOUBLE PRECISION,
    "commissionPercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_userId_key" ON "Coupon"("userId");

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponConfiguration" ADD CONSTRAINT "CouponConfiguration_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponConfiguration" ADD CONSTRAINT "CouponConfiguration_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponConfiguration" ADD CONSTRAINT "CouponConfiguration_courseModalityId_fkey" FOREIGN KEY ("courseModalityId") REFERENCES "CourseModality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
