-- Confirmación de asistencia a sesiones fijas (por fecha o para toda la serie).
-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('GOING', 'NOT_GOING');

-- CreateTable
CREATE TABLE "MissionAttendance" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL DEFAULT '',
    "status" "AttendanceStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionAttendance_missionId_date_idx" ON "MissionAttendance"("missionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MissionAttendance_missionId_userId_date_key" ON "MissionAttendance"("missionId", "userId", "date");

-- AddForeignKey
ALTER TABLE "MissionAttendance" ADD CONSTRAINT "MissionAttendance_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAttendance" ADD CONSTRAINT "MissionAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

