-- Las misiones pasan a ser actividades de proyecto (recordatorios y sesiones fijas). El lab ya no tiene cupo ni tope semanal por persona.
-- AlterTable
ALTER TABLE "LabSettings" DROP COLUMN "capacity",
DROP COLUMN "maxWeeklyMinutes";

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Mission_projectId_idx" ON "Mission"("projectId");

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

