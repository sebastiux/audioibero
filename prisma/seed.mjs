// Crea la configuración del lab y el admin inicial (idempotente; se corre en cada deploy).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.labSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("[seed] ADMIN_EMAIL/ADMIN_PASSWORD no definidos: no se crea admin inicial");
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // No sobrescribimos la contraseña: sólo garantizamos que siga siendo admin y activo.
    await prisma.user.update({ where: { email }, data: { role: "ADMIN", active: true } });
    console.log(`[seed] admin ${email} ya existe`);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      name: process.env.ADMIN_NAME?.trim() || "Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  console.log(`[seed] admin ${email} creado`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
