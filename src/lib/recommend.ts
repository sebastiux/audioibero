import "server-only";
import { prisma } from "./db";
import { badRequest } from "./api";
import { getSettings } from "./rules";
import { recommendSchedule } from "./scheduler";
import { addDaysToKey, appTimeZone, fromLocal } from "./time";

export function rangeBounds(fromKey: string, toKey: string) {
  if (toKey < fromKey) throw badRequest("La fecha final debe ser posterior a la inicial");
  const tz = appTimeZone();
  const start = fromLocal(fromKey, 0, tz);
  const end = fromLocal(addDaysToKey(toKey, 1), 0, tz);
  if (end.getTime() - start.getTime() > 1000 * 60 * 60 * 24 * 32) throw badRequest("El rango máximo es de 31 días");
  return { start, end, tz };
}

/** Arma el calendario recomendado con los datos actuales de la BD (no guarda nada). */
export async function buildRecommendation(fromKey: string, toKey: string, replaceRecommended: boolean) {
  const { start, end, tz } = rangeBounds(fromKey, toKey);
  // Se amplía una semana hacia cada lado para contar bien el tope semanal y las sesiones existentes.
  const week = 7 * 24 * 60 * 60 * 1000;
  const wideStart = new Date(start.getTime() - week);
  const wideEnd = new Date(end.getTime() + week);

  const [settings, projects, existing, users] = await Promise.all([
    getSettings(),
    prisma.project.findMany({
      where: { active: true },
      include: { members: { where: { user: { active: true } }, select: { userId: true } } },
    }),
    prisma.booking.findMany({
      where: {
        start: { lt: wideEnd },
        end: { gt: wideStart },
        // Las recomendadas previas del periodo se reemplazarán: no cuentan.
        ...(replaceRecommended
          ? { NOT: { source: "RECOMMENDED" as const, start: { lt: end }, end: { gt: start } } }
          : {}),
      },
      select: { start: true, end: true, projectId: true, participants: { select: { userId: true } } },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const result = recommendSchedule({
    fromKey,
    toKey,
    timeZone: tz,
    settings,
    projects: projects.map((p) => ({ id: p.id, name: p.name, memberIds: p.members.map((m) => m.userId) })),
    existing: existing.map((b) => ({
      start: b.start,
      end: b.end,
      projectId: b.projectId,
      participantIds: b.participants.map((p) => p.userId),
    })),
  });

  const userName = new Map(users.map((u) => [u.id, u.name]));
  const projectInfo = new Map(projects.map((p) => [p.id, { name: p.name, color: p.color }]));
  const missing = new Map<string, number>();
  for (const s of result.shortfall) missing.set(s.projectId, (missing.get(s.projectId) ?? 0) + s.missingMinutes);

  return {
    settings,
    projectsWithoutMembers: projects.filter((p) => p.members.length === 0).map((p) => p.name),
    proposals: result.proposals.map((p) => ({
      ...p,
      participants: p.participantIds.map((id) => ({ id, name: userName.get(id) ?? "—" })),
      projectName: projectInfo.get(p.projectId)?.name ?? "—",
      projectColor: projectInfo.get(p.projectId)?.color ?? "#7c3aed",
    })),
    shortfall: [...missing].map(([projectId, minutes]) => ({ projectName: projectInfo.get(projectId)?.name ?? "—", minutes })),
  };
}
