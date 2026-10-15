# Club de Audio Ibero · Organizador del lab

Plataforma para organizar el laboratorio y los proyectos del Club de Audio Ibero. Todos los miembros están disponibles por defecto: el centro es un **calendario de reservas** donde cada quien registra las horas a las que va a ir al lab, y donde se forman grupos simultáneos. En una sesión de proyecto, los demás integrantes se unen al mismo horario con un clic. Los admins asignan horarios, dan de alta proyectos y generan un **calendario recomendado**.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Prisma + PostgreSQL · Tailwind CSS 4 · FullCalendar · sesiones JWT (jose) en cookie httpOnly · Zod · Vitest.

## Perfiles

| Acción | Miembro | Admin |
| --- | :---: | :---: |
| Ver el calendario del club (quién va, cuándo y si el lab está lleno) | ✅ | ✅ |
| Reservar horas en el lab o abrir una sesión de proyecto | ✅ | ✅ (para cualquiera) |
| Unirse a una reserva existente / salirse | ✅ | ✅ |
| Mover o editar sus reservas (formulario o arrastrando) | ✅ (las que creó) | ✅ (cualquiera) |
| Eliminar reservas completas | — | ✅ |
| Asignar horarios a miembros y cambiar participantes | — | ✅ |
| Dar de alta, editar y archivar proyectos y sus integrantes | — | ✅ |
| Generar y aplicar el calendario recomendado | — | ✅ |
| Gestionar miembros (alta, perfil, desactivar), ver horas por semana y reglas del lab | — | ✅ |

Reglas: nadie puede estar en dos reservas que se crucen; la suma de personas en el lab nunca pasa el cupo (el admin puede forzarlo); a las sesiones de un proyecto sólo se unen sus integrantes. Si el último participante se sale, la reserva desaparece.

## Calendario recomendado

En `/admin/recomendado` el admin elige un periodo y la app propone **sesiones de equipo** para cada proyecto activo (por defecto 4 h a la semana en bloques de 2 h). Busca horarios en los que los integrantes no tengan otras reservas (si no caben todos, al menos la mitad del equipo), repartidos en días distintos y en las horas menos ocupadas del lab, respetando cupo, horario, días de apertura y el tope semanal por persona. Las sesiones de proyecto que ya existan cuentan para la meta. Se pueden quitar sesiones de la propuesta antes de aplicarla; al aplicar puede reemplazar las recomendadas anteriores del periodo (las manuales nunca se tocan). Las reglas se ajustan en `/admin/miembros`.

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
prisma/schema.prisma        Modelos: User, Project, ProjectMember, Booking, BookingParticipant, LabSettings
src/lib/scheduler.ts        Algoritmo del calendario recomendado
src/lib/rules.ts            Reglas de negocio (validación de horarios, choques, cupo)
src/app/api/**              API REST (route handlers) con control de permisos por perfil
src/app/(app)/**            Páginas: calendario, proyectos, admin
src/components/**           UI (calendario, formularios, paneles admin)
src/middleware.ts           Redirección a /login sin sesión
```

## Seek & Bellman (práctica de Aprendizaje Reforzado)

La carpeta [`wumpus-metallica/`](./wumpus-metallica) contiene un proyecto independiente (Vite + React) que no forma parte de la app del club: el Mundo del Wumpus con temática de Metallica resuelto con la Ecuación de Optimalidad de Bellman. Se publica en GitHub Pages con `.github/workflows/wumpus-pages.yml`. Ver su [README](./wumpus-metallica/README.md) y los [resultados paso a paso](./wumpus-metallica/RESULTADOS.md).
