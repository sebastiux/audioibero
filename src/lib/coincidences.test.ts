import { describe, expect, it } from "vitest";
import { findCoincidences, presentAt, type ScheduleLike } from "./coincidences";

const p = (userId: string) => ({ userId, user: { name: userId.toUpperCase() } });
const s = (id: string, start: string, end: string, people: string[], kind: ScheduleLike["kind"] = "LAB"): ScheduleLike => ({
  id,
  start: `2026-10-20T${start}:00-06:00`,
  end: `2026-10-20T${end}:00-06:00`,
  kind,
  participants: people.map(p),
});
const hhmm = (d: Date) => d.toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false });

describe("findCoincidences", () => {
  const schedules = [
    s("mine", "10:00", "13:00", ["me"]),
    s("beto", "09:00", "11:00", ["beto"]),
    s("caro", "12:00", "15:00", ["caro", "dani"]),
    s("remoto", "10:00", "13:00", ["eva"], "ASYNC"),
    s("tarde", "16:00", "18:00", ["fer"]),
  ];

  it("lista quién coincide conmigo y en qué tramo, con mi equipo primero", () => {
    const [c] = findCoincidences("me", schedules, new Set(["caro"]));
    expect(c.scheduleId).toBe("mine");
    expect(c.people.map((x) => [x.name, hhmm(x.start), hhmm(x.end), x.teammate])).toEqual([
      ["CARO", "12:00", "13:00", true],
      ["BETO", "10:00", "11:00", false],
      ["DANI", "12:00", "13:00", false],
    ]);
  });

  it("ignora el trabajo asíncrono y los horarios que no se cruzan", () => {
    const names = findCoincidences("me", schedules, new Set()).flatMap((c) => c.people.map((x) => x.name));
    expect(names).not.toContain("EVA");
    expect(names).not.toContain("FER");
  });

  it("no reporta horarios donde estoy solo", () => {
    expect(findCoincidences("fer", schedules, new Set())).toEqual([]);
  });

  it("sabe quién está en el lab en un momento", () => {
    expect(presentAt(new Date("2026-10-20T12:30:00-06:00"), schedules).map((x) => x.name).sort()).toEqual(["CARO", "DANI", "ME"]);
  });
});
