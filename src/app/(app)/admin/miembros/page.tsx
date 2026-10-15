import { MembersAdmin } from "@/components/MembersAdmin";
import { requirePageAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/rules";
import { addDaysToKey, appTimeZone, fromLocal, toLocalParts, weekKeyOf } from "@/lib/time";

export const metadata = { title: "Miembros y lab · Audio Ibero" };

export default async function MembersPage() {
  const admin = await requirePageAdmin();
  const tz = appTimeZone();
  const monday = weekKeyOf(toLocalParts(new Date(), tz).dateKey);
  const weekStart = fromLocal(monday, 0, tz);
  const weekEnd = fromLocal(addDaysToKey(monday, 7), 0, tz);

  const [users, participations, settings] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.bookingParticipant.findMany({
      where: { booking: { start: { lt: weekEnd }, end: { gt: weekStart } } },
      select: { userId: true, booking: { select: { start: true, end: true } } },
    }),
    getSettings(),
  ]);

  const minutes = new Map<string, number>();
  for (const { userId, booking } of participations) {
    minutes.set(userId, (minutes.get(userId) ?? 0) + Math.round((booking.end.getTime() - booking.start.getTime()) / 60000));
  }

  return (
    <MembersAdmin
      meId={admin.id}
      users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), weekMinutes: minutes.get(u.id) ?? 0 }))}
      settings={{
        capacity: settings.capacity,
        openMinute: settings.openMinute,
        closeMinute: settings.closeMinute,
        openDays: settings.openDays,
        slotMinutes: settings.slotMinutes,
        maxWeeklyMinutes: settings.maxWeeklyMinutes,
        projectWeeklyMinutes: settings.projectWeeklyMinutes,
        projectSessionMinutes: settings.projectSessionMinutes,
      }}
    />
  );
}
