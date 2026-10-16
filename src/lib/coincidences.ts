/**
 * Coincidencias: quién va a estar en el lab al mismo tiempo que yo.
 * Trabaja con los horarios registrados (cada uno puede tener varias personas).
 * El trabajo asíncrono no cuenta: no es estar en el lab.
 */

export type ScheduleLike = {
  id: string;
  start: string;
  end: string;
  kind: "LAB" | "PROJECT" | "ASYNC";
  participants: { userId: string; user: { name: string } }[];
};

export type CoincidencePerson = { userId: string; name: string; start: Date; end: Date; teammate: boolean };
export type Coincidence = { scheduleId: string; start: Date; end: Date; people: CoincidencePerson[] };

const ms = (s: string) => new Date(s).getTime();

/** Para cada horario mío en el lab, quiénes coinciden conmigo y durante qué tramo. */
export function findCoincidences(myId: string, schedules: ScheduleLike[], teammates: Set<string>): Coincidence[] {
  const inLab = schedules.filter((s) => s.kind !== "ASYNC");
  const mine = inLab.filter((s) => s.participants.some((p) => p.userId === myId));
  const out: Coincidence[] = [];

  for (const m of mine) {
    const ms0 = ms(m.start);
    const ms1 = ms(m.end);
    const byUser = new Map<string, CoincidencePerson>();
    for (const o of inLab) {
      const s = Math.max(ms0, ms(o.start));
      const e = Math.min(ms1, ms(o.end));
      if (e <= s) continue;
      for (const p of o.participants) {
        if (p.userId === myId) continue;
        const prev = byUser.get(p.userId);
        // Si la persona aparece en varios horarios dentro del mío, se toma el tramo total.
        byUser.set(p.userId, {
          userId: p.userId,
          name: p.user.name,
          teammate: teammates.has(p.userId),
          start: new Date(Math.min(prev?.start.getTime() ?? s, s)),
          end: new Date(Math.max(prev?.end.getTime() ?? e, e)),
        });
      }
    }
    if (byUser.size === 0) continue;
    const people = [...byUser.values()].sort(
      (a, b) => Number(b.teammate) - Number(a.teammate) || a.start.getTime() - b.start.getTime() || a.name.localeCompare(b.name),
    );
    out.push({ scheduleId: m.id, start: new Date(ms0), end: new Date(ms1), people });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Personas que están en el lab en un instante dado. */
export function presentAt(at: Date, schedules: ScheduleLike[]) {
  const t = at.getTime();
  const names = new Map<string, string>();
  for (const s of schedules) {
    if (s.kind === "ASYNC" || ms(s.start) > t || ms(s.end) <= t) continue;
    for (const p of s.participants) names.set(p.userId, p.user.name);
  }
  return [...names].map(([userId, name]) => ({ userId, name }));
}
