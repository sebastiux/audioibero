import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { conflict, forbidden, parseBody, route } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const data = await parseBody(req, registerSchema);
  const invite = process.env.INVITE_CODE?.trim();
  if (!invite) throw forbidden("El registro está cerrado; pide a un admin que te dé de alta");
  if (data.inviteCode !== invite) throw forbidden("Código de invitación incorrecto");

  const exists = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (exists) throw conflict("Ya existe una cuenta con ese correo");

  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash: await hashPassword(data.password) },
  });
  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  return NextResponse.json({ ok: true }, { status: 201 });
});
