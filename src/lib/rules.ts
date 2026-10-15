import "server-only";
import { prisma } from "./db";
import { badRequest, conflict, forbidden } from "./api";
import { appTimeZone, toLocalParts } from "./time";

export async function getSettings() {
  return prisma.labSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

type SlotInput = {
  start: Date;
  end: Date;
  kind: "LAB" | "PROJECT";
  projectId?: string | null;
};

/**
 * Valida un horario (disponibilidad o asignación) y normaliza projectId.
 * - termina después de empezar, mismo día local, máximo 16 h
 * - PROJECT requiere un proyecto activo; si `requireMembership`, el usuario debe pertenecer a él
 */
export async function validateSlot(slot: SlotInput, opts: { userId: string; requireMembership: boolean }) {
  if (slot.end.getTime() <= slot.start.getTime()) throw badRequest("La hora de fin debe ser posterior a la de inicio");
  if (slot.end.getTime() - slot.start.getTime() > 16 * 60 * 60 * 1000) {
    throw badRequest("Un horario no puede durar más de 16 horas");
  }
  const tz = appTimeZone();
  if (toLocalParts(slot.start, tz).dateKey !== toLocalParts(new Date(slot.end.getTime() - 1), tz).dateKey) {
    throw badRequest("El horario debe empezar y terminar el mismo día");
  }

  if (slot.kind === "LAB") return { projectId: null };

  if (!slot.projectId) throw badRequest("Elige el proyecto en el que vas a trabajar");
  const project = await prisma.project.findUnique({
    where: { id: slot.projectId },
    select: { active: true, members: { where: { userId: opts.userId }, select: { userId: true } } },
  });
  if (!project || !project.active) throw badRequest("El proyecto no existe o está archivado");
  if (opts.requireMembership && project.members.length === 0) {
    throw forbidden("No eres integrante de ese proyecto; pide a un admin que te agregue");
  }
  return { projectId: slot.projectId };
}

export async function assertNoAvailabilityOverlap(userId: string, start: Date, end: Date, excludeId?: string) {
  const clash = await prisma.availability.findFirst({
    where: { userId, start: { lt: end }, end: { gt: start }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) throw conflict("Ya tienes un espacio libre que se cruza con ese horario");
}

export async function assertNoAssignmentOverlap(userId: string, start: Date, end: Date, excludeId?: string) {
  const clash = await prisma.assignment.findFirst({
    where: { userId, start: { lt: end }, end: { gt: start }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) throw conflict("Esa persona ya tiene una asignación que se cruza con ese horario");
}

/** Cuántas asignaciones ocupan el lab en algún momento del intervalo (pico de ocupación). */
export async function peakOccupancy(start: Date, end: Date, excludeId?: string) {
  const rows = await prisma.assignment.findMany({
    where: { start: { lt: end }, end: { gt: start }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { start: true, end: true },
  });
  const events = rows.flatMap((r) => [
    { t: Math.max(r.start.getTime(), start.getTime()), d: 1 },
    { t: Math.min(r.end.getTime(), end.getTime()), d: -1 },
  ]);
  events.sort((a, b) => a.t - b.t || a.d - b.d);
  let current = 0;
  let peak = 0;
  for (const e of events) {
    current += e.d;
    peak = Math.max(peak, current);
  }
  return peak;
}
