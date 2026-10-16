import "server-only";
import { prisma } from "./db";
import { sendReminder } from "./mailers";
import { appTimeZone, toLocalParts } from "./time";

/** Destinatarios: integrantes activos del proyecto (o todo el club) que ya activaron su cuenta. */
async function recipients(projectId: string | null) {
  return prisma.user.findMany({
    where: {
      active: true,
      passwordHash: { not: null },
      ...(projectId ? { projectMemberships: { some: { projectId } } } : {}),
    },
    select: { email: true, name: true },
  });
}

/** Envía un recordatorio por correo y registra cuándo se envió. */
export async function emailReminder(missionId: string, opts: { today?: boolean } = {}) {
  const m = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
    include: { project: { select: { name: true } } },
  });
  const to = await recipients(m.projectId);
  const result = await sendReminder(
    { title: m.title, description: m.description, dueDate: m.dueDate, projectName: m.project?.name ?? null },
    to,
    opts,
  );
  if (result.sent > 0) {
    await prisma.mission.update({
      where: { id: m.id },
      data: opts.today ? { dueNotifiedAt: new Date() } : { emailedAt: new Date() },
    });
  }
  return { ...result, recipients: to.length };
}

/** Aviso automático: recordatorios activos cuya fecha es hoy y que aún no se avisaron hoy. */
export async function emailDueToday() {
  const todayKey = toLocalParts(new Date(), appTimeZone()).dateKey;
  const day = new Date(`${todayKey}T00:00:00Z`);
  const due = await prisma.mission.findMany({
    where: {
      type: "REMINDER",
      active: true,
      dueDate: day,
      dueNotifiedAt: null,
      OR: [{ projectId: null }, { project: { active: true } }],
    },
    select: { id: true },
  });
  let sent = 0;
  for (const m of due) sent += (await emailReminder(m.id, { today: true })).sent;
  return { reminders: due.length, emails: sent };
}
