import { describe, expect, it } from "vitest";
import { recommendSchedule, type SchedulerSettings } from "./scheduler";
import { fromLocal, toLocalParts } from "./time";

const TZ = "America/Mexico_City";
const settings: SchedulerSettings = {
  openMinute: 9 * 60,
  closeMinute: 21 * 60,
  openDays: [1, 2, 3, 4, 5],
  slotMinutes: 30,
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

  it("el lab no tiene cupo: prefiere horas menos concurridas pero no se bloquea", () => {
    const crowd = (from: string, to: string) => ({
      participantIds: ["x", "y", "z", "w", "v"],
      start: at("2026-10-19", from),
      end: at("2026-10-19", to),
    });
    const oneDay = { ...week, toKey: "2026-10-19", projects: [{ id: "p", name: "Disco", memberIds: ["a", "b"] }] };
    // Mucha gente de 9 a 11: la sesión se va a la siguiente hora libre.
    const res = recommendSchedule({ ...oneDay, settings: { ...settings, projectWeeklyMinutes: 120 }, existing: [crowd("09:00", "11:00")] });
    expect(local(res.proposals[0].start)).toBe("2026-10-19 11:00");
    // Aunque el lab esté concurrido todo el día, igual se agenda.
    const full = recommendSchedule({ ...oneDay, settings: { ...settings, projectWeeklyMinutes: 120 }, existing: [crowd("09:00", "21:00")] });
    expect(full.proposals).toHaveLength(1);
    expect(full.shortfall).toEqual([]);
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

  it("no hay tope semanal: un miembro con muchas horas igual recibe sus sesiones", () => {
    const busyWeek = ["2026-10-19", "2026-10-20", "2026-10-21"].map((d) => ({
      participantIds: ["a"],
      start: at(d, "09:00"),
      end: at(d, "13:00"),
    }));
    const res = recommendSchedule({ ...week, settings, projects: [{ id: "p", name: "Disco", memberIds: ["a"] }], existing: busyWeek });
    expect(res.minutesByUser).toEqual({ a: 240 });
    expect(res.shortfall).toEqual([]);
  });
});

import { proposePersonal } from "./scheduler";
import { expandMission } from "./missions";

describe("proposePersonal", () => {
  const base = {
    fromKey: "2026-10-19",
    toKey: "2026-10-25",
    timeZone: TZ,
    settings: { openMinute: 9 * 60, closeMinute: 21 * 60, openDays: [1, 2, 3, 4, 5], slotMinutes: 30 },
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

  it("no hay cupo: un lab lleno no impide proponer, sólo se prefiere otra hora", () => {
    const busyMorning = { start: at("2026-10-19", "09:00"), end: at("2026-10-19", "13:00"), people: 20 };
    const allDay = { start: at("2026-10-19", "09:00"), end: at("2026-10-19", "21:00"), people: 20 };
    const oneDay = { ...base, toKey: "2026-10-19", weeklyMinutes: 120, busy: [] };
    expect(local(proposePersonal({ ...oneDay, labBookings: [busyMorning] }).blocks[0].start)).toBe("2026-10-19 13:00");
    expect(proposePersonal({ ...oneDay, labBookings: [allDay] }).blocks).toHaveLength(1);
  });

  it("puede planear todo un semestre: cada semana recibe sus horas", () => {
    const res = proposePersonal({ ...base, fromKey: "2026-08-10", toKey: "2026-12-05", weeklyMinutes: 240, busy: [] });
    expect(res.blocks).toHaveLength(17 * 2);
    expect(res.missing).toEqual({});
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
