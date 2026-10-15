import { describe, expect, it } from "vitest";
import { recommendSchedule, type SchedulerSettings } from "./scheduler";
import { fromLocal, toLocalParts } from "./time";

const TZ = "America/Mexico_City";
const settings: SchedulerSettings = {
  capacity: 2,
  openMinute: 9 * 60,
  closeMinute: 21 * 60,
  openDays: [1, 2, 3, 4, 5],
  slotMinutes: 30,
  minSessionMinutes: 60,
  maxWeeklyMinutes: 600,
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

describe("recommendSchedule", () => {
  it("recorta al horario del lab y respeta los días de apertura", () => {
    const res = recommendSchedule({
      fromKey: "2026-10-19",
      toKey: "2026-10-25",
      timeZone: TZ,
      settings,
      projects: [],
      availabilities: [
        { id: "a", userId: "u1", start: at("2026-10-19", "07:00"), end: at("2026-10-19", "10:00"), kind: "LAB", projectId: null },
        { id: "b", userId: "u1", start: at("2026-10-24", "10:00"), end: at("2026-10-24", "14:00"), kind: "LAB", projectId: null },
      ],
    });
    expect(res.proposals).toHaveLength(1);
    expect(local(res.proposals[0].start)).toBe("2026-10-19 09:00");
    expect(local(res.proposals[0].end)).toBe("2026-10-19 10:00");
    expect(res.unassignedAvailabilityIds).toEqual(["b"]);
  });

  it("no excede el cupo del laboratorio", () => {
    const availabilities = ["u1", "u2", "u3"].map((u) => ({
      id: u,
      userId: u,
      start: at("2026-10-20", "10:00"),
      end: at("2026-10-20", "12:00"),
      kind: "LAB" as const,
      projectId: null,
    }));
    const res = recommendSchedule({ fromKey: "2026-10-20", toKey: "2026-10-20", timeZone: TZ, settings, projects: [], availabilities });
    expect(res.proposals).toHaveLength(2);
    expect(res.unassignedAvailabilityIds).toHaveLength(1);
  });

  it("toma en cuenta las asignaciones existentes", () => {
    const res = recommendSchedule({
      fromKey: "2026-10-20",
      toKey: "2026-10-20",
      timeZone: TZ,
      settings,
      projects: [],
      existing: [
        { userId: "x", start: at("2026-10-20", "10:00"), end: at("2026-10-20", "11:00") },
        { userId: "y", start: at("2026-10-20", "10:00"), end: at("2026-10-20", "11:00") },
      ],
      availabilities: [
        { id: "a", userId: "u1", start: at("2026-10-20", "10:00"), end: at("2026-10-20", "12:00"), kind: "LAB", projectId: null },
      ],
    });
    expect(res.proposals).toHaveLength(1);
    expect(local(res.proposals[0].start)).toBe("2026-10-20 11:00");
  });

  it("agenda sesiones de proyecto donde coincide el equipo", () => {
    const res = recommendSchedule({
      fromKey: "2026-10-21",
      toKey: "2026-10-21",
      timeZone: TZ,
      settings: { ...settings, capacity: 5 },
      projects: [{ id: "p", name: "Disco", memberIds: ["u1", "u2", "u3"] }],
      availabilities: [
        { id: "1", userId: "u1", start: at("2026-10-21", "10:00"), end: at("2026-10-21", "13:00"), kind: "PROJECT", projectId: "p" },
        { id: "2", userId: "u2", start: at("2026-10-21", "11:00"), end: at("2026-10-21", "14:00"), kind: "PROJECT", projectId: "p" },
        { id: "3", userId: "u3", start: at("2026-10-21", "16:00"), end: at("2026-10-21", "18:00"), kind: "PROJECT", projectId: "p" },
      ],
    });
    const team = res.proposals.filter((p) => p.reason.startsWith("Sesión de equipo"));
    expect(team.map((p) => [p.userId, local(p.start), local(p.end)])).toEqual([
      ["u1", "2026-10-21 11:00", "2026-10-21 13:00"],
      ["u2", "2026-10-21 11:00", "2026-10-21 13:00"],
    ]);
    // u3 no coincidió con nadie: su tiempo pasa como trabajo individual en el lab
    expect(res.proposals.find((p) => p.userId === "u3")?.reason).toBe("Trabajo individual de proyecto en el lab");
  });

  it("reparte de forma equitativa y respeta el tope semanal", () => {
    const res = recommendSchedule({
      fromKey: "2026-10-19",
      toKey: "2026-10-23",
      timeZone: TZ,
      settings: { ...settings, capacity: 1, maxWeeklyMinutes: 180 },
      projects: [],
      availabilities: [
        { id: "a1", userId: "u1", start: at("2026-10-19", "09:00"), end: at("2026-10-19", "21:00"), kind: "LAB", projectId: null },
        { id: "b1", userId: "u2", start: at("2026-10-19", "09:00"), end: at("2026-10-19", "21:00"), kind: "LAB", projectId: null },
      ],
    });
    expect(res.minutesByUser).toEqual({ u1: 180, u2: 180 });
  });
});
