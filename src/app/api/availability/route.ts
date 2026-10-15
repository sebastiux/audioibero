import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { forbidden, parseBody, requireUser, route } from "@/lib/api";
import { assertNoAvailabilityOverlap, validateSlot } from "@/lib/rules";
import { availabilityCreateSchema } from "@/lib/validation";

/** Un miembro registra un espacio libre propio; un admin puede registrarlo para cualquier persona. */
export const POST = route(async (req) => {
  const me = await requireUser();
  const data = await parseBody(req, availabilityCreateSchema);
  const userId = data.userId ?? me.id;
  if (userId !== me.id && me.role !== "ADMIN") throw forbidden("Sólo puedes registrar tus propios espacios");

  const { projectId } = await validateSlot(
    { start: data.start, end: data.end, kind: data.kind, projectId: data.projectId },
    { userId, requireMembership: me.role !== "ADMIN" },
  );
  await assertNoAvailabilityOverlap(userId, data.start, data.end);

  const availability = await prisma.availability.create({
    data: { userId, start: data.start, end: data.end, kind: data.kind, projectId, notes: data.notes || null },
  });
  return NextResponse.json({ availability }, { status: 201 });
});
