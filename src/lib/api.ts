import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getCurrentUser, type CurrentUser } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const forbidden = (msg = "No tienes permiso para esta acción") => new HttpError(403, msg);
export const notFound = (msg = "No encontrado") => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Inicia sesión para continuar");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw forbidden("Sólo un admin puede hacer esto");
  return user;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("El cuerpo de la petición no es JSON válido");
  }
  return schema.parse(raw);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Envuelve un route handler: traduce errores de validación/HTTP a respuestas JSON. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const where = first?.path.length ? `${first.path.join(".")}: ` : "";
        return NextResponse.json({ error: `${where}${first?.message ?? "Datos inválidos"}` }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
  };
}

export type IdParams = { params: Promise<{ id: string }> };
