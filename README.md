# Club de Audio Ibero · Organizador del lab

Plataforma para organizar el laboratorio y los proyectos del Club de Audio Ibero. No es un sistema de reservas: todos pueden ir cuando quieran. El centro es un **calendario compartido** donde cada quien registra a qué hora va a estar, para tener un orden y **ver quién del equipo coincide**. En una sesión de proyecto, los demás integrantes se suman al mismo horario con un clic. Los admins asignan horarios, dan de alta proyectos y generan un **calendario recomendado**.

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
| Generar y aplicar el calendario recomendado | — | ✅ |
| Gestionar miembros (alta, perfil, desactivar), ver horas por semana y horario del lab | — | ✅ |

Tipos de horario: **Lab** (trabajo en el laboratorio), **Sesión de proyecto** (en el lab, el equipo se une) y **Asíncrono** (trabajo fuera del lab, con o sin proyecto).

Coincidencias: arriba del calendario se ve quién está **ahora** en el lab y, para cada horario tuyo, **quién coincide contigo y en qué tramo** (la gente de tus proyectos resaltada); el filtro "Mi equipo" muestra sólo a tus compañeros de proyecto.

Reglas: el lab no tiene cupo ni hay tope de horas por persona; nadie puede registrar dos horarios que se crucen; a las sesiones de un proyecto sólo se suman sus integrantes. Si el último participante se quita, el horario desaparece.

## Mi plan (calendario Ibero)

En `/mi-plan` cada miembro sube el PDF de **Materias inscritas** (Servicios en Línea → Servicios escolares → Materias inscritas → Guardar como PDF); también acepta un calendario .ics. Del PDF sólo se guardan materia, salón, día, horario y vigencia; nombre, cuenta y adeudos se descartan y el archivo no se almacena. Elige cuántas horas a la semana quiere, el periodo (sin límite: una semana, un mes o todo el semestre), la duración de los bloques y el tipo (lab, proyecto o asíncrono), y la app propone bloques que no chocan con sus clases, sus reservas ni las sesiones fijas de sus proyectos: uno por día, de preferencia **cuando también va a estar gente de sus proyectos** (se marca en morado en la vista previa), en días que ya va a la Ibero y pegados a sus clases. Los bloques se pueden arrastrar, estirar, quitar o agregar antes de guardarlos. El horario Ibero guardado también lo usa el calendario recomendado del admin.

## Proyectos: sesiones fijas y recordatorios

En `/proyectos`, además de los integrantes, el admin define para cada proyecto **sesiones fijas** (días de la semana, horario y vigencia; en el lab o remotas) y **recordatorios** (con fecha opcional; los fijados aparecen arriba del calendario de los integrantes). También hay una tarjeta "Todo el club" para lo que aplica a todos. Las sesiones fijas aparecen en el calendario con el color del proyecto, en el .ics exportado, se respetan al proponer horarios y cuentan para la meta semanal del calendario recomendado.

## Calendario recomendado

En `/admin/recomendado` el admin elige un periodo y la app propone **sesiones de equipo** para cada proyecto activo (por defecto 4 h a la semana en bloques de 2 h). El periodo puede ser tan largo como se quiera (p. ej. todo el semestre). Busca horarios en los que los integrantes no tengan otras reservas (si no caben todos, al menos la mitad del equipo), repartidos en días distintos y en las horas menos concurridas, dentro del horario y días de apertura. Las sesiones fijas y las sesiones de proyecto que ya existan cuentan para la meta. Las sesiones propuestas se pueden arrastrar y estirar para ajustar sus horas, o quitar, antes de aplicarlas; también evita las clases Ibero de los integrantes; al aplicar puede reemplazar las recomendadas anteriores del periodo (las manuales nunca se tocan). Las reglas se ajustan en `/admin/miembros`.

El algoritmo vive en `src/lib/scheduler.ts` (función pura con pruebas en `scheduler.test.ts`).

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
   - `INVITE_CODE` → código para que los miembros se registren (vacío = registro cerrado; el admin puede dar de alta desde el panel)
   - `APP_TIMEZONE` → `America/Mexico_City`
4. Genera un dominio público en *Settings → Networking*.

El seed es idempotente: si el admin ya existe no cambia su contraseña. Para restablecerla, define `ADMIN_RESET_PASSWORD=true`, haz deploy, inicia sesión y luego borra esa variable.

## Estructura

```
prisma/schema.prisma        Modelos: User, Project, ProjectMember, Booking, BookingParticipant, Mission, LabSettings
src/lib/scheduler.ts        Algoritmos: calendario recomendado y plan personal
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
