-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "refreshTokenHash" TEXT;
