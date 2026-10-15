import "server-only";
import { prisma } from "./db";
import { busyBlocksFromIcs } from "./ibero";
import { expandMission, type MissionOccurrence } from "./missions";

/** Ocurrencias de las misiones recurrentes activas dentro de [from, to). */
export async function missionOccurrences(from: Date, to: Date, timeZone: string): Promise<MissionOccurrence[]> {
  const missions = await prisma.mission.findMany({ where: { type: "RECURRING", active: true } });
  return missions.flatMap((m) => expandMission(m, from, to, timeZone));
}

/** Clases del calendario Ibero de un usuario; si el archivo guardado ya no se puede leer, se ignora. */
export function iberoClasses(ics: string | null, from: Date, to: Date, timeZone: string) {
  if (!ics) return [];
  try {
    return busyBlocksFromIcs(ics, from, to, timeZone);
  } catch {
    return [];
  }
}

/** Clases Ibero de todos los miembros activos que subieron su horario. */
export async function allIberoClasses(from: Date, to: Date, timeZone: string) {
  const users = await prisma.user.findMany({
    where: { active: true, iberoIcs: { not: null } },
    select: { id: true, iberoIcs: true },
  });
  return users.flatMap((u) => iberoClasses(u.iberoIcs, from, to, timeZone).map((c) => ({ ...c, userId: u.id })));
}
