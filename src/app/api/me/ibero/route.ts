import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, requireUser, route } from "@/lib/api";
import { MAX_ICS_BYTES, summarizeIcs } from "@/lib/ibero";
import { looksLikeMateriasInscritas, parseMateriasInscritas } from "@/lib/ibero-pdf";
import { MAX_PDF_BYTES, pdfToText } from "@/lib/pdf-text";

export const runtime = "nodejs";

/**
 * Sube el horario Ibero: el PDF "Materias inscritas" (Servicios en Línea) o un calendario .ics.
 * Del PDF sólo se guardan las materias y sus horarios; el archivo no se almacena.
 */
export const POST = route(async (req) => {
  const me = await requireUser();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) throw badRequest("Elige un archivo PDF o .ics");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF

  if (isPdf) {
    if (bytes.length > MAX_PDF_BYTES) throw badRequest("El PDF es demasiado grande (máximo 2 MB)");
    let text: string;
    try {
      text = await pdfToText(bytes);
    } catch {
      throw badRequest("No se pudo leer el PDF");
    }
    if (!looksLikeMateriasInscritas(text)) {
      throw badRequest("Ese PDF no parece ser “Materias inscritas” de Servicios en Línea Ibero");
    }
    const classes = parseMateriasInscritas(text);
    if (classes.length === 0) throw badRequest("No encontramos materias con horario en el PDF");
    await prisma.user.update({
      where: { id: me.id },
      data: { iberoClasses: classes, iberoIcs: null, iberoIcsUpdatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, source: "pdf", subjects: new Set(classes.map((c) => c.code)).size, sessions: classes.length });
  }

  if (bytes.length > MAX_ICS_BYTES) throw badRequest("El archivo es demasiado grande (máximo 1 MB)");
  const ics = new TextDecoder().decode(bytes);
  let summary;
  try {
    summary = summarizeIcs(ics);
  } catch (err) {
    throw badRequest(`${(err as Error).message}. Sube el PDF de “Materias inscritas” o un archivo .ics`);
  }
  if (summary.events === 0) throw badRequest("El calendario no tiene eventos");
  await prisma.user.update({
    where: { id: me.id },
    data: { iberoIcs: ics, iberoClasses: Prisma.DbNull, iberoIcsUpdatedAt: new Date() },
  });
  return NextResponse.json({ ok: true, source: "ics", ...summary });
});

export const DELETE = route(async () => {
  const me = await requireUser();
  await prisma.user.update({
    where: { id: me.id },
    data: { iberoIcs: null, iberoClasses: Prisma.DbNull, iberoIcsUpdatedAt: null },
  });
  return NextResponse.json({ ok: true });
});
