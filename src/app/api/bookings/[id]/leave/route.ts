import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notFound, requireUser, route, type IdParams } from "@/lib/api";

/** Salirse de una reserva. Si ya no queda nadie, la reserva se elimina. */
export const POST = route<IdParams>(async (_req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const removed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.bookingParticipant.deleteMany({ where: { bookingId: id, userId: me.id } });
    if (count === 0) return false;
    const remaining = await tx.bookingParticipant.count({ where: { bookingId: id } });
    if (remaining === 0) await tx.booking.delete({ where: { id } });
    return true;
  });
  if (!removed) throw notFound("No estabas en este horario");
  return NextResponse.json({ ok: true });
});
