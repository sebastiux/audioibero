import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { busyBlocksFromIcs } from "./ibero";
import type { IberoClass } from "./ibero-pdf";
import { expandMission, type MissionOccurrence } from "./missions";

/** Ocurrencias de las misiones recurrentes activas dentro de [from, to). */
export async function missionOccurrences(from: Date, to: Date, timeZone: string): Promise<MissionOccurrence[]> {
  const missions = await prisma.mission.findMany({ where: { type: "RECURRING", active: true } });
  return missions.flatMap((m) => expandMission(m, from, to, timeZone));
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

/** Clases Ibero de todos los miembros activos que subieron su horario. */
export async function allIberoClasses(from: Date, to: Date, timeZone: string) {
  const users = await prisma.user.findMany({
    where: { active: true, OR: [{ iberoIcs: { not: null } }, { iberoClasses: { not: Prisma.DbNull } }] },
    select: { id: true, iberoIcs: true, iberoClasses: true },
  });
  return users.flatMap((u) => iberoClasses(u, from, to, timeZone).map((c) => ({ ...c, userId: u.id })));
}
