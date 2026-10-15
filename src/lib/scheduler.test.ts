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

import { proposePersonal } from "./scheduler";
import { expandMission } from "./missions";

describe("proposePersonal", () => {
  const base = {
    fromKey: "2026-10-19",
    toKey: "2026-10-25",
    timeZone: TZ,
    settings: { capacity: 2, openMinute: 9 * 60, closeMinute: 21 * 60, openDays: [1, 2, 3, 4, 5], slotMinutes: 30 },
    blockMinutes: 120,
    usesLab: true,
    labBookings: [],
  };

  it("reparte las horas pedidas en días distintos, pegadas a las clases y sin cruzarse con ellas", () => {
    const res = proposePersonal({
      ...base,
      weeklyMinutes: 300,
      busy: [
        { start: at("2026-10-19", "09:00"), end: at("2026-10-19", "10:30"), isClass: true },
        { start: at("2026-10-20", "12:00"), end: at("2026-10-20", "14:00"), isClass: true },
      ],
    });
    expect(res.blocks.map((b) => `${local(b.start)}-${local(b.end).slice(11)}`)).toEqual([
      "2026-10-19 10:30-12:30",
      "2026-10-20 10:00-12:00",
      "2026-10-21 09:00-10:00",
    ]);
    expect(res.missing).toEqual({});
  });

  it("respeta el cupo del lab sólo si el trabajo es en el lab", () => {
    const full = { start: at("2026-10-19", "09:00"), end: at("2026-10-19", "21:00"), people: 2 };
    const oneDay = { ...base, toKey: "2026-10-19", weeklyMinutes: 120, busy: [], labBookings: [full] };
    expect(proposePersonal(oneDay).blocks).toHaveLength(0);
    expect(proposePersonal({ ...oneDay, usesLab: false }).blocks).toHaveLength(1);
  });
});

describe("expandMission", () => {
  it("genera las fechas de una sesión recurrente dentro de su vigencia", () => {
    const occ = expandMission(
      { id: "m", title: "Junta", weekdays: [2, 4], startMinute: 18 * 60, endMinute: 19 * 60, startsOn: new Date("2026-10-21T00:00:00Z"), endsOn: null },
      at("2026-10-19", "00:00"),
      at("2026-10-26", "00:00"),
      TZ,
    );
    expect(occ.map((o) => local(o.start))).toEqual(["2026-10-22 18:00"]);
  });
});
