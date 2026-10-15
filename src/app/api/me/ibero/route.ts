import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, parseBody, requireUser, route } from "@/lib/api";
import { summarizeIcs } from "@/lib/ibero";
import { iberoUploadSchema } from "@/lib/validation";

/** Guarda el horario de clases exportado del calendario Ibero (.ics). */
export const PUT = route(async (req) => {
  const me = await requireUser();
  const { ics } = await parseBody(req, iberoUploadSchema);
  let summary;
  try {
    summary = summarizeIcs(ics);
  } catch (err) {
    throw badRequest((err as Error).message);
  }
  if (summary.events === 0) throw badRequest("El calendario no tiene eventos");
  await prisma.user.update({ where: { id: me.id }, data: { iberoIcs: ics, iberoIcsUpdatedAt: new Date() } });
  return NextResponse.json({ ok: true, ...summary });
});

export const DELETE = route(async () => {
  const me = await requireUser();
  await prisma.user.update({ where: { id: me.id }, data: { iberoIcs: null, iberoIcsUpdatedAt: null } });
  return NextResponse.json({ ok: true });
});
