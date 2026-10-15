import "server-only";
import { prisma } from "./db";
import { getSettings } from "./rules";
import type { LabConfig, MissionItem, ProjectOption, UserOption } from "./types";

export async function loadCalendarContext(): Promise<{
  users: UserOption[];
  projects: ProjectOption[];
  lab: LabConfig;
  reminders: Pick<MissionItem, "id" | "title" | "dueDate" | "pinned">[];
}> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [users, projects, settings, reminders] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: { active: true },
      select: { id: true, name: true, color: true, members: { select: { userId: true } } },
      orderBy: { name: "asc" },
    }),
    getSettings(),
    // Recordatorios fijados, o con fecha de hoy en adelante (los más próximos primero).
    prisma.mission.findMany({
      where: { type: "REMINDER", active: true, OR: [{ pinned: true }, { dueDate: { gte: today } }] },
      select: { id: true, title: true, dueDate: true, pinned: true },
      orderBy: [{ pinned: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }],
      take: 4,
    }),
  ]);
  return {
    users,
    projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color, memberIds: p.members.map((m) => m.userId) })),
    lab: {
      capacity: settings.capacity,
      openMinute: settings.openMinute,
      closeMinute: settings.closeMinute,
      openDays: settings.openDays,
      slotMinutes: settings.slotMinutes,
    },
    reminders: reminders.map((r) => ({ ...r, dueDate: r.dueDate?.toISOString() ?? null })),
  };
}
