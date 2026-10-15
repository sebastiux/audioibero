import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { conflict, parseBody, requireAdmin, requireUser, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
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

/** Admin da de alta a un miembro con contraseña temporal (útil si el registro está cerrado). */
export const POST = route(async (req) => {
  await requireAdmin();
  const data = await parseBody(req, userCreateSchema);
  const exists = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (exists) throw conflict("Ya existe una cuenta con ese correo");
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, role: data.role, passwordHash: await hashPassword(data.password) },
    select: { ...publicFields, email: true },
  });
  return NextResponse.json({ user }, { status: 201 });
});
