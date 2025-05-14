/*
  Warnings:

  - You are about to drop the column `courseTypeId` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the `CourseType` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_courseTypeId_fkey";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "courseTypeId";

-- DropTable
DROP TABLE "CourseType";
