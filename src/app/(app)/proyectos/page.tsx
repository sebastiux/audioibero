import { ProjectsManager } from "@/components/ProjectsManager";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Proyectos · Audio Ibero" };

export default async function ProjectsPage() {
  const user = await requirePageUser();
  const [projects, users, activities] = await Promise.all([
    prisma.project.findMany({
      include: { members: { select: { userId: true } } },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.mission.findMany({
      where: user.role === "ADMIN" ? {} : { active: true },
      orderBy: [{ pinned: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    }),
  ]);
  return (
    <ProjectsManager
      me={{ id: user.id, name: user.name, role: user.role }}
      users={users}
      activities={activities.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        title: m.title,
        description: m.description,
        type: m.type,
        pinned: m.pinned,
        active: m.active,
        dueDate: m.dueDate?.toISOString() ?? null,
        weekdays: m.weekdays,
        startMinute: m.startMinute,
        endMinute: m.endMinute,
        startsOn: m.startsOn?.toISOString() ?? null,
        endsOn: m.endsOn?.toISOString() ?? null,
        kind: m.kind,
      }))}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        color: p.color,
        active: p.active,
        startDate: p.startDate?.toISOString() ?? null,
        endDate: p.endDate?.toISOString() ?? null,
        memberIds: p.members.map((m) => m.userId),
      }))}
    />
  );
}
