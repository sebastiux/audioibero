import { RecommendPanel } from "@/components/RecommendPanel";
import { requirePageAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/rules";

export const metadata = { title: "Calendario recomendado · Audio Ibero" };

export default async function RecommendPage() {
  await requirePageAdmin();
  const s = await getSettings();
  return (
    <RecommendPanel
      lab={{
        capacity: s.capacity,
        openMinute: s.openMinute,
        closeMinute: s.closeMinute,
        openDays: s.openDays,
        slotMinutes: s.slotMinutes,
        minSessionMinutes: s.minSessionMinutes,
        maxWeeklyMinutes: s.maxWeeklyMinutes,
      }}
    />
  );
}
