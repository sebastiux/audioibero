# Club de Audio Ibero · Organizador del lab

Plataforma para organizar el laboratorio y los proyectos del Club de Audio Ibero. No es un sistema de reservas: todos pueden ir cuando quieran. El centro es un **calendario compartido** donde cada quien registra a qué hora va a estar, para tener un orden y **ver quién del equipo coincide**. En una sesión de proyecto, los demás integrantes se suman al mismo horario con un clic. Cada quien arma su horario con **Mi plan** a partir de su horario de clases; los admins dan de alta proyectos con sus sesiones fijas y recordatorios.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Prisma + PostgreSQL · Tailwind CSS 4 · FullCalendar · sesiones JWT (jose) en cookie httpOnly · Zod · Vitest.

## Perfiles

| Acción | Miembro | Admin |
| --- | :---: | :---: |
| Ver el calendario del club, quién está ahora en el lab y quién coincide con su horario | ✅ | ✅ |
| Registrar a qué hora va a estar (lab, sesión de proyecto o trabajo asíncrono) | ✅ | ✅ (para cualquiera) |
| **Mi plan**: subir su PDF de materias inscritas (o un .ics) y recibir una propuesta según las horas que elija | ✅ | ✅ |
| Exportar sus horarios y las sesiones fijas de sus proyectos a su calendario (.ics) | ✅ | ✅ |
| Ver las sesiones fijas y recordatorios de los proyectos | ✅ | ✅ |
| Definir sesiones fijas (semanales) y recordatorios por proyecto o para todo el club | — | ✅ |
| Sumarse al horario de alguien ("Yo también voy") / quitarse | ✅ | ✅ |
| Mover o editar sus horarios (formulario o arrastrando) | ✅ (los que registró) | ✅ (cualquiera) |
| Eliminar horarios completos | — | ✅ |
| Asignar horarios a miembros y cambiar participantes | — | ✅ |
| Dar de alta, editar y archivar proyectos y sus integrantes | — | ✅ |
| Dar de alta miembros (reciben un correo para activar su cuenta), cambiar perfil, desactivar, reenviar invitación | — | ✅ |
| Enviar recordatorios por correo (al guardarlos o con un botón; aviso automático el día de la fecha) | — | ✅ |

Tipos de horario: **Lab** (trabajo en el laboratorio), **Sesión de proyecto** (en el lab, el equipo se une) y **Asíncrono** (trabajo fuera del lab, con o sin proyecto).

Coincidencias: arriba del calendario se ve quién está **ahora** en el lab y, para cada horario tuyo, **quién coincide contigo y en qué tramo** (la gente de tus proyectos resaltada); el filtro "Mi equipo" muestra sólo a tus compañeros de proyecto.

Reglas: el lab no tiene cupo ni hay tope de horas por persona; nadie puede registrar dos horarios que se crucen; a las sesiones de un proyecto sólo se suman sus integrantes. Si el último participante se quita, el horario desaparece.

## Cuentas y correo (Resend)

No hay registro abierto: **sólo el admin da de alta** (Miembros y lab → "+ Alta" con nombre, correo y perfil). La persona recibe un correo con un enlace de un solo uso (7 días) para **definir su contraseña** y empieza a usar la app. Desde la tabla se puede reenviar la invitación o mandar un enlace para cambiar contraseña, y en el login está "¿Olvidaste tu contraseña?" (enlace de 2 horas). Los enlaces se guardan sólo como hash.

Los **recordatorios** de proyecto (o de todo el club) se envían por correo a los integrantes con cuenta activa: al guardarlos (casilla "Enviar por correo") o con el botón "📧 Enviar". Además, el día de su fecha se manda un aviso automático si se configura un cron diario que llame a `GET /api/cron/reminders` con `Authorization: Bearer $CRON_SECRET` (cada recordatorio se avisa una sola vez).

Sin `RESEND_API_KEY` la app funciona igual: al dar de alta muestra el enlace de activación para compartirlo a mano.

## Mi plan (calendario Ibero)

