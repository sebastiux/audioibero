import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseBody, requireAdmin, route, type IdParams } from "@/lib/api";
import { projectUpdateSchema } from "@/lib/validation";
import { projectInclude } from "@/lib/includes";

export const PATCH = route<IdParams>(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const current = await prisma.project.findUnique({ where: { id }, select: { startDate: true, endDate: true } });
  if (!current) throw notFound("El proyecto no existe");

  const { memberIds, ...data } = await parseBody(req, projectUpdateSchema);
  const startDate = data.startDate === undefined ? current.startDate : data.startDate;
  const endDate = data.endDate === undefined ? current.endDate : data.endDate;
  if (startDate && endDate && endDate < startDate) throw badRequest("La fecha de fin debe ser posterior a la de inicio");

  const project = await prisma.$transaction(async (tx) => {
    if (memberIds) {
      await tx.projectMember.deleteMany({ where: { projectId: id, userId: { notIn: memberIds } } });
      await tx.projectMember.createMany({
        data: [...new Set(memberIds)].map((userId) => ({ projectId: id, userId })),
        skipDuplicates: true,
      });
    }
    return tx.project.update({
      where: { id },
      data: { ...data, description: data.description === undefined ? undefined : data.description || null },
      include: projectInclude,
    });
  });
  return NextResponse.json({ project });
});

export const DELETE = route<IdParams>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const { count } = await prisma.project.deleteMany({ where: { id } });
  if (count === 0) throw notFound("El proyecto no existe");
  return NextResponse.json({ ok: true });
});
