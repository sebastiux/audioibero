# Club de Audio Ibero · Organizador del lab

Plataforma para organizar el laboratorio y los proyectos del Club de Audio Ibero. El centro es un **calendario** donde cada miembro marca cuándo está disponible para trabajar en el lab o en un proyecto de equipo. Los admins asignan días y generan un **calendario recomendado**.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Prisma + PostgreSQL · Tailwind CSS 4 · FullCalendar · sesiones JWT (jose) en cookie httpOnly · Zod · Vitest.

## Perfiles

| Acción | Miembro | Admin |
| --- | :---: | :---: |
| Ver el calendario del club (espacios libres y asignaciones) | ✅ | ✅ |
| Crear espacios libres propios (lab o proyecto) | ✅ | ✅ (para cualquiera) |
| Modificar sus espacios libres (formulario o arrastrando) | ✅ | ✅ (cualquiera) |
| Eliminar espacios libres | — | ✅ |
| Asignar días/horarios a miembros (manual o desde un espacio libre) | — | ✅ |
| Dar de alta, editar y archivar proyectos y sus integrantes | — | ✅ |
| Generar y aplicar el calendario recomendado | — | ✅ |
| Gestionar miembros (alta, perfil, desactivar) y las reglas del lab | — | ✅ |

Los miembros sólo pueden marcar disponibilidad de **proyecto** en los proyectos a los que pertenecen.

## Calendario recomendado

En `/admin/recomendado` el admin elige un periodo y la app arma una propuesta, que puede revisar (y quitar horarios) antes de aplicarla:

1. **Sesiones de equipo:** por cada proyecto activo busca ventanas en las que coinciden suficientes integrantes (al menos 2, o la mitad del equipo) y los agenda juntos.
2. **Uso libre del lab:** reparte los espacios libres tipo “lab” dando prioridad a quien lleva menos horas esa semana.

Siempre respeta el cupo simultáneo del lab, el horario y los días de apertura, la duración mínima de sesión, el tope semanal por persona y las asignaciones manuales existentes. Al aplicar puede reemplazar las asignaciones recomendadas anteriores del mismo periodo (las manuales nunca se tocan). Estas reglas se ajustan en `/admin/miembros`.

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

El seed es idempotente: si el admin ya existe no cambia su contraseña.

## Estructura

```
prisma/schema.prisma        Modelos: User, Project, ProjectMember, Availability, Assignment, LabSettings
src/lib/scheduler.ts        Algoritmo del calendario recomendado
src/lib/rules.ts            Reglas de negocio (validación de horarios, choques, cupo)
src/app/api/**              API REST (route handlers) con control de permisos por perfil
src/app/(app)/**            Páginas: calendario, proyectos, admin
src/components/**           UI (calendario, formularios, paneles admin)
src/middleware.ts           Redirección a /login sin sesión
```
