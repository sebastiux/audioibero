import { PlanPanel } from "@/components/PlanPanel";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { IberoClass } from "@/lib/ibero-pdf";
import { loadCalendarContext } from "@/lib/queries";

export const metadata = { title: "Mi plan · Audio Ibero" };

export default async function PlanPage() {
  const me = await requirePageUser();
  const [user, ctx] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { iberoIcsUpdatedAt: true, iberoClasses: true } }),
    loadCalendarContext(),
  ]);
  const projects = me.role === "ADMIN" ? ctx.projects : ctx.projects.filter((p) => p.memberIds.includes(me.id));
  return (
    <PlanPanel
      iberoUpdatedAt={user.iberoIcsUpdatedAt?.toISOString() ?? null}
      iberoClasses={Array.isArray(user.iberoClasses) ? (user.iberoClasses as IberoClass[]) : null}
      projects={projects}
      lab={ctx.lab}
    />
  );
}
