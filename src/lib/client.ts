/** fetch JSON con manejo de errores en español para componentes cliente. */
export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  return data as T;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD en hora local del navegador */
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** HH:mm en hora local del navegador */
export const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fromInputs = (date: string, time: string) => new Date(`${date}T${time}:00`);

export const minutesToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const hhmmToMinutes = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
};

export const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function formatRange(start: Date, end: Date) {
  const day = start.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return `${day}, ${toTimeInput(start)}–${toTimeInput(end)}`;
}

export function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Zona horaria del club. Las fechas que se muestran se formatean siempre en esta zona para que
 * el servidor (UTC en Railway) y el navegador generen el mismo texto (si no, React marca error de hidratación).
 */
export const APP_TZ = "America/Mexico_City";

export function fmtDate(iso: string | Date, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString("es-MX", { timeZone: APP_TZ, ...opts });
}

/** Fecha local del club (YYYY-MM-DD), igual en servidor y navegador. */
export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDaysKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado de una fecha YYYY-MM-DD. */
export const weekdayOfKey = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();
