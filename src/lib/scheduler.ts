import { addDaysToKey, fromLocal, toLocalParts, weekKeyOf, weekdayOfKey } from "./time";

/**
 * Generador del calendario recomendado.
 *
 * Trabaja en "slots" discretos (p. ej. 30 min) dentro del horario del lab, en la zona horaria local.
 *  1. Sesiones de proyecto: busca ventanas en las que coinciden suficientes integrantes de un
 *     proyecto (disponibilidad tipo PROJECT) y los asigna juntos.
 *  2. Uso libre del lab: reparte la disponibilidad tipo LAB priorizando a quien lleva menos
 *     minutos asignados en la semana (reparto equitativo), respetando el cupo del lab.
 * Siempre respeta: cupo simultáneo, horario/días de apertura, duración mínima de sesión,
 * tope semanal por miembro y las asignaciones que ya existen.
 */

export type SlotKind = "LAB" | "PROJECT";

export type SchedulerAvailability = {
  id: string;
  userId: string;
  start: Date;
  end: Date;
  kind: SlotKind;
  projectId: string | null;
};

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
  minSessionMinutes: number;
  maxWeeklyMinutes: number;
};

export type ExistingAssignment = {
  userId: string;
  start: Date;
  end: Date;
};

export type Proposal = {
  userId: string;
  start: Date;
  end: Date;
  kind: SlotKind;
  projectId: string | null;
  reason: string;
};

export type RecommendInput = {
  /** Primer día local (YYYY-MM-DD), inclusivo */
  fromKey: string;
  /** Último día local (YYYY-MM-DD), inclusivo */
  toKey: string;
  timeZone: string;
  settings: SchedulerSettings;
  availabilities: SchedulerAvailability[];
  projects: SchedulerProject[];
  existing?: ExistingAssignment[];
};

export type RecommendResult = {
  proposals: Proposal[];
  /** Minutos propuestos por miembro (sólo lo nuevo) */
  minutesByUser: Record<string, number>;
  /** Disponibilidades que no recibieron ningún horario */
  unassignedAvailabilityIds: string[];
};

type Segment = {
  availabilityId: string;
  userId: string;
  dayKey: string;
  startSlot: number;
  endSlot: number; // exclusivo
  kind: SlotKind;
  projectId: string | null;
};

