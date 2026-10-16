import { NextResponse } from "next/server";
import { requireAdmin, route } from "@/lib/api";
import { appUrl, emailConfigured, emailFrom, layout, sendEmails } from "@/lib/email";

/** Estado de la configuración de correo (para el panel del admin). */
export const GET = route(async () => {
  await requireAdmin();
  return NextResponse.json({ configured: emailConfigured(), from: emailFrom(), appUrl: appUrl() });
});

/** Envía un correo de prueba al admin y devuelve el resultado exacto de Resend. */
export const POST = route(async () => {
  const admin = await requireAdmin();
  const { html, text } = layout({
    title: "Correo de prueba",
    body: `Si lees esto, Resend está bien configurado.\n\nLos enlaces de los correos apuntarán a ${appUrl()}.`,
    button: { label: "Abrir la plataforma", url: appUrl("/calendario") },
  });
  const result = await sendEmails([{ to: admin.email, subject: "Prueba de correo · Audio Ibero", html, text }]);
  return NextResponse.json({ ...result, to: admin.email, from: emailFrom(), appUrl: appUrl() });
});
