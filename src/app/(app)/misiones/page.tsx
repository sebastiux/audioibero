import { MissionsManager } from "@/components/MissionsManager";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Misiones generales · Audio Ibero" };

export default async function MissionsPage() {
  const user = await requirePageUser();
  const missions = await prisma.mission.findMany({
    where: user.role === "ADMIN" ? {} : { active: true },
    orderBy: [{ pinned: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return (
    <MissionsManager
      me={{ id: user.id, name: user.name, role: user.role }}
      missions={missions.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.type,
        pinned: m.pinned,
        active: m.active,
        dueDate: m.dueDate?.toISOString() ?? null,
        weekdays: m.weekdays,
        startMinute: m.startMinute,
        endMinute: m.endMinute,
        startsOn: m.startsOn?.toISOString() ?? null,
        endsOn: m.endsOn?.toISOString() ?? null,
        kind: m.kind,
      }))}
    />
  );
}
