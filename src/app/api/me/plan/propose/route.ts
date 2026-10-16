import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody, requireUser, route } from "@/lib/api";
import { iberoClasses, missionOccurrences } from "@/lib/busy";
import { rangeBounds } from "@/lib/recommend";
import { getSettings } from "@/lib/rules";
import { proposePersonal } from "@/lib/scheduler";
import { planProposeSchema } from "@/lib/validation";

/**
 * Propuesta personal: con el horario Ibero del miembro, sus reservas y las sesiones fijas de sus proyectos,
 * acomoda las horas semanales que eligió en los huecos libres (no guarda nada).
 */
export const POST = route(async (req) => {
  const me = await requireUser();
  const data = await parseBody(req, planProposeSchema);
  const { start, end, tz } = rangeBounds(data.from, data.to);

  const [settings, user, mine, team, missions] = await Promise.all([
    getSettings(),
    prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { iberoIcs: true, iberoClasses: true } }),
    prisma.booking.findMany({
      where: { start: { lt: end }, end: { gt: start }, participants: { some: { userId: me.id } } },
      select: { start: true, end: true, kind: true, project: { select: { name: true } } },
    }),
    // Horarios en el lab de gente que comparte proyecto conmigo.
    prisma.booking.findMany({
      where: {
        start: { lt: end },
        end: { gt: start },
        kind: { not: "ASYNC" },
        participants: {
          some: { userId: { not: me.id }, user: { projectMemberships: { some: { project: { active: true, members: { some: { userId: me.id } } } } } } },
        },
      },
      select: {
        start: true,
        end: true,
        participants: { select: { userId: true, user: { select: { name: true } } } },
      },
    }),
    missionOccurrences(start, end, tz, me.id),
  ]);
  const classes = iberoClasses(user, start, end, tz);

  const result = proposePersonal({
    fromKey: data.from,
    toKey: data.to,
    timeZone: tz,
    settings,
    weeklyMinutes: Math.round(data.weeklyHours * 60),
    blockMinutes: data.blockMinutes,
    usesLab: data.kind !== "ASYNC",
    busy: [
      // Nunca proponer horas que ya pasaron (p. ej. "Esta semana" empieza hoy).
      ...(Date.now() > start.getTime() ? [{ start, end: new Date(Math.min(Date.now(), end.getTime())) }] : []),
      ...classes.map((c) => ({ start: c.start, end: c.end, isClass: true })),
      ...mine.map((b) => ({ start: b.start, end: b.end })),
      ...missions.map((m) => ({ start: m.start, end: m.end })),
    ],
    teamPresence: team.map((b) => ({ start: b.start, end: b.end })),
  });

  return NextResponse.json({
    hasIbero: Boolean(user.iberoIcs || user.iberoClasses),
    blocks: result.blocks,
    team: team.map((b) => ({
      start: b.start,
      end: b.end,
      names: b.participants.filter((p) => p.userId !== me.id).map((p) => p.user.name.split(" ")[0]),
    })),
    missingMinutes: Object.values(result.missing).reduce((a, b) => a + b, 0),
    busy: [
      ...classes.map((c) => ({ start: c.start, end: c.end, title: c.title, type: "class" as const })),
      ...mine.map((b) => ({
        start: b.start,
        end: b.end,
        title: b.project?.name ?? (b.kind === "ASYNC" ? "Asíncrono" : "Lab"),
        type: "booking" as const,
      })),
      ...missions.map((m) => ({
        start: m.start,
        end: m.end,
        title: m.projectName ? `${m.projectName}: ${m.title}` : m.title,
        type: "mission" as const,
      })),
    ],
  });
});
