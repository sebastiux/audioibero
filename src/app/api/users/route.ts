import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { conflict, parseBody, requireAdmin, requireUser, route } from "@/lib/api";
import { sendInvite } from "@/lib/mailers";
import { userCreateSchema } from "@/lib/validation";

const publicFields = { id: true, name: true, role: true, active: true, createdAt: true } as const;

/** Lista de miembros (el correo sólo lo ve un admin). */
export const GET = route(async () => {
  const me = await requireUser();
  const users = await prisma.user.findMany({
    select: { ...publicFields, email: me.role === "ADMIN" },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ users });
});

/**
 * Alta de miembro (sólo admin): se crea sin contraseña y se le envía un correo con el enlace
 * para activar su cuenta. Si el correo no está configurado, se devuelve el enlace para compartirlo.
 */
export const POST = route(async (req) => {
  await requireAdmin();
  const data = await parseBody(req, userCreateSchema);
  const exists = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (exists) throw conflict("Ya existe una cuenta con ese correo");
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, role: data.role, invitedAt: new Date() },
    select: { ...publicFields, email: true },
  });
  const mail = await sendInvite(user);
  return NextResponse.json(
    {
      user,
      emailSent: mail.sent > 0,
      link: mail.sent > 0 ? undefined : mail.url,
      emailConfigured: mail.configured,
      emailError: mail.error,
    },
    { status: 201 },
  );
});
