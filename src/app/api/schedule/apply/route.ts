import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody, requireAdmin, route } from "@/lib/api";
import { rangeBounds } from "@/lib/recommend";
import { applySchema } from "@/lib/validation";

/** Guarda las propuestas del calendario recomendado como asignaciones. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { from, to, proposals, replaceRecommended } = await parseBody(req, applySchema);
  const { start, end } = rangeBounds(from, to);

  const result = await prisma.$transaction(async (tx) => {
    const removed = replaceRecommended
      ? (await tx.assignment.deleteMany({ where: { source: "RECOMMENDED", start: { lt: end }, end: { gt: start } } })).count
      : 0;

    const [users, projects, existing] = await Promise.all([
      tx.user.findMany({ where: { active: true }, select: { id: true } }),
      tx.project.findMany({ where: { active: true }, select: { id: true } }),
      tx.assignment.findMany({ where: { start: { lt: end }, end: { gt: start } }, select: { userId: true, start: true, end: true } }),
    ]);
    const userIds = new Set(users.map((u) => u.id));
    const projectIds = new Set(projects.map((p) => p.id));
    const taken = [...existing];

    // Descarta propuestas inválidas o que choquen con algo que se haya agregado mientras tanto.
    const valid = proposals.filter((p) => {
      if (p.end <= p.start || p.start < start || p.end > end || !userIds.has(p.userId)) return false;
      if (p.projectId && !projectIds.has(p.projectId)) return false;
      if (taken.some((t) => t.userId === p.userId && t.start < p.end && t.end > p.start)) return false;
      taken.push({ userId: p.userId, start: p.start, end: p.end });
      return true;
    });

    const { count } = await tx.assignment.createMany({
      data: valid.map((p) => ({
        userId: p.userId,
        start: p.start,
        end: p.end,
        kind: p.projectId ? p.kind : "LAB",
        projectId: p.projectId,
        notes: p.reason ?? null,
        source: "RECOMMENDED" as const,
        createdById: admin.id,
      })),
    });
    return { created: count, removed, skipped: proposals.length - valid.length };
  });

  return NextResponse.json(result);
});
