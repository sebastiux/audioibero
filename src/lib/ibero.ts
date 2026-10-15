import ICAL from "ical.js";
import { fromLocal } from "./time";

/**
 * Lee un calendario .ics (p. ej. el horario de clases exportado de Outlook/Office 365 de la Ibero)
 * y devuelve los bloques ocupados dentro de [from, to). Expande eventos recurrentes (RRULE),
 * respeta excepciones (EXDATE / RECURRENCE-ID) y omite eventos de día completo y "disponible".
 */

export type BusyBlock = { start: Date; end: Date; title: string };

export const MAX_ICS_BYTES = 1_000_000;

function toDate(time: ICAL.Time, timeZone: string): Date {
  // Horas "flotantes" (sin zona) o con una TZID que no viene definida: se toman como hora local del lab.
  const tzid = time.zone?.tzid;
  if (!tzid || tzid === "floating" || (tzid !== "UTC" && tzid !== "Z" && !ICAL.TimezoneService.has(tzid))) {
    const key = `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
    return fromLocal(key, time.hour * 60 + time.minute, timeZone);
  }
  return time.toJSDate();
}

export function parseIcs(text: string): ICAL.Component {
  if (text.length > MAX_ICS_BYTES) throw new Error("El archivo es demasiado grande (máximo 1 MB)");
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("No parece un calendario .ics (falta BEGIN:VCALENDAR)");
  let comp: ICAL.Component;
  try {
    comp = new ICAL.Component(ICAL.parse(text));
  } catch {
    throw new Error("No se pudo leer el archivo .ics");
  }
  for (const tz of comp.getAllSubcomponents("vtimezone")) {
    const zone = new ICAL.Timezone(tz);
    if (zone.tzid && !ICAL.TimezoneService.has(zone.tzid)) ICAL.TimezoneService.register(zone, zone.tzid);
  }
  return comp;
}

export function busyBlocksFromIcs(text: string, from: Date, to: Date, timeZone: string): BusyBlock[] {
  const comp = parseIcs(text);
  const vevents = comp.getAllSubcomponents("vevent");
  const masters: ICAL.Event[] = [];
  const exceptions = new Map<string, ICAL.Event[]>();

  for (const ve of vevents) {
    const ev = new ICAL.Event(ve);
    if (ev.isRecurrenceException()) {
      const list = exceptions.get(ev.uid) ?? [];
      list.push(ev);
      exceptions.set(ev.uid, list);
    } else {
      masters.push(ev);
    }
  }
  for (const ev of masters) for (const ex of exceptions.get(ev.uid) ?? []) ev.relateException(ex);

  const out: BusyBlock[] = [];
  const push = (ev: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
    if (start.isDate) return; // día completo
    const transp = ev.component.getFirstPropertyValue("transp");
    if (typeof transp === "string" && transp.toUpperCase() === "TRANSPARENT") return;
    const s = toDate(start, timeZone);
    const e = toDate(end, timeZone);
    if (e > from && s < to && e > s) out.push({ start: s, end: e, title: ev.summary || "Clase" });
  };

  for (const ev of masters) {
    if (ev.component.getFirstPropertyValue("status") === "CANCELLED") continue;
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate);
      continue;
    }
    const it = ev.iterator();
    for (let next = it.next(), guard = 0; next && guard < 5000; next = it.next(), guard++) {
      const occ = ev.getOccurrenceDetails(next);
      const s = toDate(occ.startDate, timeZone);
      if (s >= to) break;
      push(occ.item, occ.startDate, occ.endDate);
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Cuenta eventos distintos (para mostrar un resumen al subir el archivo). */
export function summarizeIcs(text: string) {
  const comp = parseIcs(text);
  const events = comp.getAllSubcomponents("vevent");
  return { events: events.length, recurring: events.filter((e) => e.hasProperty("rrule")).length };
}
