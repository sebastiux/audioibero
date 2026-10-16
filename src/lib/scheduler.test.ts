import { describe, expect, it } from "vitest";
import { fromLocal, toLocalParts } from "./time";

const TZ = "America/Mexico_City";
// 2026-10-19 es lunes
const at = (day: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return fromLocal(day, h * 60 + m, TZ);
};
const local = (d: Date) => {
  const p = toLocalParts(d, TZ);
  return `${p.dateKey} ${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}`;
};

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

  it("prefiere las horas en las que va a estar tu equipo", () => {
    const oneDay = { ...base, toKey: "2026-10-19", weeklyMinutes: 120, busy: [] };
    const team = [{ start: at("2026-10-19", "15:00"), end: at("2026-10-19", "17:00") }];
    expect(local(proposePersonal({ ...oneDay, teamPresence: team }).blocks[0].start)).toBe("2026-10-19 15:00");
    // Para trabajo asíncrono no importa dónde esté el equipo.
    expect(local(proposePersonal({ ...oneDay, usesLab: false, teamPresence: team }).blocks[0].start)).toBe("2026-10-19 09:00");
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
