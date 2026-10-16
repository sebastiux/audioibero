import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, parseBody, requireAdmin, requireUser, route } from "@/lib/api";
import { missionSchema } from "@/lib/validation";
import { normalizeMission } from "@/lib/missions-db";
import { emailReminder } from "@/lib/reminders";

export const GET = route(async () => {
  const me = await requireUser();
  const missions = await prisma.mission.findMany({
    where: me.role === "ADMIN" ? {} : { active: true },
    orderBy: [{ pinned: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return NextResponse.json({ missions });
});

/** Alta de actividad de proyecto (sólo admin): recordatorio o sesión fija recurrente. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const data = await parseBody(req, missionSchema);
  if (data.projectId && !(await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } }))) {
    throw badRequest("El proyecto no existe");
  }
  const mission = await prisma.mission.create({ data: { ...normalizeMission(data), createdById: admin.id } });
  const email = data.notify && mission.type === "REMINDER" && mission.active ? await emailReminder(mission.id) : undefined;
  return NextResponse.json({ mission, email }, { status: 201 });
});
