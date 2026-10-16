import "server-only";
import { Resend } from "resend";

/**
 * Envío de correos con Resend. Variables:
 *   RESEND_API_KEY  clave de Resend
 *   EMAIL_FROM      remitente verificado, p. ej. "Audio Ibero <lab@tudominio.mx>"
 *   APP_URL         URL pública de la app (para los enlaces), p. ej. https://audioibero.up.railway.app
 * Sin RESEND_API_KEY no se envía nada (se registra en consola) para poder desarrollar sin correo.
 */

export type Email = { to: string; subject: string; html: string; text: string };
export type SendResult = { sent: number; failed: number; configured: boolean };

let client: Resend | null = null;
function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export function appUrl(path = "") {
  const base = (process.env.APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN || "http://localhost:3000").replace(/\/$/, "");
  return `${base.startsWith("http") ? base : `https://${base}`}${path}`;
}

/** Envía uno o varios correos (en lotes de 100, un correo por destinatario). */
export async function sendEmails(emails: Email[]): Promise<SendResult> {
  if (emails.length === 0) return { sent: 0, failed: 0, configured: emailConfigured() };
  const r = resend();
  if (!r) {
    for (const e of emails) console.info(`[email] (sin RESEND_API_KEY) para ${e.to}: ${e.subject}`);
    return { sent: 0, failed: emails.length, configured: false };
  }
  const from = process.env.EMAIL_FROM || "Audio Ibero <onboarding@resend.dev>";
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    try {
      const { error } = await r.batch.send(chunk.map((e) => ({ from, to: [e.to], subject: e.subject, html: e.html, text: e.text })));
      if (error) {
        console.error("[email] Resend:", error);
        failed += chunk.length;
      } else sent += chunk.length;
    } catch (err) {
      console.error("[email] Resend:", err);
      failed += chunk.length;
    }
  }
  return { sent, failed, configured: true };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plantilla sencilla con la marca del club. `body` es texto plano (se respetan saltos de línea). */
export function layout(opts: { title: string; body: string; button?: { label: string; url: string }; footer?: string }) {
  const paragraphs = escapeHtml(opts.body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.5">${p.replace(/\n/g, "<br>")}</p>`).join("");
  const button = opts.button
    ? `<p style="margin:22px 0"><a href="${opts.button.url}" style="background:#c8102e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(opts.button.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#71717a">Si el botón no funciona, copia este enlace: <br><a href="${opts.button.url}" style="color:#c8102e;word-break:break-all">${opts.button.url}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Inter,Segoe UI,Arial,sans-serif;color:#16161d">
  <div style="max-width:520px;margin:0 auto;padding:28px 16px">
    <div style="font-weight:700;font-size:18px;margin-bottom:16px">Audio <span style="color:#c8102e">Ibero</span></div>
    <div style="background:#fff;border:1px solid #e4e4e7;border-radius:14px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 14px">${escapeHtml(opts.title)}</h1>
      ${paragraphs}${button}
    </div>
    <p style="font-size:12px;color:#a1a1aa;margin-top:16px">${escapeHtml(opts.footer ?? "Club de Audio Ibero")}</p>
  </div></body></html>`;
  const text = `${opts.title}\n\n${opts.body}${opts.button ? `\n\n${opts.button.label}: ${opts.button.url}` : ""}`;
  return { html, text };
}
