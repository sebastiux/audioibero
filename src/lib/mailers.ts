import "server-only";
import { appUrl, layout, sendEmails } from "./email";
import { issueToken } from "./tokens";

/** Invitación: el admin dio de alta a la persona; el enlace la lleva a definir su contraseña. */
export async function sendInvite(user: { id: string; name: string; email: string }) {
  const token = await issueToken(user.id, "INVITE");
  const url = appUrl(`/activar?token=${token}`);
  const { html, text } = layout({
    title: `¡Hola, ${user.name.split(" ")[0]}! Te damos la bienvenida al Club de Audio Ibero`,
    body:
      "Un admin del club te dio de alta en la plataforma donde registramos a qué hora vamos a estar en el lab, vemos quién coincide y llevamos los proyectos.\n\n" +
      "Para empezar, define tu contraseña con el siguiente enlace (vale por 7 días).",
    button: { label: "Activar mi cuenta", url },
  });
  const result = await sendEmails([{ to: user.email, subject: "Activa tu cuenta del Club de Audio Ibero", html, text }]);
  return { ...result, url };
}

/** Recuperar contraseña. */
export async function sendPasswordReset(user: { id: string; name: string; email: string }) {
  const token = await issueToken(user.id, "RESET");
  const url = appUrl(`/activar?token=${token}`);
  const { html, text } = layout({
    title: "Restablece tu contraseña",
    body: `Hola, ${user.name.split(" ")[0]}. Recibimos una solicitud para cambiar tu contraseña.\n\nEl enlace vale por 2 horas. Si no fuiste tú, ignora este correo.`,
    button: { label: "Crear nueva contraseña", url },
  });
  return sendEmails([{ to: user.email, subject: "Restablece tu contraseña · Audio Ibero", html, text }]);
}

/** Recordatorio de proyecto (o de todo el club) para cada destinatario. */
export async function sendReminder(
  reminder: { title: string; description: string | null; dueDate: Date | null; projectName: string | null },
  recipients: { email: string; name: string }[],
  opts: { today?: boolean } = {},
) {
  const when = reminder.dueDate
    ? reminder.dueDate.toLocaleDateString("es-MX", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
    : null;
  const scope = reminder.projectName ? `Proyecto ${reminder.projectName}` : "Todo el club";
  const subject = `${opts.today ? "Hoy: " : "📌 "}${reminder.title}${reminder.projectName ? ` · ${reminder.projectName}` : ""}`;
  const emails = recipients.map((r) => {
    const { html, text } = layout({
      title: `📌 ${reminder.title}`,
      body: [
        `Hola, ${r.name.split(" ")[0]}.`,
        `${scope}${when ? ` · ${opts.today ? "es hoy" : `fecha: ${when}`}` : ""}`,
        reminder.description ?? "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      button: { label: "Ver en la plataforma", url: appUrl("/proyectos") },
      footer: "Recibes este correo porque eres integrante del Club de Audio Ibero.",
    });
    return { to: r.email, subject, html, text };
  });
  return sendEmails(emails);
}
