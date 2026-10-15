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
    // Por defecto no sobrescribimos la contraseña; con ADMIN_RESET_PASSWORD=true se restablece.
    const reset = process.env.ADMIN_RESET_PASSWORD === "true";
    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN", active: true, ...(reset ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    });
    console.log(
      reset
        ? `[seed] contraseña de ${email} restablecida; quita ADMIN_RESET_PASSWORD`
        : `[seed] admin ${email} ya existe (contraseña sin cambios; usa ADMIN_RESET_PASSWORD=true para restablecerla)`,
    );
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
