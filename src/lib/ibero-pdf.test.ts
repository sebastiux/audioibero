import { describe, expect, it } from "vitest";
import { looksLikeMateriasInscritas, parseMateriasInscritas } from "./ibero-pdf";

// Texto con la misma forma que extrae el PDF real de "Materias inscritas" (datos ficticios).
const TEXT = `:. SERVICIOS EN LÍNEA >> SERVICIOS ESCOLARES >> MATERIAS INSCRITAS
Información al 14 de Octubre de 2026.
Cuenta: 000000 - 0
Nombre: ALUMNA DE PRUEBA
Relación de Materias Inscritas
Clave Gpo Modalidad Materia Crd Hrs Duración Tipo Idioma
Salón Día Horario
24764 - Materia impartida en inglés, para estudiantes que dominan el idioma
24764 E Presencial PUEBLOS INDÍGENAS Y DIVERSIDAD CULTURAL - (MATERIA
IMPARTIDA EN INGLÉS) 8 4 Ago 10 a Dic
05
CON
HORARIO INGLES
D170 MARTES 16 a las 18 hrs.
D170 JUEVES 16 a las 18 hrs.
----------------------------------------------------------------------------------------------------------------------------
80041 A Presencial INTEGRACIÓN MECATRÓNICA Y LAB. 10 6 Ago 10 a Dic
05
CON
HORARIO ESPAÑOL
AF114-1 LUNES 13 a las 15 hrs.
Pág. 1 de 3
AF114-1 MIERCOLES 13 a las 15 hrs.
----------------------------------------------------------------------------------------------------------------------------
90001 B Presencial TALLER DE INVIERNO 4 2 Dic 01 a Ene
20
CON
HORARIO ESPAÑOL
X1 SABADO 9:30 a las 11 hrs.
Materia Agosto Septiembre Octubre Noviembre Diciembre
24764 - E
HORARIO DEL ALUMNO [000000-0]
Lunes Martes Miércoles Jueves Viernes Sábado
9-10 80441-A`;

describe("parseMateriasInscritas", () => {
  it("reconoce el documento", () => {
    expect(looksLikeMateriasInscritas(TEXT)).toBe(true);
    expect(looksLikeMateriasInscritas("Constancia de estudios")).toBe(false);
  });

  it("extrae materias, salón, día, horario y vigencia (incluso cruzando de página)", () => {
    const rows = parseMateriasInscritas(TEXT).map((c) => [c.code, c.weekday, c.startMinute, c.endMinute, c.room, c.startsOn, c.endsOn]);
    expect(rows).toEqual([
      ["24764", 2, 960, 1080, "D170", "2026-08-10", "2026-12-05"],
      ["24764", 4, 960, 1080, "D170", "2026-08-10", "2026-12-05"],
      ["80041", 1, 780, 900, "AF114-1", "2026-08-10", "2026-12-05"],
      ["80041", 3, 780, 900, "AF114-1", "2026-08-10", "2026-12-05"],
      ["90001", 6, 570, 660, "X1", "2026-12-01", "2027-01-20"],
    ]);
  });

  it("limpia el nombre de la materia", () => {
    const [first] = parseMateriasInscritas(TEXT);
    expect(first.name).toBe("PUEBLOS INDÍGENAS Y DIVERSIDAD CULTURAL - (MATERIA IMPARTIDA EN INGLÉS)");
  });
});
