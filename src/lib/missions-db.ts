import type { z } from "zod";
import type { missionSchema } from "./validation";

/** Limpia los campos que no aplican al tipo de misión. */
export function normalizeMission(data: z.infer<typeof missionSchema>) {
  const recurring = data.type === "RECURRING";
  return {
    title: data.title,
    description: data.description || null,
    type: data.type,
    pinned: data.pinned,
    active: data.active,
    kind: data.kind,
    dueDate: recurring ? null : (data.dueDate ?? null),
    weekdays: recurring ? [...new Set(data.weekdays)].sort() : [],
    startMinute: recurring ? (data.startMinute ?? null) : null,
    endMinute: recurring ? (data.endMinute ?? null) : null,
    startsOn: recurring ? (data.startsOn ?? null) : null,
    endsOn: recurring ? (data.endsOn ?? null) : null,
  };
}
