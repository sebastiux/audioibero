// Verifica las variables de entorno antes de migrar, con mensajes claros (sin imprimir secretos).
const problems = [];
const url = process.env.DATABASE_URL;

if (!url || !url.trim()) {
  problems.push(
    "DATABASE_URL está vacía. En el servicio de la app usa Variables → New Variable → Add Reference → <tu servicio Postgres> → DATABASE_URL. " +
      "Si escribiste ${{Postgres.DATABASE_URL}}, revisa que 'Postgres' sea exactamente el nombre del servicio de la base.",
  );
} else if (/^["']/.test(url)) {
  problems.push("DATABASE_URL empieza con comillas. En el formulario de Railway escribe el valor sin comillas.");
} else if (url.includes("${{")) {
  problems.push("DATABASE_URL contiene una referencia sin resolver (${{...}}). Revisa el nombre del servicio en la referencia.");
} else if (!/^postgres(ql)?:\/\//.test(url)) {
  problems.push(`DATABASE_URL debe empezar con postgresql:// (empieza con "${url.slice(0, 12)}…").`);
}

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  problems.push("AUTH_SECRET falta o tiene menos de 32 caracteres.");
}

// El correo es opcional para arrancar, pero sin él no llegan invitaciones ni recordatorios.
if (!process.env.RESEND_API_KEY) {
  console.warn("[check-env] Aviso: falta RESEND_API_KEY; no se enviarán invitaciones ni recordatorios por correo.");
}
if (!process.env.APP_URL && !process.env.RAILWAY_PUBLIC_DOMAIN) {
  console.warn("[check-env] Aviso: falta APP_URL; los enlaces de los correos podrían apuntar a localhost.");
}

if (problems.length) {
  console.error("\n[check-env] Configuración inválida:\n" + problems.map((p) => `  - ${p}`).join("\n") + "\n");
  process.exit(1);
}
console.log("[check-env] Variables de entorno OK");
