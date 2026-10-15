import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, parseBody, requireUser, route } from "@/lib/api";
import { bookingInclude } from "@/lib/bookings";
import { assertCapacity, assertParticipantsFree, validateSlot } from "@/lib/rules";
import { bookingCreateSchema } from "@/lib/validation";

/**
 * Crear una reserva (lab, sesión de proyecto o trabajo asíncrono). Un miembro reserva para sí mismo;
 * un admin puede asignarla a quien sea. El trabajo asíncrono no ocupa cupo del lab.
 * `?force=1` (sólo admin) permite rebasar el cupo del lab.
 */
export const POST = route(async (req) => {
  const me = await requireUser();
  const isAdmin = me.role === "ADMIN";
  const force = isAdmin && new URL(req.url).searchParams.get("force") === "1";
  const data = await parseBody(req, bookingCreateSchema);

  const participantIds = isAdmin && data.participantIds ? [...new Set(data.participantIds)] : [me.id];
  if (participantIds.length === 0) throw badRequest("Elige al menos a un miembro");
  const active = await prisma.user.count({ where: { id: { in: participantIds }, active: true } });
  if (active !== participantIds.length) throw badRequest("Algún miembro no existe o está desactivado");

  const { projectId } = await validateSlot(
    { start: data.start, end: data.end, kind: data.kind, projectId: data.projectId },
    { userId: me.id, requireMembership: !isAdmin },
  );
  await assertParticipantsFree(participantIds, data.start, data.end);
  if (!force && data.kind !== "ASYNC") await assertCapacity(participantIds.length, data.start, data.end);

  const booking = await prisma.booking.create({
    data: {
      start: data.start,
      end: data.end,
      kind: data.kind,
      projectId,
      notes: data.notes || null,
      createdById: me.id,
      participants: { create: participantIds.map((userId) => ({ userId })) },
    },
    include: bookingInclude,
  });
  return NextResponse.json({ booking }, { status: 201 });
});
