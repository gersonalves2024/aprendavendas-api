/*
  Warnings:

  - You are about to drop the column `courseName` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `courseType` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDates` on the `Student` table. All the data in the column will be lost.
  - Added the required column `courseId` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `courseTypeId` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- Primeiro, criamos as novas tabelas

-- CreateTable
CREATE TABLE "CourseType" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "courseTypeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseType_code_key" ON "CourseType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- Inserir dados iniciais para as tabelas CourseType e Course
INSERT INTO "CourseType" ("code", "name", "description", "updatedAt") 
VALUES 
('FORM', 'Formação', 'Cursos para formação inicial', CURRENT_TIMESTAMP);

-- Obter o ID da CourseType para usar na inserção do Course
DO $$
DECLARE formacao_id INTEGER;
BEGIN
  SELECT id INTO formacao_id FROM "CourseType" WHERE "code" = 'FORM';
  
  INSERT INTO "Course" ("code", "name", "description", "courseTypeId", "updatedAt") 
  VALUES 
  ('COLETPAS', 'Coletivos de Passageiros', 'Curso para condutores de veículos de transporte coletivo de passageiros', formacao_id, CURRENT_TIMESTAMP);
END $$;

-- Adicionamos campos temporários para facilitar a migração
ALTER TABLE "Student" ADD COLUMN "temp_courseTypeId" INTEGER;
ALTER TABLE "Student" ADD COLUMN "temp_courseId" INTEGER;

-- Atualizamos os valores temporários
DO $$
DECLARE 
  formacao_id INTEGER;
  curso_id INTEGER;
BEGIN
  SELECT id INTO formacao_id FROM "CourseType" WHERE "code" = 'FORM';
  SELECT id INTO curso_id FROM "Course" WHERE "code" = 'COLETPAS';
  
  UPDATE "Student" SET "temp_courseTypeId" = formacao_id, "temp_courseId" = curso_id;
END $$;

-- Agora alteramos a tabela Student com os valores temporários
ALTER TABLE "Student" DROP COLUMN "courseName";
ALTER TABLE "Student" DROP COLUMN "courseType";
ALTER TABLE "Student" DROP COLUMN "paymentDates";
ALTER TABLE "Student" ADD COLUMN "courseTypeId" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN "courseId" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Student" ADD COLUMN "paymentDate" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN "paymentForecastDate" TIMESTAMP(3);

-- Preenchemos com os valores reais
UPDATE "Student" SET "courseTypeId" = "temp_courseTypeId", "courseId" = "temp_courseId";

-- Removemos os campos temporários e defaults
ALTER TABLE "Student" DROP COLUMN "temp_courseTypeId";
ALTER TABLE "Student" DROP COLUMN "temp_courseId";
ALTER TABLE "Student" ALTER COLUMN "courseTypeId" DROP DEFAULT;
ALTER TABLE "Student" ALTER COLUMN "courseId" DROP DEFAULT;

-- Adicionamos as restrições de chave estrangeira
ALTER TABLE "Course" ADD CONSTRAINT "Course_courseTypeId_fkey" FOREIGN KEY ("courseTypeId") REFERENCES "CourseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseTypeId_fkey" FOREIGN KEY ("courseTypeId") REFERENCES "CourseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
