import { addDaysToKey, fromLocal, toLocalParts, weekdayOfKey } from "./time";

export type RecurringMission = {
  id: string;
  title: string;
  weekdays: number[];
  startMinute: number | null;
  endMinute: number | null;
  startsOn: Date | null;
  endsOn: Date | null;
};

export type MissionOccurrence = { missionId: string; title: string; start: Date; end: Date };

/** Fechas de una misión recurrente dentro de [from, to). `startsOn`/`endsOn` se guardan como fecha (UTC 00:00). */
export function expandMission(m: RecurringMission, from: Date, to: Date, timeZone: string): MissionOccurrence[] {
  if (m.startMinute == null || m.endMinute == null || m.endMinute <= m.startMinute || m.weekdays.length === 0) return [];
  const days = new Set(m.weekdays);
  const firstKey = toLocalParts(from, timeZone).dateKey;
  const lastKey = toLocalParts(new Date(to.getTime() - 1), timeZone).dateKey;
  const startsKey = m.startsOn?.toISOString().slice(0, 10);
  const endsKey = m.endsOn?.toISOString().slice(0, 10);
  const out: MissionOccurrence[] = [];
  for (let k = firstKey; k <= lastKey; k = addDaysToKey(k, 1)) {
    if (!days.has(weekdayOfKey(k))) continue;
    if (startsKey && k < startsKey) continue;
    if (endsKey && k > endsKey) continue;
    const start = fromLocal(k, m.startMinute, timeZone);
    const end = fromLocal(k, m.endMinute, timeZone);
    if (end > from && start < to) out.push({ missionId: m.id, title: m.title, start, end });
  }
  return out;
}
