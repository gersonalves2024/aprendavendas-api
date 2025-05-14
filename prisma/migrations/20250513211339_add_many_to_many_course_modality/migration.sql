/*
  Warnings:

  - You are about to drop the column `courseModalityId` on the `Course` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_courseModalityId_fkey";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "courseModalityId";

-- CreateTable
CREATE TABLE "CourseToModality" (
    "courseId" INTEGER NOT NULL,
    "courseModalityId" INTEGER NOT NULL,

    CONSTRAINT "CourseToModality_pkey" PRIMARY KEY ("courseId","courseModalityId")
);

-- AddForeignKey
ALTER TABLE "CourseToModality" ADD CONSTRAINT "CourseToModality_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseToModality" ADD CONSTRAINT "CourseToModality_courseModalityId_fkey" FOREIGN KEY ("courseModalityId") REFERENCES "CourseModality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
