import { describe, expect, it } from "vitest";
import { recommendSchedule, type SchedulerSettings } from "./scheduler";
import { fromLocal, toLocalParts } from "./time";

const TZ = "America/Mexico_City";
const settings: SchedulerSettings = {
  capacity: 4,
  openMinute: 9 * 60,
  closeMinute: 21 * 60,
  openDays: [1, 2, 3, 4, 5],
  slotMinutes: 30,
  maxWeeklyMinutes: 600,
  projectWeeklyMinutes: 240,
  projectSessionMinutes: 120,
};
// 2026-10-19 es lunes
const at = (day: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return fromLocal(day, h * 60 + m, TZ);
};
const local = (d: Date) => {
  const p = toLocalParts(d, TZ);
  return `${p.dateKey} ${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}`;
};
const week = { fromKey: "2026-10-19", toKey: "2026-10-25", timeZone: TZ };

describe("recommendSchedule", () => {
  it("cubre las horas semanales del proyecto en días distintos y dentro del horario", () => {
    const res = recommendSchedule({ ...week, settings, projects: [{ id: "p", name: "Disco", memberIds: ["a", "b", "c"] }] });
    expect(res.proposals).toHaveLength(2);
    const days = res.proposals.map((p) => local(p.start).slice(0, 10));
    expect(new Set(days).size).toBe(2);
    for (const p of res.proposals) {
      expect(p.participantIds).toEqual(["a", "b", "c"]);
      expect(local(p.start) >= `${local(p.start).slice(0, 10)} 09:00`).toBe(true);
      expect(local(p.end) <= `${local(p.end).slice(0, 10)} 21:00`).toBe(true);
      expect(p.end.getTime() - p.start.getTime()).toBe(120 * 60000);
    }
    expect(res.shortfall).toEqual([]);
  });

  it("evita las reservas existentes de los integrantes", () => {
    const res = recommendSchedule({
      ...week,
      toKey: "2026-10-19",
      settings: { ...settings, projectWeeklyMinutes: 120 },
      projects: [{ id: "p", name: "Disco", memberIds: ["a", "b"] }],
      existing: [{ participantIds: ["a"], start: at("2026-10-19", "09:00"), end: at("2026-10-19", "12:00") }],
    });
    expect(res.proposals).toHaveLength(1);
    expect(local(res.proposals[0].start)).toBe("2026-10-19 12:00");
  });

  it("no rebasa el cupo del lab y reporta lo que no cupo", () => {
    const res = recommendSchedule({
      ...week,
      toKey: "2026-10-19",
      settings: { ...settings, capacity: 3, openMinute: 9 * 60, closeMinute: 11 * 60, projectWeeklyMinutes: 120 },
      projects: [{ id: "p", name: "Disco", memberIds: ["a", "b"] }],
      existing: [{ participantIds: ["x", "y"], start: at("2026-10-19", "09:00"), end: at("2026-10-19", "11:00") }],
    });
    // 2 personas ya ocupan el lab y el cupo es 3: el proyecto (mín. 2) no cabe.
    expect(res.proposals).toHaveLength(0);
    expect(res.shortfall).toEqual([{ projectId: "p", missingMinutes: 120 }]);
  });

  it("cuenta las sesiones del proyecto que ya existen", () => {
    const res = recommendSchedule({
      ...week,
      settings,
      projects: [{ id: "p", name: "Disco", memberIds: ["a", "b"] }],
      existing: [{ participantIds: ["a", "b"], projectId: "p", start: at("2026-10-20", "10:00"), end: at("2026-10-20", "12:00") }],
    });
    expect(res.proposals).toHaveLength(1);
    expect(local(res.proposals[0].start).slice(0, 10)).not.toBe("2026-10-20");
  });

  it("respeta el tope semanal por miembro", () => {
    const res = recommendSchedule({
      ...week,
      settings: { ...settings, maxWeeklyMinutes: 120 },
      projects: [{ id: "p", name: "Disco", memberIds: ["a"] }],
    });
    expect(res.minutesByUser).toEqual({ a: 120 });
    expect(res.shortfall).toEqual([{ projectId: "p", missingMinutes: 120 }]);
  });
});
