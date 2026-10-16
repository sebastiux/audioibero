import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notFound, requireAdmin, route, type IdParams } from "@/lib/api";
import { sendInvite, sendPasswordReset } from "@/lib/mailers";

/** Reenviar invitación (si no ha activado su cuenta) o enviar enlace para cambiar contraseña. */
export const POST = route<IdParams>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, passwordHash: true } });
  if (!user) throw notFound("El usuario no existe");
  if (user.passwordHash) {
    const mail = await sendPasswordReset(user);
    return NextResponse.json({ kind: "reset", emailSent: mail.sent > 0, emailConfigured: mail.configured });
  }
  await prisma.user.update({ where: { id }, data: { invitedAt: new Date() } });
  const mail = await sendInvite(user);
  return NextResponse.json({ kind: "invite", emailSent: mail.sent > 0, link: mail.sent > 0 ? undefined : mail.url, emailConfigured: mail.configured });
});
