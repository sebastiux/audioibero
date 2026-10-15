-- Modelo nuevo: todos están disponibles por defecto. Los miembros reservan horas (Booking)
-- y otros pueden unirse a la misma reserva (BookingParticipant).

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "kind" "SlotKind" NOT NULL DEFAULT 'LAB',
    "projectId" TEXT,
    "notes" TEXT,
    "source" "AssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingParticipant" (
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingParticipant_pkey" PRIMARY KEY ("bookingId","userId")
);

-- CreateIndex
CREATE INDEX "Booking_start_end_idx" ON "Booking"("start", "end");
CREATE INDEX "BookingParticipant_userId_idx" ON "BookingParticipant"("userId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingParticipant" ADD CONSTRAINT "BookingParticipant_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingParticipant" ADD CONSTRAINT "BookingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar datos: asignaciones → reservas
INSERT INTO "Booking" ("id", "start", "end", "kind", "projectId", "notes", "source", "createdById", "createdAt", "updatedAt")
SELECT "id", "start", "end", "kind", "projectId", "notes", "source", "createdById", "createdAt", "updatedAt" FROM "Assignment";
INSERT INTO "BookingParticipant" ("bookingId", "userId", "createdAt")
SELECT "id", "userId", "createdAt" FROM "Assignment";

-- Migrar datos: espacios libres → reservas del propio miembro (si no chocan con una asignación suya)
INSERT INTO "Booking" ("id", "start", "end", "kind", "projectId", "notes", "source", "createdById", "createdAt", "updatedAt")
SELECT av."id", av."start", av."end", av."kind", av."projectId", av."notes", 'MANUAL', av."userId", av."createdAt", av."updatedAt"
FROM "Availability" av
WHERE NOT EXISTS (
  SELECT 1 FROM "Assignment" a WHERE a."userId" = av."userId" AND a."start" < av."end" AND a."end" > av."start"
);
INSERT INTO "BookingParticipant" ("bookingId", "userId", "createdAt")
SELECT av."id", av."userId", av."createdAt"
FROM "Availability" av
WHERE EXISTS (SELECT 1 FROM "Booking" b WHERE b."id" = av."id");

-- DropTable
DROP TABLE "Assignment";
DROP TABLE "Availability";

-- AlterTable
ALTER TABLE "LabSettings" DROP COLUMN "minSessionMinutes",
ADD COLUMN     "projectSessionMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "projectWeeklyMinutes" INTEGER NOT NULL DEFAULT 240;
