import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, requireAdmin, route } from "@/lib/api";
import { buildRecommendation } from "@/lib/recommend";
import { dateKey } from "@/lib/validation";

const schema = z.object({ from: dateKey, to: dateKey, replaceRecommended: z.boolean().default(true) });

/** Vista previa del calendario recomendado (no guarda nada). */
export const POST = route(async (req) => {
  await requireAdmin();
  const { from, to, replaceRecommended } = await parseBody(req, schema);
  return NextResponse.json(await buildRecommendation(from, to, replaceRecommended));
});
