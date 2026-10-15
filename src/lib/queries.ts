import "server-only";
import { prisma } from "./db";
import { getSettings } from "./rules";
import type { LabConfig, ProjectOption, UserOption } from "./types";

export async function loadCalendarContext(): Promise<{ users: UserOption[]; projects: ProjectOption[]; lab: LabConfig }> {
  const [users, projects, settings] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: { active: true },
      select: { id: true, name: true, color: true, members: { select: { userId: true } } },
      orderBy: { name: "asc" },
    }),
    getSettings(),
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
  };
}
