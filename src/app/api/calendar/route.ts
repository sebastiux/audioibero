import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, requireUser, route } from "@/lib/api";
import { bookingInclude } from "@/lib/bookings";

/** Reservas que se muestran en el calendario entre `from` y `to` (ISO). */
export const GET = route(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") ?? "");
  const to = new Date(url.searchParams.get("to") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw badRequest("Rango de fechas inválido");
  }
  if (to.getTime() - from.getTime() > 1000 * 60 * 60 * 24 * 62) throw badRequest("El rango máximo es de 62 días");

  const bookings = await prisma.booking.findMany({
    where: { start: { lt: to }, end: { gt: from } },
    include: bookingInclude,
    orderBy: { start: "asc" },
  });
  return NextResponse.json({ bookings });
});