En `/mi-plan` cada miembro sube el PDF de **Materias inscritas** (Servicios en Línea → Servicios escolares → Materias inscritas → Guardar como PDF); también acepta un calendario .ics. Del PDF sólo se guardan materia, salón, día, horario y vigencia; nombre, cuenta y adeudos se descartan y el archivo no se almacena. Elige cuántas horas a la semana quiere, el periodo (sin límite: una semana, un mes o todo el semestre), la duración de los bloques y el tipo (lab, proyecto o asíncrono), y la app propone bloques que no chocan con sus clases, sus reservas ni las sesiones fijas de sus proyectos: uno por día, de preferencia **cuando también va a estar gente de sus proyectos** (se marca en morado en la vista previa), en días que ya va a la Ibero y pegados a sus clases. Los bloques se pueden arrastrar, estirar, quitar o agregar antes de guardarlos.

## Proyectos: sesiones fijas y recordatorios

En `/proyectos`, además de los integrantes, el admin define para cada proyecto **sesiones fijas** (días de la semana, horario y vigencia; en el lab o remotas) y **recordatorios** (con fecha opcional; los fijados aparecen arriba del calendario de los integrantes). También hay una tarjeta "Todo el club" para lo que aplica a todos. Las sesiones fijas aparecen en el calendario con el color del proyecto, en el .ics exportado y se respetan al proponer horarios en Mi plan.

El algoritmo de Mi plan vive en `src/lib/scheduler.ts` (función pura con pruebas en `scheduler.test.ts`).

## Desarrollo local

```bash
cp .env.example .env          # ajusta DATABASE_URL y AUTH_SECRET
npm install
npx prisma migrate dev        # crea las tablas
npm run db:seed               # crea el admin inicial (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run dev
```

Otros comandos: `npm test` (pruebas), `npm run lint` (typecheck), `npm run db:studio`.

## Despliegue en Railway

1. Crea un proyecto en Railway y agrega un servicio **PostgreSQL**.
2. Agrega un servicio desde este repositorio de GitHub. `railway.json` ya define el build (`npm run build`), el arranque (`npm run start:railway`, que aplica migraciones y el seed antes de iniciar) y el healthcheck (`/api/health`).
3. En las variables del servicio web define:
   - `DATABASE_URL` → referencia a la del Postgres: `${{Postgres.DATABASE_URL}}`
   - `AUTH_SECRET` → un secreto largo (`openssl rand -base64 48`)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` → admin inicial
   - `RESEND_API_KEY` → clave de [Resend](https://resend.com)
   - `EMAIL_FROM` → remitente de un dominio verificado en Resend, p. ej. `Audio Ibero <lab@tudominio.mx>`
   - `APP_URL` → URL pública de la app (para los enlaces de los correos)
   - `CRON_SECRET` → secreto para el aviso diario de recordatorios
   - `APP_TIMEZONE` → `America/Mexico_City`
4. Genera un dominio público en *Settings → Networking*.
5. Aviso diario de recordatorios: crea en Railway un servicio **Cron** (p. ej. `0 14 * * *`, 8:00 en CDMX) con el comando
   `curl -fsS -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/reminders`, o usa cualquier cron externo.

El seed es idempotente: si el admin ya existe no cambia su contraseña. Para restablecerla, define `ADMIN_RESET_PASSWORD=true`, haz deploy, inicia sesión y luego borra esa variable.

## Estructura

```
prisma/schema.prisma        Modelos: User, Project, ProjectMember, Booking, BookingParticipant, Mission, LabSettings
src/lib/scheduler.ts        Algoritmo de Mi plan (propuesta personal de horarios)
src/lib/ibero-pdf.ts        Lectura del PDF "Materias inscritas" de la Ibero
src/lib/ibero.ts            Lectura de calendarios .ics (clases recurrentes)
src/lib/missions.ts         Expansión de sesiones fijas (recurrentes) de proyectos
src/lib/rules.ts            Reglas de negocio (validación de horarios y choques)
src/app/api/**              API REST (route handlers) con control de permisos por perfil
src/app/(app)/**            Páginas: calendario, proyectos, admin
src/components/**           UI (calendario, formularios, paneles admin)
src/middleware.ts           Redirección a /login sin sesión
```

## Seek & Bellman (práctica de Aprendizaje Reforzado)

La carpeta [`wumpus-metallica/`](./wumpus-metallica) contiene un proyecto independiente (Vite + React) que no forma parte de la app del club: el Mundo del Wumpus con temática de Metallica resuelto con la Ecuación de Optimalidad de Bellman. Se publica en GitHub Pages con `.github/workflows/wumpus-pages.yml`. Ver su [README](./wumpus-metallica/README.md) y los [resultados paso a paso](./wumpus-metallica/RESULTADOS.md).
