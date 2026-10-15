-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('REMINDER', 'RECURRING');

-- AlterEnum
ALTER TYPE "SlotKind" ADD VALUE 'ASYNC';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "iberoIcs" TEXT,
ADD COLUMN     "iberoIcsUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MissionType" NOT NULL DEFAULT 'REMINDER',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" TIMESTAMP(3),
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "kind" "SlotKind" NOT NULL DEFAULT 'LAB',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

