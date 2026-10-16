/**
 * Asistencia a sesiones fijas. Cada persona puede responder para una fecha concreta o para toda la
 * serie (date = ""). La respuesta de la fecha concreta tiene prioridad sobre la de la serie.
 */

export type AttendanceRow = { userId: string; date: string; status: "GOING" | "NOT_GOING" };

/** Estado de cada persona para una fecha (YYYY-MM-DD). */
export function attendanceFor(rows: AttendanceRow[], dateKey: string) {
  const out = new Map<string, "GOING" | "NOT_GOING">();
  for (const r of rows) if (r.date === "") out.set(r.userId, r.status);
  for (const r of rows) if (r.date === dateKey) out.set(r.userId, r.status);
  return out;
}
