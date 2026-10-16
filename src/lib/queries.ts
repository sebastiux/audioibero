import "server-only";
import { prisma } from "./db";
import { getSettings } from "./rules";
import type { LabConfig, MissionItem, ProjectOption, UserOption } from "./types";

export type ReminderItem = Pick<MissionItem, "id" | "title" | "dueDate" | "pinned"> & { projectName: string | null };

export async function loadCalendarContext(me?: { id: string; role: "MEMBER" | "ADMIN" }): Promise<{
  users: UserOption[];
  projects: ProjectOption[];
  lab: LabConfig;
  reminders: ReminderItem[];
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
    // Recordatorios de mis proyectos (o del club) fijados o con fecha de hoy en adelante.
    me
      ? prisma.mission.findMany({
          where: {
            type: "REMINDER",
            active: true,
            AND: [
              { OR: [{ pinned: true }, { dueDate: { gte: today } }] },
              {
                OR: [
                  { projectId: null },
                  { project: { active: true, ...(me.role === "ADMIN" ? {} : { members: { some: { userId: me.id } } }) } },
                ],
              },
            ],
          },
          select: { id: true, title: true, dueDate: true, pinned: true, project: { select: { name: true } } },
          orderBy: [{ pinned: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }],
          take: 5,
        })
      : Promise.resolve([]),
  ]);
  return {
    users,
    projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color, memberIds: p.members.map((m) => m.userId) })),
    lab: {
      openMinute: settings.openMinute,
      closeMinute: settings.closeMinute,
      openDays: settings.openDays,
      slotMinutes: settings.slotMinutes,
    },
    reminders: reminders.map((r) => ({
      id: r.id,
      title: r.title,
      pinned: r.pinned,
      dueDate: r.dueDate?.toISOString() ?? null,
      projectName: r.project?.name ?? null,
    })),
  };
}
