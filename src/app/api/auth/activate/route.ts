import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, parseBody, route } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { consumeToken, findValidToken } from "@/lib/tokens";
import { activateSchema } from "@/lib/validation";

/** Define la contraseña desde el enlace del correo (invitación o recuperación) y entra a la app. */
export const POST = route(async (req) => {
  const { token, password } = await parseBody(req, activateSchema);
  const row = await findValidToken(token);
  if (!row) throw new HttpError(400, "El enlace ya no es válido o venció. Pide a un admin que te envíe uno nuevo.");
  const user = await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash: await hashPassword(password), activatedAt: new Date() },
  });
  await consumeToken(row.id);
  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  return NextResponse.json({ ok: true });
});
