import { CalendarView } from "@/components/CalendarView";
import { requirePageUser } from "@/lib/auth";
import { loadCalendarContext } from "@/lib/queries";

export const metadata = { title: "Calendario · Audio Ibero" };

export default async function CalendarPage() {
  const user = await requirePageUser();
  const ctx = await loadCalendarContext();
  return <CalendarView me={{ id: user.id, name: user.name, role: user.role }} {...ctx} />;
}
