import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody, requireAdmin, requireUser, route } from "@/lib/api";
import { getSettings } from "@/lib/rules";
import { settingsSchema } from "@/lib/validation";

export const GET = route(async () => {
  await requireUser();
  return NextResponse.json({ settings: await getSettings() });
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const data = await parseBody(req, settingsSchema);
  const settings = await prisma.labSettings.upsert({
    where: { id: 1 },
    update: { ...data, openDays: [...new Set(data.openDays)].sort() },
    create: { id: 1, ...data },
  });
  return NextResponse.json({ settings });
});
