import { z } from "zod";

export const dateTime = z.coerce.date({ error: "Fecha inválida" });
export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD");
export const slotKind = z.enum(["LAB", "PROJECT"]);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
  inviteCode: z.string().trim(),
});

const slotBase = {
  start: dateTime,
  end: dateTime,
  kind: slotKind.default("LAB"),
  projectId: z.string().min(1).nullish(),
  notes: z.string().trim().max(500).nullish(),
};

export const bookingCreateSchema = z.object({
  ...slotBase,
  /** Sólo admin: a quién(es) se asigna la reserva. Un miembro siempre reserva para sí mismo. */
  participantIds: z.array(z.string().min(1)).max(100).optional(),
});

export const bookingUpdateSchema = z
  .object(slotBase)
  .partial()
  .extend({ participantIds: z.array(z.string().min(1)).max(100).optional() });

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido");

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(120),
  description: z.string().trim().max(2000).nullish(),
  color: hexColor.default("#7c3aed"),
  startDate: dateTime.nullish(),
  endDate: dateTime.nullish(),
  memberIds: z.array(z.string().min(1)).default([]),
});

export const projectUpdateSchema = projectCreateSchema
  .omit({ memberIds: true })
  .partial()
  .extend({ active: z.boolean().optional(), memberIds: z.array(z.string().min(1)).optional() });

export const userUpdateSchema = z.object({
  role: z.enum(["MEMBER", "ADMIN"]).optional(),
  active: z.boolean().optional(),
});

export const settingsSchema = z
  .object({
    capacity: z.number().int().min(1).max(100),
    openMinute: z.number().int().min(0).max(1440),
    closeMinute: z.number().int().min(0).max(1440),
    openDays: z.array(z.number().int().min(0).max(6)).min(1, "Elige al menos un día"),
    slotMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
    maxWeeklyMinutes: z.number().int().min(30).max(10080),
    projectWeeklyMinutes: z.number().int().min(0).max(10080),
    projectSessionMinutes: z.number().int().min(30).max(720),
  })
  .refine((s) => s.closeMinute > s.openMinute, { message: "El cierre debe ser después de la apertura", path: ["closeMinute"] });

export const applySchema = z.object({
  from: dateKey,
  to: dateKey,
  replaceRecommended: z.boolean().default(true),
  proposals: z
    .array(
      z.object({
        projectId: z.string().min(1),
        start: dateTime,
        end: dateTime,
        participantIds: z.array(z.string().min(1)).min(1).max(100),
        reason: z.string().max(200).optional(),
      }),
    )
    .max(1000),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(8, "La contraseña temporal debe tener al menos 8 caracteres").max(200),
  role: z.enum(["MEMBER", "ADMIN"]).default("MEMBER"),
});
