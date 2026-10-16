import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { HttpError, parseBody, route } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.passwordHash) {
    throw new HttpError(403, "Tu cuenta aún no está activada: abre el enlace del correo de invitación");
  }
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, "Correo o contraseña incorrectos");
  }
  if (!user.active) throw new HttpError(403, "Tu cuenta está desactivada; habla con un admin");
  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  return NextResponse.json({ ok: true });
});
