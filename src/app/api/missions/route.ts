import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody, requireAdmin, requireUser, route } from "@/lib/api";
import { missionSchema } from "@/lib/validation";
import { normalizeMission } from "@/lib/missions-db";

export const GET = route(async () => {
  const me = await requireUser();
  const missions = await prisma.mission.findMany({
    where: me.role === "ADMIN" ? {} : { active: true },
    orderBy: [{ pinned: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return NextResponse.json({ missions });
});

/** Alta de misión general (sólo admin): recordatorio o sesión recurrente. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const data = await parseBody(req, missionSchema);
  const mission = await prisma.mission.create({ data: { ...normalizeMission(data), createdById: admin.id } });
  return NextResponse.json({ mission }, { status: 201 });
});