export function recommendSchedule(input: RecommendInput): RecommendResult {
  const { settings, timeZone } = input;
  const slot = settings.slotMinutes;
  const nSlots = Math.floor((settings.closeMinute - settings.openMinute) / slot);
  const minSlots = Math.max(1, Math.ceil(settings.minSessionMinutes / slot));
  const openDays = new Set(settings.openDays);

  const days: string[] = [];
  for (let k = input.fromKey; k <= input.toKey; k = addDaysToKey(k, 1)) {
    if (openDays.has(weekdayOfKey(k))) days.push(k);
  }
  const daySet = new Set(days);

  // Estado: ocupación del lab por slot, slots ocupados por usuario y minutos por semana.
  const load = new Map<string, number[]>();
  for (const d of days) load.set(d, new Array(nSlots).fill(0));
  const busy = new Map<string, Set<number>>(); // `${userId}|${dayKey}` -> slots
  const weekly = new Map<string, number>(); // `${userId}|${weekKey}` -> minutos

  const busySet = (userId: string, dayKey: string) => {
    const key = `${userId}|${dayKey}`;
    let s = busy.get(key);
    if (!s) busy.set(key, (s = new Set()));
    return s;
  };
  const weeklyMinutes = (userId: string, dayKey: string) => weekly.get(`${userId}|${weekKeyOf(dayKey)}`) ?? 0;
  const addWeekly = (userId: string, dayKey: string, minutes: number) => {
    const key = `${userId}|${weekKeyOf(dayKey)}`;
    weekly.set(key, (weekly.get(key) ?? 0) + minutes);
  };

  // Convierte un intervalo real a segmentos de slots por día (recortado al horario del lab).
  const toSegments = (start: Date, end: Date): { dayKey: string; startSlot: number; endSlot: number }[] => {
    const out: { dayKey: string; startSlot: number; endSlot: number }[] = [];
    const s = toLocalParts(start, timeZone);
    const e = toLocalParts(end, timeZone);
    for (let k = s.dateKey; k <= e.dateKey; k = addDaysToKey(k, 1)) {
      if (!daySet.has(k)) continue;
      const startMin = k === s.dateKey ? s.minutes : 0;
      const endMin = k === e.dateKey ? e.minutes : 1440;
      const from = Math.max(startMin, settings.openMinute);
      const to = Math.min(endMin, settings.closeMinute);
      if (to <= from) continue;
      const startSlot = Math.ceil((from - settings.openMinute) / slot);
      const endSlot = Math.min(nSlots, Math.floor((to - settings.openMinute) / slot));
      if (endSlot > startSlot) out.push({ dayKey: k, startSlot, endSlot });
    }
    return out;
  };

  // Asignaciones existentes: cuentan para el cupo, los choques y el tope semanal.
  for (const a of input.existing ?? []) {
    for (const seg of toSegments(a.start, a.end)) {
      const l = load.get(seg.dayKey)!;
      const b = busySet(a.userId, seg.dayKey);
      for (let i = seg.startSlot; i < seg.endSlot; i++) {
        l[i]++;
        b.add(i);
      }
      addWeekly(a.userId, seg.dayKey, (seg.endSlot - seg.startSlot) * slot);
    }
  }

  const segments: Segment[] = [];
  for (const av of input.availabilities) {
    const kind: SlotKind = av.kind === "PROJECT" && av.projectId ? "PROJECT" : "LAB";
    for (const seg of toSegments(av.start, av.end)) {
      segments.push({
        availabilityId: av.id,
        userId: av.userId,
        kind,
        projectId: kind === "PROJECT" ? av.projectId : null,
        ...seg,
      });
    }
  }

  const proposals: Proposal[] = [];
  const minutesByUser: Record<string, number> = {};
  const servedAvailability = new Set<string>();

  const commit = (
    seg: Pick<Segment, "userId" | "dayKey" | "kind" | "projectId">,
    from: number,
    to: number,
    reason: string,
    sourceIds: string[],
  ) => {
    const l = load.get(seg.dayKey)!;
    const b = busySet(seg.userId, seg.dayKey);
    for (let i = from; i < to; i++) {
      l[i]++;
      b.add(i);
    }
    const minutes = (to - from) * slot;
    addWeekly(seg.userId, seg.dayKey, minutes);
    minutesByUser[seg.userId] = (minutesByUser[seg.userId] ?? 0) + minutes;
    for (const id of sourceIds) servedAvailability.add(id);
    proposals.push({
      userId: seg.userId,
      start: fromLocal(seg.dayKey, settings.openMinute + from * slot, timeZone),
      end: fromLocal(seg.dayKey, settings.openMinute + to * slot, timeZone),
      kind: seg.kind,
      projectId: seg.projectId,
      reason,
    });
  };

  /** Recorta un bloque [from,to) al tope semanal restante; null si queda más corto que la sesión mínima. */
  const fitWeekly = (userId: string, dayKey: string, from: number, to: number): [number, number] | null => {
    const remaining = settings.maxWeeklyMinutes - weeklyMinutes(userId, dayKey);
    const maxSlots = Math.floor(remaining / slot);
    const end = Math.min(to, from + maxSlots);
    return end - from >= minSlots ? [from, end] : null;
  };

  // ---------- Fase 1: sesiones de proyecto ----------
  const projectsById = new Map(input.projects.map((p) => [p.id, p]));
  const projectSegments = new Map<string, Segment[]>();
  for (const seg of segments) {
    if (seg.kind !== "PROJECT" || !seg.projectId || !projectsById.has(seg.projectId)) continue;
    const list = projectSegments.get(seg.projectId) ?? [];
    list.push(seg);
    projectSegments.set(seg.projectId, list);
  }

  // Proyectos con más gente primero: son los más difíciles de cuadrar.
  const orderedProjects = [...projectSegments.keys()].sort(
    (a, b) => new Set(projectSegments.get(b)!.map((s) => s.userId)).size - new Set(projectSegments.get(a)!.map((s) => s.userId)).size,
  );

  for (const projectId of orderedProjects) {
    const project = projectsById.get(projectId)!;
    const segs = projectSegments.get(projectId)!;
    const participants = new Set([...project.memberIds, ...segs.map((s) => s.userId)]);
    const teamSize = participants.size;
    const minTeam = teamSize <= 1 ? 1 : Math.min(teamSize, Math.max(2, Math.ceil(teamSize / 2)));

    for (const dayKey of days) {
      const daySegs = segs.filter((s) => s.dayKey === dayKey);
      if (daySegs.length === 0) continue;
      const l = load.get(dayKey)!;

      // Por slot: quién está disponible (y libre) para este proyecto.
      const availableAt: string[][] = Array.from({ length: nSlots }, () => []);
      const sourceIdsByUser = new Map<string, Set<string>>();
      for (const s of daySegs) {
        const b = busySet(s.userId, dayKey);
        for (let i = s.startSlot; i < s.endSlot; i++) {
          if (!b.has(i) && !availableAt[i].includes(s.userId)) availableAt[i].push(s.userId);
        }
        const ids = sourceIdsByUser.get(s.userId) ?? new Set();
        ids.add(s.availabilityId);
        sourceIdsByUser.set(s.userId, ids);
      }

      // Selección por slot respetando cupo (prioriza a quien lleva menos minutos esta semana).
      const chosenAt: Set<string>[] = availableAt.map((users, i) => {
        const free = settings.capacity - l[i];
        if (users.length < minTeam || free < minTeam) return new Set<string>();
        const ordered = [...users].sort((a, b) => weeklyMinutes(a, dayKey) - weeklyMinutes(b, dayKey));
        return new Set(ordered.slice(0, free));
      });

      // Ventanas continuas con equipo suficiente y duración mínima.
      let i = 0;
      while (i < nSlots) {
        if (chosenAt[i].size < minTeam) {
          i++;
          continue;
        }
        let j = i;
        while (j < nSlots && chosenAt[j].size >= minTeam) j++;
        if (j - i >= minSlots) {
          const windowUsers = new Set<string>();
          for (let k = i; k < j; k++) chosenAt[k].forEach((u) => windowUsers.add(u));
          const label = `Sesión de equipo: ${project.name}`;
          for (const userId of windowUsers) {
            // Bloques continuos del usuario dentro de la ventana.
            let k = i;
            while (k < j) {
              if (!chosenAt[k].has(userId)) {
                k++;
                continue;
              }
              let m = k;
              while (m < j && chosenAt[m].has(userId)) m++;
              const fit = fitWeekly(userId, dayKey, k, m);
              if (fit) {
                commit({ userId, dayKey, kind: "PROJECT", projectId }, fit[0], fit[1], label, [
                  ...(sourceIdsByUser.get(userId) ?? []),
                ]);
              }
              k = m;
            }
          }
        }
        i = j;
      }
    }
  }

  // ---------- Fase 2: uso libre del lab (reparto equitativo) ----------
  // Las disponibilidades de proyecto que no formaron sesión también pueden usarse como tiempo de lab.
  const pending = segments
    .filter((s) => s.kind === "LAB" || !servedAvailability.has(s.availabilityId))
    .sort((a, b) => (a.dayKey === b.dayKey ? a.startSlot - b.startSlot : a.dayKey < b.dayKey ? -1 : 1));

  while (pending.length > 0) {
    // Siguiente: el miembro con menos minutos en la semana de ese segmento; empate → más temprano.
    let best = 0;
    for (let k = 1; k < pending.length; k++) {
      const a = pending[k];
      const b = pending[best];
      const wa = weeklyMinutes(a.userId, a.dayKey);
      const wb = weeklyMinutes(b.userId, b.dayKey);
      if (wa < wb) best = k;
    }
    const seg = pending.splice(best, 1)[0];
    const l = load.get(seg.dayKey)!;
    const b = busySet(seg.userId, seg.dayKey);

    let i = seg.startSlot;
    while (i < seg.endSlot) {
      if (l[i] >= settings.capacity || b.has(i)) {
        i++;
        continue;
      }
      let j = i;
      while (j < seg.endSlot && l[j] < settings.capacity && !b.has(j)) j++;
      const fit = fitWeekly(seg.userId, seg.dayKey, i, j);
      if (fit) {
        const reason =
          seg.kind === "PROJECT" ? "Trabajo individual de proyecto en el lab" : "Uso libre del laboratorio";
        commit(seg, fit[0], fit[1], reason, [seg.availabilityId]);
      }
      i = j;
    }
  }

  proposals.sort((a, b) => a.start.getTime() - b.start.getTime() || a.userId.localeCompare(b.userId));

  return {
    proposals,
    minutesByUser,
    unassignedAvailabilityIds: input.availabilities.map((a) => a.id).filter((id) => !servedAvailability.has(id)),
  };
}
