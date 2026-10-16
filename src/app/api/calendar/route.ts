import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireUser, route } from "@/lib/api";
import { attendanceFor } from "@/lib/attendance";
import { bookingInclude } from "@/lib/bookings";
import { missionOccurrences } from "@/lib/busy";
import { appTimeZone } from "@/lib/time";

/** Horarios y sesiones fijas (con quién confirmó asistencia) que se muestran en el calendario. */
export const GET = route(async (req) => {
  const me = await requireUser();
  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") ?? "");
  const to = new Date(url.searchParams.get("to") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw badRequest("Rango de fechas inválido");
  }
  if (to.getTime() - from.getTime() > 1000 * 60 * 60 * 24 * 367) throw badRequest("El rango máximo es de un año");

  const [bookings, occurrences] = await Promise.all([
    prisma.booking.findMany({
      where: { start: { lt: to }, end: { gt: from } },
      include: bookingInclude,
      orderBy: { start: "asc" },
    }),
    missionOccurrences(from, to, appTimeZone()),
  ]);

  const missionIds = [...new Set(occurrences.map((o) => o.missionId))];
  const rows = missionIds.length
    ? await prisma.missionAttendance.findMany({
        where: { missionId: { in: missionIds }, user: { active: true } },
        select: { missionId: true, userId: true, date: true, status: true, user: { select: { name: true } } },
      })
    : [];
  const names = new Map(rows.map((r) => [r.userId, r.user.name]));

  const missions = occurrences.map((o) => {
    const status = attendanceFor(rows.filter((r) => r.missionId === o.missionId), o.dateKey);
    const list = (s: "GOING" | "NOT_GOING") =>
      [...status].filter(([, v]) => v === s).map(([userId]) => ({ userId, name: names.get(userId) ?? "—" }));
    return {
      missionId: o.missionId,
      title: o.title,
      start: o.start,
      end: o.end,
      dateKey: o.dateKey,
      kind: o.kind,
      projectId: o.projectId,
      projectName: o.projectName,
      projectColor: o.projectColor,
      going: list("GOING"),
      notGoing: list("NOT_GOING"),
      myStatus: status.get(me.id) ?? null,
      // A las sesiones de un proyecto responden sus integrantes (y el admin); a las del club, todos.
      canRespond: !o.projectId || o.memberIds.includes(me.id) || me.role === "ADMIN",
    };
  });

  return NextResponse.json({ bookings, missions });
});
