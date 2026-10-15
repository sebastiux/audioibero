import { addDaysToKey, fromLocal, toLocalParts, weekKeyOf, weekdayOfKey } from "./time";

/**
 * Generador del calendario recomendado.
 *
 * Todos los miembros están disponibles por defecto; lo que limita son las reservas que ya
 * existen y el cupo del lab. Para cada proyecto activo propone sesiones de equipo hasta cubrir
 * las horas semanales configuradas:
 *  - en horario y días de apertura, sin rebasar el cupo simultáneo del lab,
 *  - sin cruzarse con reservas de los integrantes (si no caben todos, al menos la mitad del equipo),
 *  - repartidas en días distintos y en las horas menos ocupadas del lab,
 *  - sin pasar el tope semanal de horas de cada integrante.
 */

export type SchedulerProject = {
  id: string;
  name: string;
  memberIds: string[];
};

export type SchedulerSettings = {
  capacity: number;
  openMinute: number;
  closeMinute: number;
  openDays: number[];
  slotMinutes: number;
  maxWeeklyMinutes: number;
  projectWeeklyMinutes: number;
  projectSessionMinutes: number;
};

export type ExistingBooking = {
  start: Date;
  end: Date;
  participantIds: string[];
  projectId?: string | null;
  /** false para lo que bloquea a las personas pero no ocupa el lab (trabajo asíncrono, clases, misiones). */
  occupiesLab?: boolean;
};

export type Proposal = {
  projectId: string;
  start: Date;
  end: Date;
  participantIds: string[];
  reason: string;
};

export type RecommendInput = {
  /** Primer día local (YYYY-MM-DD), inclusivo */
  fromKey: string;
  /** Último día local (YYYY-MM-DD), inclusivo */
  toKey: string;
  timeZone: string;
  settings: SchedulerSettings;
  projects: SchedulerProject[];
  existing?: ExistingBooking[];
};

export type RecommendResult = {
  proposals: Proposal[];
  /** Minutos propuestos por miembro (sólo lo nuevo) */
  minutesByUser: Record<string, number>;
  /** Proyectos a los que no se les pudo cubrir todo el tiempo pedido: minutos faltantes */
  shortfall: { projectId: string; missingMinutes: number }[];
};

