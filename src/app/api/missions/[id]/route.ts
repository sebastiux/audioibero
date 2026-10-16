import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseBody, requireAdmin, route, type IdParams } from "@/lib/api";
import { missionSchema } from "@/lib/validation";
import { normalizeMission } from "@/lib/missions-db";

export const PUT = route<IdParams>(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const data = await parseBody(req, missionSchema);
  const exists = await prisma.mission.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound("La actividad ya no existe");
  if (data.projectId && !(await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } }))) {
    throw badRequest("El proyecto no existe");
  }
  const mission = await prisma.mission.update({ where: { id }, data: normalizeMission(data) });
  return NextResponse.json({ mission });
});

export const DELETE = route<IdParams>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const { count } = await prisma.mission.deleteMany({ where: { id } });
  if (count === 0) throw notFound("La actividad ya no existe");
  return NextResponse.json({ ok: true });
});
