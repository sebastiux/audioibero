import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { busyBlocksFromIcs, summarizeIcs } from "./ibero";
import { fromLocal, toLocalParts } from "./time";

const TZ = "America/Mexico_City";
const ics = readFileSync(path.join(__dirname, "__fixtures__/ibero.ics"), "utf8");
const local = (d: Date) => {
  const p = toLocalParts(d, TZ);
  return `${p.dateKey} ${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}`;
};

describe("busyBlocksFromIcs", () => {
  it("expande clases semanales, respeta EXDATE e ignora días completos", () => {
    const blocks = busyBlocksFromIcs(ics, fromLocal("2026-10-19", 0, TZ), fromLocal("2026-10-26", 0, TZ), TZ);
    expect(blocks.map((b) => `${b.title} ${local(b.start)}-${local(b.end).slice(11)}`)).toEqual([
      "Acústica 2026-10-19 09:00-10:30",
      "Mezcla 2026-10-20 12:00-14:00",
      // el miércoles 21 está excluido por EXDATE
    ]);
  });

  it("no incluye el feriado de día completo", () => {
    const blocks = busyBlocksFromIcs(ics, fromLocal("2026-11-02", 0, TZ), fromLocal("2026-11-03", 0, TZ), TZ);
    expect(blocks.map((b) => b.title)).toEqual(["Acústica"]);
  });

  it("resume y valida el archivo", () => {
    expect(summarizeIcs(ics)).toEqual({ events: 3, recurring: 2 });
    expect(() => summarizeIcs("hola")).toThrow(/ics/);
  });
});
