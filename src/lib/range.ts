import "server-only";
import { badRequest } from "./api";
import { addDaysToKey, appTimeZone, fromLocal } from "./time";

/** Convierte un periodo de días locales (inclusivo) en instantes UTC [start, end). */
export function rangeBounds(fromKey: string, toKey: string) {
  if (toKey < fromKey) throw badRequest("La fecha final debe ser posterior a la inicial");
  const tz = appTimeZone();
  const start = fromLocal(fromKey, 0, tz);
  const end = fromLocal(addDaysToKey(toKey, 1), 0, tz);
  // Sin límite mensual: se puede planear todo el semestre (sólo un tope de un año por rendimiento).
  if (end.getTime() - start.getTime() > 1000 * 60 * 60 * 24 * 367) throw badRequest("El rango máximo es de un año");
  return { start, end, tz };
}
