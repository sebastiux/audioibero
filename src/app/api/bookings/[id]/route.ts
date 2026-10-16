import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, forbidden, notFound, parseBody, requireAdmin, requireUser, route, type IdParams } from "@/lib/api";
import { bookingInclude } from "@/lib/bookings";
import { assertParticipantsFree, validateSlot } from "@/lib/rules";
import { bookingUpdateSchema } from "@/lib/validation";

/** Mover o editar una reserva: quien la creó o un admin. Sólo un admin cambia participantes. */
export const PATCH = route<IdParams>(async (req, { params }) => {
  const me = await requireUser();
  const isAdmin = me.role === "ADMIN";
  const { id } = await params;

  const current = await prisma.booking.findUnique({
    where: { id },
    include: { participants: { select: { userId: true } } },
  });
  if (!current) throw notFound("El horario ya no existe");
  if (current.createdById !== me.id && !isAdmin) throw forbidden("Sólo quien registró el horario o un admin puede modificarlo");

  const data = await parseBody(req, bookingUpdateSchema);
  if (data.participantIds && !isAdmin) throw forbidden("Sólo un admin puede cambiar a los participantes");

  const participantIds = data.participantIds ? [...new Set(data.participantIds)] : current.participants.map((p) => p.userId);
  if (participantIds.length === 0) throw badRequest("El horario necesita al menos a un miembro");
  const next = {
    start: data.start ?? current.start,
    end: data.end ?? current.end,
    kind: data.kind ?? current.kind,
    projectId: data.projectId === undefined ? current.projectId : data.projectId,
  };
  const { projectId } = await validateSlot(next, { userId: me.id, requireMembership: !isAdmin });
  await assertParticipantsFree(participantIds, next.start, next.end, id);

  const booking = await prisma.$transaction(async (tx) => {
    if (data.participantIds) {
      await tx.bookingParticipant.deleteMany({ where: { bookingId: id, userId: { notIn: participantIds } } });
      await tx.bookingParticipant.createMany({
        data: participantIds.map((userId) => ({ bookingId: id, userId })),
        skipDuplicates: true,
      });
    }
    return tx.booking.update({
      where: { id },
      data: { ...next, projectId, notes: data.notes === undefined ? undefined : data.notes || null },
      include: bookingInclude,
    });
  });
  return NextResponse.json({ booking });
});

/** Eliminar una reserva completa es exclusivo del admin (los miembros pueden salirse). */
export const DELETE = route<IdParams>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const { count } = await prisma.booking.deleteMany({ where: { id } });
  if (count === 0) throw notFound("El horario ya no existe");
  return NextResponse.json({ ok: true });
});
