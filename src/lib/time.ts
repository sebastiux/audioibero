import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "America/Mexico_City";

export function appTimeZone() {
  return process.env.APP_TIMEZONE || DEFAULT_TIMEZONE;
}

export type LocalParts = {
  /** Fecha local YYYY-MM-DD */
  dateKey: string;
  /** Minutos desde la medianoche local */
  minutes: number;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
};

export function toLocalParts(date: Date, timeZone: string): LocalParts {
  const [dateKey, hh, mm, iso] = formatInTimeZone(date, timeZone, "yyyy-MM-dd|HH|mm|i").split("|");
  return {
    dateKey,
    minutes: Number(hh) * 60 + Number(mm),
    weekday: Number(iso) % 7,
  };
}

/** Convierte una fecha local + minutos (puede ser 1440 = medianoche siguiente) a un Date UTC. */
export function fromLocal(dateKey: string, minutes: number, timeZone: string): Date {
  const dayOffset = Math.floor(minutes / 1440);
  const m = minutes - dayOffset * 1440;
  const key = dayOffset === 0 ? dateKey : addDaysToKey(dateKey, dayOffset);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return fromZonedTime(`${key}T${hh}:${mm}:00`, timeZone);
}

export function addDaysToKey(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOfKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

/** Lunes (YYYY-MM-DD) de la semana a la que pertenece la fecha local. */
export function weekKeyOf(dateKey: string) {
  const wd = weekdayOfKey(dateKey);
  return addDaysToKey(dateKey, wd === 0 ? -6 : 1 - wd);
}

export function minutesToHHMM(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function hhmmToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}
