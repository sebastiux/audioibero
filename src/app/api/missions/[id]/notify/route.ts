import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, requireAdmin, route, type IdParams } from "@/lib/api";
import { emailReminder } from "@/lib/reminders";

/** Enviar (o reenviar) un recordatorio por correo a los integrantes. */
export const POST = route<IdParams>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const m = await prisma.mission.findUnique({ where: { id }, select: { type: true } });
  if (!m) throw notFound("El recordatorio ya no existe");
  if (m.type !== "REMINDER") throw badRequest("Sólo los recordatorios se envían por correo");
  return NextResponse.json(await emailReminder(id));
});