export function recommendSchedule(input: RecommendInput): RecommendResult {
  const { settings, timeZone } = input;
  const slot = settings.slotMinutes;
  const nSlots = Math.floor((settings.closeMinute - settings.openMinute) / slot);
  const sessionSlots = Math.max(1, Math.round(settings.projectSessionMinutes / slot));
  const openDays = new Set(settings.openDays);

  const days: string[] = [];
  for (let k = input.fromKey; k <= input.toKey; k = addDaysToKey(k, 1)) {
    if (openDays.has(weekdayOfKey(k))) days.push(k);
  }
  const daySet = new Set(days);

  const load = new Map<string, number[]>(days.map((d) => [d, new Array(nSlots).fill(0)]));
  const busy = new Map<string, Set<number>>(); // `${userId}|${dayKey}` -> slots ocupados
  const weekly = new Map<string, number>(); // `${userId}|${weekKey}` -> minutos
  const projectDays = new Map<string, Map<string, number>>(); // projectId -> dayKey -> sesiones

  const busySet = (userId: string, dayKey: string) => {
    const key = `${userId}|${dayKey}`;
    let s = busy.get(key);
    if (!s) busy.set(key, (s = new Set()));
    return s;
  };
  const weeklyMinutes = (userId: string, weekKey: string) => weekly.get(`${userId}|${weekKey}`) ?? 0;
  const addWeekly = (userId: string, weekKey: string, minutes: number) => {
    const key = `${userId}|${weekKey}`;
    weekly.set(key, (weekly.get(key) ?? 0) + minutes);
  };
  const markProjectDay = (projectId: string, dayKey: string) => {
    const m = projectDays.get(projectId) ?? new Map<string, number>();
    m.set(dayKey, (m.get(dayKey) ?? 0) + 1);
    projectDays.set(projectId, m);
  };

  // Reservas existentes: ocupan cupo, bloquean a sus participantes y cuentan para el tope semanal.
  for (const b of input.existing ?? []) {
    const s = toLocalParts(b.start, timeZone);
    const e = toLocalParts(b.end, timeZone);
    for (let k = s.dateKey; k <= e.dateKey; k = addDaysToKey(k, 1)) {
      const startMin = k === s.dateKey ? s.minutes : 0;
      const endMin = k === e.dateKey ? e.minutes : 1440;
      const minutes = Math.max(0, endMin - startMin);
      for (const u of b.participantIds) addWeekly(u, weekKeyOf(k), minutes);
      if (!daySet.has(k)) continue;
      // Cualquier traslape con un slot lo ocupa (redondeo hacia afuera).
      const from = Math.max(0, Math.floor((startMin - settings.openMinute) / slot));
      const to = Math.min(nSlots, Math.ceil((endMin - settings.openMinute) / slot));
      const l = load.get(k)!;
      const people = b.occupiesLab === false ? 0 : b.participantIds.length;
      for (let i = from; i < to; i++) {
        l[i] += people;
        for (const u of b.participantIds) busySet(u, k).add(i);
      }
      if (b.projectId) markProjectDay(b.projectId, k);
    }
  }

  const proposals: Proposal[] = [];
  const minutesByUser: Record<string, number> = {};
  const shortfall: RecommendResult["shortfall"] = [];
  const sessionMinutes = sessionSlots * slot;

  // Agrupa los días por semana para repartir las horas semanales de cada proyecto.
  const weeks = new Map<string, string[]>();
  for (const d of days) {
    const w = weekKeyOf(d);
    weeks.set(w, [...(weeks.get(w) ?? []), d]);
  }

  // Proyectos con más integrantes primero: son los más difíciles de cuadrar.
  const projects = input.projects
    .filter((p) => p.memberIds.length > 0)
    .sort((a, b) => b.memberIds.length - a.memberIds.length);

  for (const project of projects) {
    const team = project.memberIds;
    const minTeam = team.length === 1 ? 1 : Math.max(2, Math.ceil(team.length / 2));

    for (const [weekKey, weekDays] of weeks) {
      // Sesiones que ya existen esta semana para el proyecto cuentan para la meta.
      let missing = settings.projectWeeklyMinutes;
      for (const d of weekDays) missing -= (projectDays.get(project.id)?.get(d) ?? 0) * sessionMinutes;

      while (missing > 0) {
        let best: { day: string; start: number; members: string[]; score: number } | null = null;

        for (const day of weekDays) {
          const l = load.get(day)!;
          const sessionsThatDay = projectDays.get(project.id)?.get(day) ?? 0;
          for (let start = 0; start + sessionSlots <= nSlots; start++) {
            const members = team.filter((u) => {
              if (weeklyMinutes(u, weekKey) + sessionMinutes > settings.maxWeeklyMinutes) return false;
              const b = busySet(u, day);
              for (let i = start; i < start + sessionSlots; i++) if (b.has(i)) return false;
              return true;
            });
            if (members.length < minTeam) continue;
            let peak = 0;
            let total = 0;
            for (let i = start; i < start + sessionSlots; i++) {
              peak = Math.max(peak, l[i]);
              total += l[i];
            }
            if (peak + members.length > settings.capacity) continue;
            // Menor puntaje = mejor: más integrantes, días sin sesión del proyecto, lab menos lleno, más temprano.
            const score = -members.length * 1000 + sessionsThatDay * 500 + total * 10 + start * 0.01;
            if (!best || score < best.score) best = { day, start, members, score };
          }
        }

        if (!best) break;

        const { day, start, members } = best;
        const l = load.get(day)!;
        for (let i = start; i < start + sessionSlots; i++) {
          l[i] += members.length;
          for (const u of members) busySet(u, day).add(i);
        }
        for (const u of members) {
          addWeekly(u, weekKey, sessionMinutes);
          minutesByUser[u] = (minutesByUser[u] ?? 0) + sessionMinutes;
        }
        markProjectDay(project.id, day);
        proposals.push({
          projectId: project.id,
          start: fromLocal(day, settings.openMinute + start * slot, timeZone),
          end: fromLocal(day, settings.openMinute + (start + sessionSlots) * slot, timeZone),
          participantIds: members,
          reason:
            members.length === team.length
              ? `Sesión de equipo: ${project.name}`
              : `Sesión de equipo: ${project.name} (${members.length} de ${team.length} integrantes libres)`,
        });
        missing -= sessionMinutes;
      }

      if (missing > 0) shortfall.push({ projectId: project.id, missingMinutes: missing });
    }
  }

  proposals.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { proposals, minutesByUser, shortfall };
}

// ---------------------------------------------------------------------------------------------
// Plan personal: propone bloques para un miembro según las horas que quiere a la semana.
// ---------------------------------------------------------------------------------------------

export type PersonalInput = {
  fromKey: string;
  toKey: string;
  timeZone: string;
  settings: Pick<SchedulerSettings, "capacity" | "openMinute" | "closeMinute" | "openDays" | "slotMinutes">;
  /** Horas que el miembro quiere a la semana (en minutos) */
  weeklyMinutes: number;
  /** Duración de cada bloque (minutos) */
  blockMinutes: number;
  /** Si el trabajo es en el lab, se respeta el cupo; si es asíncrono, no. */
  usesLab: boolean;
  /** Lo que ocupa al miembro: clases Ibero, sus reservas, misiones generales */
  busy: { start: Date; end: Date; isClass?: boolean }[];
  /** Reservas de todo el club, para el cupo del lab */
  labBookings: { start: Date; end: Date; people: number }[];
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

  for (const b of input.labBookings) {
    eachSlot(b.start, b.end, (d, from, to) => {
      const l = load.get(d)!;
      for (let i = from; i < to; i++) l[i] += b.people;
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
            if (bz[i] || (input.usesLab && l[i] + 1 > settings.capacity)) ok = false;
            total += l[i];
          }
          if (!ok) continue;
          // Menor = mejor: un bloque por día, días en que ya vas a la Ibero, pegado a una clase, lab menos lleno.
          const score =
            (perDay.get(day) ?? 0) * 1000 +
            (hasClass.has(day) ? 0 : 200) +
            (edges.has(start) || edges.has(start + len) ? 0 : 100) +
            (input.usesLab ? total * 10 : 0) +
            start * 0.01;
          if (!best || score < best.score) best = { day, start, score };
        }
      }
      if (!best) break;
      const bz = busy.get(best.day)!;
      const l = load.get(best.day)!;
      for (let i = best.start; i < best.start + len; i++) {
        bz[i] = true;
        if (input.usesLab) l[i] += 1;
      }
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
