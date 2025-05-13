-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'AFFILIATE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;
