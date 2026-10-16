import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody, route } from "@/lib/api";
import { sendInvite, sendPasswordReset } from "@/lib/mailers";
import { forgotSchema } from "@/lib/validation";

/**
 * "¿Olvidaste tu contraseña?". Siempre responde lo mismo para no revelar qué correos existen.
 * Si la cuenta aún no se activó, reenvía la invitación.
 */
export const POST = route(async (req) => {
  const { email } = await parseBody(req, forgotSchema);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, active: true, passwordHash: true } });
  if (user?.active) {
    if (user.passwordHash) await sendPasswordReset(user);
    else await sendInvite(user);
  }
  return NextResponse.json({ ok: true });
});
