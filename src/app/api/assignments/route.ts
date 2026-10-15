import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, conflict, parseBody, requireAdmin, route } from "@/lib/api";
import { assertNoAssignmentOverlap, getSettings, peakOccupancy, validateSlot } from "@/lib/rules";
import { assignmentCreateSchema } from "@/lib/validation";

/** Admin asigna un día/horario a un miembro. `?force=1` permite rebasar el cupo del lab. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const force = new URL(req.url).searchParams.get("force") === "1";
  const data = await parseBody(req, assignmentCreateSchema);

  const user = await prisma.user.findUnique({ where: { id: data.userId }, select: { active: true } });
  if (!user || !user.active) throw badRequest("El miembro no existe o está desactivado");

  const { projectId } = await validateSlot(data, { userId: data.userId, requireMembership: false });
  await assertNoAssignmentOverlap(data.userId, data.start, data.end);
  if (!force) {
    const { capacity } = await getSettings();
    if ((await peakOccupancy(data.start, data.end)) >= capacity) {
      throw conflict(`El lab ya está lleno (${capacity} personas) en parte de ese horario`);
    }
  }

  const assignment = await prisma.assignment.create({
    data: {
      userId: data.userId,
      start: data.start,
      end: data.end,
      kind: data.kind,
      projectId,
      notes: data.notes || null,
      source: "MANUAL",
      createdById: admin.id,
    },
  });
  return NextResponse.json({ assignment }, { status: 201 });
});
