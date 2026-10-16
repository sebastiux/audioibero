import "server-only";
import { prisma } from "./db";
import { busyBlocksFromIcs } from "./ibero";
import type { IberoClass } from "./ibero-pdf";
import { expandMission, type MissionOccurrence } from "./missions";
import { toLocalParts } from "./time";

export type ProjectSessionOccurrence = MissionOccurrence & {
  /** Fecha de la sesión (YYYY-MM-DD, hora del club) */
  dateKey: string;
  kind: "LAB" | "PROJECT" | "ASYNC";
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  /** Integrantes del proyecto (vacío = sesión de todo el club) */
  memberIds: string[];
};

/**
 * Sesiones fijas (recurrentes) de los proyectos activos dentro de [from, to).
 * Con `forUserId` sólo devuelve las de sus proyectos y las generales del club.
 */
export async function missionOccurrences(
  from: Date,
  to: Date,
  timeZone: string,
  forUserId?: string,
): Promise<ProjectSessionOccurrence[]> {
  const missions = await prisma.mission.findMany({
    where: {
      type: "RECURRING",
      active: true,
      OR: [{ projectId: null }, { project: { active: true, ...(forUserId ? { members: { some: { userId: forUserId } } } : {}) } }],
    },
    include: { project: { select: { name: true, color: true, members: { select: { userId: true } } } } },
  });
  return missions.flatMap((m) =>
    expandMission(m, from, to, timeZone).map((o) => ({
      ...o,
      dateKey: toLocalParts(o.start, timeZone).dateKey,
      kind: m.kind,
      projectId: m.projectId,
      projectName: m.project?.name ?? null,
      projectColor: m.project?.color ?? null,
      memberIds: m.project?.members.map((x) => x.userId) ?? [],
    })),
  );
}

type IberoSource = { iberoIcs: string | null; iberoClasses: unknown };

/** Clases Ibero de un usuario (del PDF de materias o del .ics); si lo guardado no se puede leer, se ignora. */
export function iberoClasses(user: IberoSource, from: Date, to: Date, timeZone: string) {
  if (Array.isArray(user.iberoClasses)) {
    return (user.iberoClasses as IberoClass[]).flatMap((c) =>
      expandMission(
        {
          id: c.code,
          title: c.name,
          weekdays: [c.weekday],
          startMinute: c.startMinute,
          endMinute: c.endMinute,
          startsOn: new Date(`${c.startsOn}T00:00:00Z`),
          endsOn: new Date(`${c.endsOn}T00:00:00Z`),
        },
        from,
        to,
        timeZone,
      ).map((o) => ({ start: o.start, end: o.end, title: c.name })),
    );
  }
  if (!user.iberoIcs) return [];
  try {
    return busyBlocksFromIcs(user.iberoIcs, from, to, timeZone);
  } catch {
    return [];
  }
}
