-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "popularity" INTEGER NOT NULL DEFAULT 0;
