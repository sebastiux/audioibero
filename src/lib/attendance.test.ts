import { describe, expect, it } from "vitest";
import { attendanceFor } from "./attendance";

describe("attendanceFor", () => {
  const rows = [
    { userId: "ana", date: "", status: "GOING" as const },
    { userId: "ana", date: "2026-10-22", status: "NOT_GOING" as const },
    { userId: "beto", date: "2026-10-22", status: "GOING" as const },
    { userId: "caro", date: "", status: "NOT_GOING" as const },
  ];

  it("la respuesta de la fecha concreta gana sobre la de toda la serie", () => {
    expect(Object.fromEntries(attendanceFor(rows, "2026-10-22"))).toEqual({ ana: "NOT_GOING", beto: "GOING", caro: "NOT_GOING" });
  });

  it("en otras fechas aplica la respuesta de la serie", () => {
    expect(Object.fromEntries(attendanceFor(rows, "2026-10-29"))).toEqual({ ana: "GOING", caro: "NOT_GOING" });
  });
});
