import { prisma } from "@/lib/db";
import { requireUser, route } from "@/lib/api";
import { missionOccurrences } from "@/lib/busy";
import { appTimeZone } from "@/lib/time";

const DAY = 24 * 60 * 60 * 1000;

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Plegado de líneas a 75 octetos (RFC 5545). */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
    }
    current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Descarga .ics con mis reservas y las sesiones generales (de hace 30 días a 6 meses adelante). */
export const GET = route(async () => {
  const me = await requireUser();
  const now = Date.now();
  const from = new Date(now - 30 * DAY);
  const to = new Date(now + 182 * DAY);

  const [bookings, missions] = await Promise.all([
    prisma.booking.findMany({
      where: { start: { lt: to }, end: { gt: from }, participants: { some: { userId: me.id } } },
      include: { project: { select: { name: true } }, participants: { select: { user: { select: { name: true } } } } },
      orderBy: { start: "asc" },
    }),
    missionOccurrences(from, to, appTimeZone()),
  ]);

  const stamp = icsDate(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Club de Audio Ibero//Lab//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Audio Ibero"];
  for (const b of bookings) {
    const what = b.kind === "ASYNC" ? "Trabajo asíncrono" : b.kind === "PROJECT" ? "Sesión de proyecto" : "Lab";
    const summary = b.project ? `${what}: ${b.project.name}` : `${what} · Audio Ibero`;
    const who = b.participants.map((p) => p.user.name).join(", ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@audioibero`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(b.start)}`,
      `DTEND:${icsDate(b.end)}`,
      `SUMMARY:${escape(summary)}`,
      `DESCRIPTION:${escape(`${b.notes ? `${b.notes}\n` : ""}Participantes: ${who}`)}`,
      ...(b.kind === "ASYNC" ? [] : ["LOCATION:Laboratorio de audio · Ibero"]),
      "END:VEVENT",
    );
  }
  for (const m of missions) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${m.missionId}-${m.start.getTime()}@audioibero`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(m.start)}`,
      `DTEND:${icsDate(m.end)}`,
      `SUMMARY:${escape(`Misión general: ${m.title}`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audio-ibero.ics"',
      "Cache-Control": "no-store",
    },
  });
});
