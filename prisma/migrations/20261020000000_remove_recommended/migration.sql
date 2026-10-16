-- Se quita el calendario recomendado (Mi plan lo reemplaza): ya no se usan sus ajustes.
-- AlterTable
ALTER TABLE "LabSettings" DROP COLUMN "projectSessionMinutes",
DROP COLUMN "projectWeeklyMinutes";

