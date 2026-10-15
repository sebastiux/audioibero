import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, parseBody, requireAdmin, requireUser, route } from "@/lib/api";
import { projectCreateSchema } from "@/lib/validation";
import { projectInclude } from "@/lib/includes";

export const GET = route(async () => {
  await requireUser();
  const projects = await prisma.project.findMany({
    include: projectInclude,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ projects });
});

/** Alta de proyecto (sólo admin). */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const data = await parseBody(req, projectCreateSchema);
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw badRequest("La fecha de fin debe ser posterior a la de inicio");
  }
  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description || null,
      color: data.color,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      createdById: admin.id,
      members: { create: [...new Set(data.memberIds)].map((userId) => ({ userId })) },
    },
    include: projectInclude,
  });
  return NextResponse.json({ project }, { status: 201 });
});
