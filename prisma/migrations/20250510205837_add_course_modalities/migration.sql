/*
  Warnings:

  - Added the required column `courseModalityId` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `courseModalityId` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "CourseModality" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseModality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseModality_code_key" ON "CourseModality"("code");

-- Inserir dados iniciais para as modalidades
INSERT INTO "CourseModality" ("code", "name", "description", "updatedAt") 
VALUES 
('FORM', 'Formação', 'Curso inicial para formação de profissionais', CURRENT_TIMESTAMP),
('ATUAL', 'Atualização', 'Curso de renovação/atualização para profissionais', CURRENT_TIMESTAMP);

-- AlterTable - Adicionar coluna na tabela Course com valor padrão 1 (assumimos que Formação tem id=1)
ALTER TABLE "Course" ADD COLUMN "courseModalityId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable - Adicionar coluna na tabela Student com valor padrão 1 (assumimos que Formação tem id=1)
ALTER TABLE "Student" ADD COLUMN "courseModalityId" INTEGER NOT NULL DEFAULT 1;

-- Remover os valores default após a migração
ALTER TABLE "Course" ALTER COLUMN "courseModalityId" DROP DEFAULT;
ALTER TABLE "Student" ALTER COLUMN "courseModalityId" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_courseModalityId_fkey" FOREIGN KEY ("courseModalityId") REFERENCES "CourseModality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseModalityId_fkey" FOREIGN KEY ("courseModalityId") REFERENCES "CourseModality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
