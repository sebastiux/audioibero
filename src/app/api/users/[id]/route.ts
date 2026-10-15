import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, notFound, parseBody, requireAdmin, route, type IdParams } from "@/lib/api";
import { userUpdateSchema } from "@/lib/validation";

/** Admin cambia el perfil (miembro/admin) o desactiva una cuenta. */
export const PATCH = route<IdParams>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const data = await parseBody(req, userUpdateSchema);
  if (id === admin.id && (data.role === "MEMBER" || data.active === false)) {
    throw badRequest("No puedes quitarte el perfil de admin ni desactivar tu propia cuenta");
  }
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound("El usuario no existe");
  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json({ user });
});
