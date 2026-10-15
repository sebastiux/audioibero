import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { forbidden, notFound, parseBody, requireAdmin, requireUser, route, type IdParams } from "@/lib/api";
import { assertNoAvailabilityOverlap, validateSlot } from "@/lib/rules";
import { availabilityUpdateSchema } from "@/lib/validation";

/** El dueño del espacio (o un admin) puede modificarlo. */
export const PATCH = route<IdParams>(async (req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const current = await prisma.availability.findUnique({ where: { id } });
  if (!current) throw notFound("El espacio ya no existe");
  if (current.userId !== me.id && me.role !== "ADMIN") throw forbidden("Sólo puedes modificar tus propios espacios");

  const data = await parseBody(req, availabilityUpdateSchema);
  const next = {
    start: data.start ?? current.start,
    end: data.end ?? current.end,
    kind: data.kind ?? current.kind,
    projectId: data.projectId === undefined ? current.projectId : data.projectId,
  };
  const { projectId } = await validateSlot(next, { userId: current.userId, requireMembership: me.role !== "ADMIN" });
  await assertNoAvailabilityOverlap(current.userId, next.start, next.end, id);

  const availability = await prisma.availability.update({
    where: { id },
    data: { ...next, projectId, notes: data.notes === undefined ? undefined : data.notes || null },
  });
  return NextResponse.json({ availability });
});

/** Eliminar espacios es exclusivo del perfil admin. */
export const DELETE = route<IdParams>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const { count } = await prisma.availability.deleteMany({ where: { id } });
  if (count === 0) throw notFound("El espacio ya no existe");
  return NextResponse.json({ ok: true });
});
