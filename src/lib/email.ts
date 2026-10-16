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
/** `error` trae el motivo que dio Resend (en español cuando lo reconocemos) para mostrarlo al admin. */
export type SendResult = { sent: number; failed: number; configured: boolean; error?: string };

export const emailFrom = () => process.env.EMAIL_FROM || "Audio Ibero <onboarding@resend.dev>";

/** Traduce los errores más comunes de Resend a una explicación accionable. */
export function explainResendError(message: string, from: string) {
  const m = message.toLowerCase();
  if (m.includes("only send testing emails") || m.includes("verify a domain")) {
    return `Resend sólo permite enviar a tu propio correo hasta que verifiques un dominio. Verifica tu dominio en resend.com/domains y usa un remitente de ese dominio en EMAIL_FROM (ahora: ${from}). Detalle: ${message}`;
  }
  if (m.includes("domain is not verified") || m.includes("not verified")) {
    return `El dominio del remitente (${from}) no está verificado en Resend. Verifícalo en resend.com/domains o cambia EMAIL_FROM. Detalle: ${message}`;
  }
  if (m.includes("api key is invalid") || m.includes("invalid api key") || m.includes("missing api key")) {
    return `La RESEND_API_KEY no es válida. Genera una nueva en resend.com/api-keys. Detalle: ${message}`;
  }
  if (m.includes("invalid `from`") || m.includes("from field")) {
    return `EMAIL_FROM tiene un formato inválido (${from}). Usa algo como: Audio Ibero <lab@tudominio.mx>. Detalle: ${message}`;
  }
  return message;
}

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
  const from = emailFrom();
  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    try {
      const { error } = await r.batch.send(chunk.map((e) => ({ from, to: [e.to], subject: e.subject, html: e.html, text: e.text })));
      if (error) {
        console.error("[email] Resend:", error);
        lastError = explainResendError(error.message ?? String(error), from);
        failed += chunk.length;
      } else sent += chunk.length;
    } catch (err) {
      console.error("[email] Resend:", err);
      lastError = explainResendError((err as Error).message ?? String(err), from);
      failed += chunk.length;
    }
  }
  return { sent, failed, configured: true, error: lastError };
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
