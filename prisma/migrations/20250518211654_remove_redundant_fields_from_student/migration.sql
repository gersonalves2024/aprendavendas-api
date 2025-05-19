/*
  Warnings:

  - You are about to drop the column `affiliateCommission` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `couponId` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `courseId` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `courseModalityId` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `discountAmount` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `installments` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDate` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `paymentForecastDate` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `paymentStatus` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `paymentType` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `Student` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_couponId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_courseModalityId_fkey";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "affiliateCommission",
DROP COLUMN "couponId",
DROP COLUMN "courseId",
DROP COLUMN "courseModalityId",
DROP COLUMN "discountAmount",
DROP COLUMN "installments",
DROP COLUMN "paymentDate",
DROP COLUMN "paymentForecastDate",
DROP COLUMN "paymentStatus",
DROP COLUMN "paymentType",
DROP COLUMN "value";
