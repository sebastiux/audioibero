import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { conflict, forbidden, notFound, requireUser, route, type IdParams } from "@/lib/api";
import { bookingInclude } from "@/lib/bookings";
import { assertParticipantsFree } from "@/lib/rules";

/** Unirse a una reserva existente (p. ej. a la sesión de un proyecto). */
export const POST = route<IdParams>(async (_req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      participants: { select: { userId: true } },
      project: { select: { active: true, members: { where: { userId: me.id }, select: { userId: true } } } },
    },
  });
  if (!booking) throw notFound("El horario ya no existe");
  if (booking.participants.some((p) => p.userId === me.id)) throw conflict("Ya estás en este horario");
  if (booking.end <= new Date()) throw conflict("Ese horario ya terminó");
  if (booking.project) {
    if (!booking.project.active) throw conflict("El proyecto está archivado");
    if (booking.project.members.length === 0 && me.role !== "ADMIN") {
      throw forbidden("No eres integrante de ese proyecto; pide a un admin que te agregue");
    }
  }

  await assertParticipantsFree([me.id], booking.start, booking.end);

  await prisma.bookingParticipant.create({ data: { bookingId: id, userId: me.id } });
  const updated = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  return NextResponse.json({ booking: updated });
});
