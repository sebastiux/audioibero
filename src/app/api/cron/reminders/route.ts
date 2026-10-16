import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api";
import { emailDueToday } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Aviso diario de los recordatorios que vencen hoy. Se llama desde un cron (Railway Cron, cron-job.org…)
 * con el encabezado `Authorization: Bearer $CRON_SECRET`. Es idempotente: cada recordatorio se avisa una vez.
 */
async function handler(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "No autorizado");
  return NextResponse.json(await emailDueToday());
}

export const GET = route(handler);
export const POST = route(handler);
