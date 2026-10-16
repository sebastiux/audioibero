import { addDaysToKey, fromLocal, toLocalParts, weekKeyOf, weekdayOfKey } from "./time";

/** Ajustes del lab que usa el plan personal. */
export type SchedulerSettings = {
  openMinute: number;
  closeMinute: number;
  openDays: number[];
  slotMinutes: number;
};

// ---------------------------------------------------------------------------------------------
// Plan personal: propone bloques para un miembro según las horas que quiere a la semana.
// ---------------------------------------------------------------------------------------------

export type PersonalInput = {
  fromKey: string;
  toKey: string;
  timeZone: string;
  settings: Pick<SchedulerSettings, "openMinute" | "closeMinute" | "openDays" | "slotMinutes">;
  /** Horas que el miembro quiere a la semana (en minutos) */
  weeklyMinutes: number;
  /** Duración de cada bloque (minutos) */
  blockMinutes: number;
  /** Si el trabajo es en el lab se prefieren las horas menos concurridas (no hay cupo); si es asíncrono, da igual. */
  usesLab: boolean;
  /** Lo que ocupa al miembro: clases Ibero, sus reservas y las sesiones fijas de sus proyectos */
  busy: { start: Date; end: Date; isClass?: boolean }[];
  /** Horarios en el lab de gente de sus proyectos: se prefiere coincidir con ellos */
  teamPresence?: { start: Date; end: Date }[];
  /** @deprecated ya no se usa: el lab no tiene cupo y coincidir con más gente no es malo */
  labBookings?: { start: Date; end: Date; people: number }[];
};

export type PersonalResult = {
  blocks: { start: Date; end: Date }[];
  /** Minutos que no se pudieron acomodar por semana (clave = lunes de la semana) */
  missing: Record<string, number>;
};

export function proposePersonal(input: PersonalInput): PersonalResult {
  const { settings, timeZone } = input;
  const slot = settings.slotMinutes;
  const nSlots = Math.floor((settings.closeMinute - settings.openMinute) / slot);
  const blockSlots = Math.max(1, Math.round(input.blockMinutes / slot));
  const openDays = new Set(settings.openDays);

  const days: string[] = [];
  for (let k = input.fromKey; k <= input.toKey; k = addDaysToKey(k, 1)) {
    if (openDays.has(weekdayOfKey(k))) days.push(k);
  }
  const daySet = new Set(days);
  const load = new Map(days.map((d) => [d, new Array<number>(nSlots).fill(0)]));
  const busy = new Map(days.map((d) => [d, new Array<boolean>(nSlots).fill(false)]));
  const classEdges = new Map(days.map((d) => [d, new Set<number>()])); // slots donde empieza o termina una clase
  const hasClass = new Set<string>();

  const eachSlot = (start: Date, end: Date, fn: (day: string, from: number, to: number) => void) => {
    const s = toLocalParts(start, timeZone);
    const e = toLocalParts(end, timeZone);
    for (let k = s.dateKey; k <= e.dateKey; k = addDaysToKey(k, 1)) {
      if (!daySet.has(k)) continue;
      const startMin = k === s.dateKey ? s.minutes : 0;
      const endMin = k === e.dateKey ? e.minutes : 1440;
      const from = Math.max(0, Math.floor((startMin - settings.openMinute) / slot));
      const to = Math.min(nSlots, Math.ceil((endMin - settings.openMinute) / slot));
      fn(k, from, to);
    }
  };

  // Cuántas personas del equipo hay en cada slot (para preferir coincidir con ellas).
  for (const b of input.teamPresence ?? []) {
    eachSlot(b.start, b.end, (d, from, to) => {
      const l = load.get(d)!;
      for (let i = from; i < to; i++) l[i] += 1;
    });
  }
  for (const b of input.busy) {
    eachSlot(b.start, b.end, (d, from, to) => {
      const bz = busy.get(d)!;
      for (let i = from; i < to; i++) bz[i] = true;
      if (b.isClass) {
        hasClass.add(d);
        classEdges.get(d)!.add(from).add(to);
      }
    });
  }

  const weeks = new Map<string, string[]>();
  for (const d of days) weeks.set(weekKeyOf(d), [...(weeks.get(weekKeyOf(d)) ?? []), d]);

  const blocks: PersonalResult["blocks"] = [];
  const missing: Record<string, number> = {};
  const perDay = new Map<string, number>();

  for (const [weekKey, weekDays] of weeks) {
    let remaining = input.weeklyMinutes;
    while (remaining >= slot) {
      const len = Math.min(blockSlots, Math.floor(remaining / slot));
      let best: { day: string; start: number; score: number } | null = null;
      for (const day of weekDays) {
        const l = load.get(day)!;
        const bz = busy.get(day)!;
        const edges = classEdges.get(day)!;
        for (let start = 0; start + len <= nSlots; start++) {
          let ok = true;
          let total = 0;
          for (let i = start; i < start + len && ok; i++) {
            if (bz[i]) ok = false;
            total += l[i];
          }
          if (!ok) continue;
          // Menor = mejor: un bloque por día, coincidir con tu equipo, días en que ya vas a la Ibero, pegado a una clase.
          const teamAvg = total / len;
          const score =
            (perDay.get(day) ?? 0) * 1000 -
            (input.usesLab ? Math.min(2, teamAvg) * 150 : 0) +
            (hasClass.has(day) ? 0 : 200) +
            (edges.has(start) || edges.has(start + len) ? 0 : 100) +
            start * 0.01;
          if (!best || score < best.score) best = { day, start, score };
        }
      }
      if (!best) break;
      const bz = busy.get(best.day)!;
      for (let i = best.start; i < best.start + len; i++) bz[i] = true;
      perDay.set(best.day, (perDay.get(best.day) ?? 0) + 1);
      blocks.push({
        start: fromLocal(best.day, settings.openMinute + best.start * slot, timeZone),
        end: fromLocal(best.day, settings.openMinute + (best.start + len) * slot, timeZone),
      });
      remaining -= len * slot;
    }
    if (remaining > 0) missing[weekKey] = remaining;
  }

  blocks.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { blocks, missing };
}
