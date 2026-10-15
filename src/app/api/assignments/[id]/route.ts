import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { conflict, notFound, parseBody, requireAdmin, route, type IdParams } from "@/lib/api";
import { assertNoAssignmentOverlap, getSettings, peakOccupancy, validateSlot } from "@/lib/rules";
import { assignmentUpdateSchema } from "@/lib/validation";

export const PATCH = route<IdParams>(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const force = new URL(req.url).searchParams.get("force") === "1";
  const current = await prisma.assignment.findUnique({ where: { id } });
  if (!current) throw notFound("La asignación ya no existe");

  const data = await parseBody(req, assignmentUpdateSchema);
  const next = {
    userId: data.userId ?? current.userId,
    start: data.start ?? current.start,
    end: data.end ?? current.end,
    kind: data.kind ?? current.kind,
    projectId: data.projectId === undefined ? current.projectId : data.projectId,
  };
  const { projectId } = await validateSlot(next, { userId: next.userId, requireMembership: false });
  await assertNoAssignmentOverlap(next.userId, next.start, next.end, id);
  if (!force) {
    const { capacity } = await getSettings();
    if ((await peakOccupancy(next.start, next.end, id)) >= capacity) {
      throw conflict(`El lab ya está lleno (${capacity} personas) en parte de ese horario`);
    }
  }

  const assignment = await prisma.assignment.update({
    where: { id },
    data: { ...next, projectId, notes: data.notes === undefined ? undefined : data.notes || null },
  });
  return NextResponse.json({ assignment });
});

export const DELETE = route<IdParams>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const { count } = await prisma.assignment.deleteMany({ where: { id } });
  if (count === 0) throw notFound("La asignación ya no existe");
  return NextResponse.json({ ok: true });
});
