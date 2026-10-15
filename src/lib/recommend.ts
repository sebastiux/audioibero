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
  const overlap = { start: { lt: end }, end: { gt: start } };

  const [settings, availabilities, projects, existing, users] = await Promise.all([
    getSettings(),
    prisma.availability.findMany({ where: { ...overlap, user: { active: true } } }),
    prisma.project.findMany({ where: { active: true }, include: { members: { select: { userId: true } } } }),
    prisma.assignment.findMany({
      where: { ...overlap, ...(replaceRecommended ? { source: "MANUAL" as const } : {}) },
      select: { userId: true, start: true, end: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const activeProjectIds = new Set(projects.map((p) => p.id));
  const result = recommendSchedule({
    fromKey,
    toKey,
    timeZone: tz,
    settings,
    existing,
    projects: projects.map((p) => ({ id: p.id, name: p.name, memberIds: p.members.map((m) => m.userId) })),
    availabilities: availabilities.map((a) => ({
      id: a.id,
      userId: a.userId,
      start: a.start,
      end: a.end,
      kind: a.kind,
      projectId: a.projectId && activeProjectIds.has(a.projectId) ? a.projectId : null,
    })),
  });

  const userName = new Map(users.map((u) => [u.id, u.name]));
  const project = new Map(projects.map((p) => [p.id, { name: p.name, color: p.color }]));
  return {
    settings,
    proposals: result.proposals.map((p) => ({
      ...p,
      userName: userName.get(p.userId) ?? "—",
      projectName: p.projectId ? (project.get(p.projectId)?.name ?? null) : null,
      projectColor: p.projectId ? (project.get(p.projectId)?.color ?? null) : null,
    })),
    stats: Object.entries(result.minutesByUser)
      .map(([userId, minutes]) => ({ userId, name: userName.get(userId) ?? "—", minutes }))
      .sort((a, b) => b.minutes - a.minutes),
    totalAvailabilities: availabilities.length,
    unassignedCount: result.unassignedAvailabilityIds.length,
  };
}
