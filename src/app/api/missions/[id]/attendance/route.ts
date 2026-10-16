import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, forbidden, notFound, parseBody, requireUser, route, type IdParams } from "@/lib/api";
import { expandMission } from "@/lib/missions";
import { addDaysToKey, appTimeZone, fromLocal, toLocalParts } from "@/lib/time";
import { dateKey } from "@/lib/validation";

const schema = z.object({
  /** Fecha de la sesión (YYYY-MM-DD) */
  date: dateKey,
  /** null = borrar mi respuesta */
  status: z.enum(["GOING", "NOT_GOING"]).nullable(),
  /** "one" = sólo esa fecha; "series" = todas las semanas (a partir de hoy) */
  scope: z.enum(["one", "series"]).default("one"),
});

/** Confirmar (o cambiar) mi asistencia a una sesión fija. */
export const POST = route<IdParams>(async (req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const { date, status, scope } = await parseBody(req, schema);

  const mission = await prisma.mission.findUnique({
    where: { id },
    include: { project: { select: { active: true, members: { where: { userId: me.id }, select: { userId: true } } } } },
  });
  if (!mission || mission.type !== "RECURRING" || !mission.active) throw notFound("La sesión ya no existe");
  if (mission.project && !mission.project.active) throw badRequest("El proyecto está archivado");
  if (mission.project && mission.project.members.length === 0 && me.role !== "ADMIN") {
    throw forbidden("Sólo los integrantes del proyecto confirman asistencia a sus sesiones");
  }

  const tz = appTimeZone();
  // La fecha debe ser una de las sesiones de la serie.
  const occurs = expandMission(mission, fromLocal(date, 0, tz), fromLocal(addDaysToKey(date, 1), 0, tz), tz).length > 0;
  if (!occurs) throw badRequest("Esa fecha no corresponde a la sesión");

  const today = toLocalParts(new Date(), tz).dateKey;
  const key = { missionId_userId_date: { missionId: id, userId: me.id, date: scope === "series" ? "" : date } };

  await prisma.$transaction(async (tx) => {
    if (status) {
      await tx.missionAttendance.upsert({
        where: key,
        create: { missionId: id, userId: me.id, date: scope === "series" ? "" : date, status },
        update: { status },
      });
    } else {
      await tx.missionAttendance.deleteMany({ where: key.missionId_userId_date });
    }
    // Al responder para toda la serie se descartan mis respuestas puntuales de hoy en adelante.
    if (scope === "series") {
      await tx.missionAttendance.deleteMany({ where: { missionId: id, userId: me.id, date: { gte: today, not: "" } } });
    }
  });
  return NextResponse.json({ ok: true });
});
