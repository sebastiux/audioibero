import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody, requireAdmin, route } from "@/lib/api";
import { rangeBounds } from "@/lib/recommend";
import { applySchema } from "@/lib/validation";

/** Guarda las propuestas del calendario recomendado como reservas de equipo. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { from, to, proposals, replaceRecommended } = await parseBody(req, applySchema);
  const { start, end } = rangeBounds(from, to);

  const result = await prisma.$transaction(async (tx) => {
    const removed = replaceRecommended
      ? (await tx.booking.deleteMany({ where: { source: "RECOMMENDED", start: { lt: end }, end: { gt: start } } })).count
      : 0;

    const [users, projects, existing] = await Promise.all([
      tx.user.findMany({ where: { active: true }, select: { id: true } }),
      tx.project.findMany({ where: { active: true }, select: { id: true } }),
      tx.bookingParticipant.findMany({
        where: { booking: { start: { lt: end }, end: { gt: start } } },
        select: { userId: true, booking: { select: { start: true, end: true } } },
      }),
    ]);
    const userIds = new Set(users.map((u) => u.id));
    const projectIds = new Set(projects.map((p) => p.id));
    const taken = existing.map((e) => ({ userId: e.userId, start: e.booking.start, end: e.booking.end }));

    let created = 0;
    let skipped = 0;
    for (const p of proposals) {
      // Descarta lo inválido y a quien se haya ocupado mientras tanto.
      const participants = [...new Set(p.participantIds)].filter(
        (u) => userIds.has(u) && !taken.some((t) => t.userId === u && t.start < p.end && t.end > p.start),
      );
      if (p.end <= p.start || p.start < start || p.end > end || !projectIds.has(p.projectId) || participants.length === 0) {
        skipped++;
        continue;
      }
      await tx.booking.create({
        data: {
          start: p.start,
          end: p.end,
          kind: "PROJECT",
          projectId: p.projectId,
          notes: p.reason ?? null,
          source: "RECOMMENDED",
          createdById: admin.id,
          participants: { create: participants.map((userId) => ({ userId })) },
        },
      });
      for (const userId of participants) taken.push({ userId, start: p.start, end: p.end });
      created++;
    }
    return { created, removed, skipped };
  });

  return NextResponse.json(result);
});
