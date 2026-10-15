/**
 * Lector del PDF "Materias inscritas" de Servicios en Línea Ibero (Servicios escolares).
 * Del documento sólo se conservan las materias y su horario; nombre, cuenta, adeudos, etc. se descartan.
 */

export type IberoClass = {
  code: string;
  group: string;
  name: string;
  room: string;
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  startMinute: number;
  endMinute: number;
  /** Vigencia de la materia (YYYY-MM-DD) */
  startsOn: string;
  endsOn: string;
};

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};
const DAYS: Record<string, number> = {
  DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6,
};

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const pad = (n: number) => String(n).padStart(2, "0");

const HEADER = /^(\d{5})\s+([A-Z0-9]{1,3})\s+(Presencial|En l[ií]nea|H[ií]brid[ao]|Virtual|Mixta|[A-ZÁÉÍÓÚa-záéíóú]+)\s+(.*)$/;
const DURATION = /\s(\d+)\s+(\d+)\s+(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+(\d{1,2})\s+a\s+(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s*(\d{1,2})/i;
const SESSION =
  /(\S+)\s+(LUNES|MARTES|MI[EÉ]RCOLES|JUEVES|VIERNES|S[AÁ]BADO|DOMINGO)\s+(\d{1,2})(?:[:.](\d{2}))?\s+a\s+las\s+(\d{1,2})(?:[:.](\d{2}))?\s*hrs/gi;

export function looksLikeMateriasInscritas(text: string) {
  return /MATERIAS\s+INSCRITAS/i.test(text);
}

export function parseMateriasInscritas(text: string): IberoClass[] {
  const year =
    Number(text.match(/Informaci[oó]n al\s+\d{1,2}\s+de\s+\S+\s+de\s+(\d{4})/i)?.[1]) ||
    Number(text.match(/(?:OTO[ÑN]O|PRIMAVERA|VERANO|INVIERNO)\s+(\d{4})/i)?.[1]) ||
    new Date().getFullYear();

  // Agrupa líneas por materia: desde su encabezado ("80020 A Presencial ...") hasta el siguiente.
  const blocks: { header: RegExpMatchArray; lines: string[] }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const header = line.match(HEADER);
    if (header) {
      blocks.push({ header, lines: [header[4]] });
    } else if (blocks.length && !/^-{5,}$/.test(line) && !/^P[aá]g\.\s*\d/i.test(line)) {
      blocks[blocks.length - 1].lines.push(line);
    }
  }

  const out: IberoClass[] = [];
  for (const { header, lines } of blocks) {
    const body = ` ${lines.join(" ")}`;
    const duration = body.match(DURATION);
    let startsOn = `${year}-01-01`;
    let endsOn = `${year}-12-31`;
    let name = body;
    if (duration) {
      name = body.slice(0, duration.index);
      const m1 = MONTHS[duration[3].toLowerCase()];
      const m2 = MONTHS[duration[5].toLowerCase()];
      startsOn = `${year}-${pad(m1)}-${pad(Number(duration[4]))}`;
      endsOn = `${m2 < m1 ? year + 1 : year}-${pad(m2)}-${pad(Number(duration[6]))}`;
    }
    name = name.replace(/\s+/g, " ").trim();

    for (const s of body.matchAll(SESSION)) {
      const weekday = DAYS[strip(s[2]).toUpperCase()];
      const startMinute = Number(s[3]) * 60 + Number(s[4] ?? 0);
      const endMinute = Number(s[5]) * 60 + Number(s[6] ?? 0);
      if (weekday === undefined || endMinute <= startMinute) continue;
      out.push({ code: header[1], group: header[2], name, room: s[1], weekday, startMinute, endMinute, startsOn, endsOn });
    }
  }
  return out;
}
