"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { DatesSetArg, DateSelectArg, EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, formatHours, formatRange, minutesToHHMM } from "@/lib/client";
import Link from "next/link";
import type { BookingItem, LabConfig, Me, MissionItem, MissionOccurrenceItem, ProjectOption, UserOption } from "@/lib/types";
import { Modal } from "./Modal";
import { SlotForm, type SlotFormValue } from "./SlotForm";
import { findCoincidences, presentAt } from "@/lib/coincidences";

type Props = {
  me: Me;
  users: UserOption[];
  projects: ProjectOption[];
  lab: LabConfig;
  /** Recordatorios de proyectos (fijados o próximos) para mostrar arriba del calendario */
  reminders: (Pick<MissionItem, "id" | "title" | "dueDate" | "pinned"> & { projectName: string | null })[];
};

type Dialog =
  | { type: "create"; start: Date; end: Date }
  | { type: "booking"; id: string }
  | { type: "mission"; occurrence: MissionOccurrenceItem }
  | null;

const LAB_COLOR = "#c8102e";
const ASYNC_COLOR = "#0891b2";
const MISSION_COLOR = "#16161d";
const minutesOf = (b: { start: string; end: string }) => (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000;
const isIn = (b: BookingItem, userId: string) => b.participants.some((p) => p.userId === userId);

export function CalendarView({ me, users, projects, lab, reminders }: Props) {
  const isAdmin = me.role === "ADMIN";
  const calendarRef = useRef<FullCalendar>(null);
  const rangeRef = useRef<{ start: Date; end: Date } | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [missions, setMissions] = useState<MissionOccurrenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isMobile, setIsMobile] = useState(false);

  const [onlyMine, setOnlyMine] = useState(false);
  const [memberFilter, setMemberFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const myProjects = useMemo(() => projects.filter((p) => p.memberIds.includes(me.id)), [projects, me.id]);
  /** Personas con las que comparto al menos un proyecto. */
  const teammates = useMemo(
    () => new Set(myProjects.flatMap((p) => p.memberIds).filter((id) => id !== me.id)),
    [myProjects, me.id],
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    calendarRef.current?.getApi().changeView(isMobile ? "timeGridDay" : "timeGridWeek");
  }, [isMobile]);

  const load = useCallback(async () => {
    const range = rangeRef.current;
    if (!range) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from: range.start.toISOString(), to: range.end.toISOString() });
      const data = await api<{ bookings: BookingItem[]; missions: MissionOccurrenceItem[] }>(`/api/calendar?${qs}`);
      setBookings(data.bookings);
      setMissions(data.missions);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const onDatesSet = useCallback(
    (arg: DatesSetArg) => {
      rangeRef.current = { start: arg.start, end: arg.end };
      void load();
    },
    [load],
  );

  const visible = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (!onlyMine || isIn(b, me.id)) &&
          (memberFilter === "all" ||
            (memberFilter === "team" ? b.participants.some((x) => x.userId === me.id || teammates.has(x.userId)) : isIn(b, memberFilter))) &&
          (projectFilter === "all" ||
            (projectFilter === "lab" ? b.kind === "LAB" : projectFilter === "async" ? b.kind === "ASYNC" : b.projectId === projectFilter)),
      ),
    [bookings, onlyMine, memberFilter, projectFilter, me.id, teammates],
  );

  const events = useMemo<EventInput[]>(() => {
    const out: EventInput[] = visible.map((b) => {
      const mine = isIn(b, me.id);
      const names = b.participants.map((p) => (p.userId === me.id ? "Tú" : p.user.name.split(" ")[0]));
      const color = b.project?.color ?? (b.kind === "ASYNC" ? ASYNC_COLOR : LAB_COLOR);
      const people = `${b.participants.length} ${b.participants.length === 1 ? "persona" : "personas"} (${names.join(", ")})`;
      const title =
        b.kind === "ASYNC"
          ? `🌐 Asíncrono${b.project ? ` · ${b.project.name}` : ""} · ${names.join(", ")}`
          : b.kind === "PROJECT" && b.project
            ? `${b.project.name} · ${people}`
            : `Lab · ${names.join(", ")}`;
      return {
        id: b.id,
        start: b.start,
        end: b.end,
        title,
        backgroundColor: mine ? color : `${color}26`,
        borderColor: color,
        textColor: mine ? "#fff" : "#27272a",
        classNames: [...(mine ? ["ev-mine"] : []), ...(b.kind === "ASYNC" ? ["ev-async"] : [])],
        editable: isAdmin || b.createdById === me.id,
        extendedProps: { booking: b },
      };
    });

    for (const m of missions) {
      if (projectFilter !== "all" && projectFilter !== m.projectId) continue;
      const color = m.projectColor ?? MISSION_COLOR;
      out.push({
        id: `mission:${m.missionId}:${m.start}`,
        start: m.start,
        end: m.end,
        title: `🔁 ${m.projectName ? `${m.projectName}: ` : ""}${m.title}`,
        backgroundColor: color,
        borderColor: MISSION_COLOR,
        textColor: "#fff",
        classNames: ["ev-mission"],
        editable: false,
        extendedProps: { mission: m },
      });
    }

    return out;
  }, [visible, missions, projectFilter, me.id, isAdmin]);

  const myMinutes = useMemo(
    () => bookings.filter((b) => isIn(b, me.id)).reduce((acc, b) => acc + minutesOf(b), 0),
    [bookings, me.id],
  );
  const openProjectSessions = useMemo(
    () =>
      bookings.filter(
        (b) => b.kind === "PROJECT" && !isIn(b, me.id) && b.projectId && myProjects.some((p) => p.id === b.projectId) && new Date(b.end) > new Date(),
      ).length,
    [bookings, me.id, myProjects],
  );

  /** Alternativa a arrastrar (útil en celular): abre el formulario con el siguiente bloque de 2 h. */
  function openQuickCreate() {
    const base = calendarRef.current?.getApi().getDate() ?? new Date();
    const start = new Date(base);
    const now = new Date();
    const minutes =
      start.toDateString() === now.toDateString()
        ? Math.max(lab.openMinute, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30)
        : lab.openMinute;
    const clamped = Math.min(minutes, 22 * 60);
    start.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
    setDialog({ type: "create", start, end: new Date(start.getTime() + 2 * 60 * 60 * 1000) });
  }

  function onSelect(arg: DateSelectArg) {
    arg.view.calendar.unselect();
    setDialog({ type: "create", start: arg.start, end: arg.end });
  }

  function onEventClick(arg: EventClickArg) {
    const booking = arg.event.extendedProps.booking as BookingItem | undefined;
    const mission = arg.event.extendedProps.mission as MissionOccurrenceItem | undefined;
    if (booking) setDialog({ type: "booking", id: booking.id });
    else if (mission) setDialog({ type: "mission", occurrence: mission });
  }

  async function onMoveOrResize(arg: EventDropArg | EventResizeDoneArg) {
    const booking = arg.event.extendedProps.booking as BookingItem;
    try {
      await api(`/api/bookings/${booking.id}`, { method: "PATCH", body: { start: arg.event.start, end: arg.event.end } });
      await load();
    } catch (err) {
      arg.revert();
      alert((err as Error).message);
    }
  }

  async function closeAndReload() {
    setDialog(null);
    await load();
  }

  const selected = dialog?.type === "booking" ? bookings.find((b) => b.id === dialog.id) : undefined;
  const slotDuration = `00:${String(Math.min(lab.slotMinutes, 30)).padStart(2, "0")}:00`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendario del lab</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Registra a qué hora vas a estar arrastrando sobre el calendario y ve quién coincide contigo; haz clic en un horario para sumarte.
            Lab abierto {minutesToHHMM(lab.openMinute)}–{minutesToHHMM(lab.closeMinute)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <button className="btn-primary" onClick={openQuickCreate}>+ Registrar mi horario</button>
          <a className="btn-ghost" href="/api/me/export" download>
            ⤓ Exportar a mi calendario
          </a>
          <div className="card px-4 py-2">
            <div className="text-xs text-zinc-500">Tus horas en esta vista</div>
            <div className="font-semibold text-brand">{formatHours(Math.round(myMinutes))}</div>
          </div>
          {openProjectSessions > 0 && (
            <div className="card border-violet-200 bg-violet-50 px-4 py-2">
              <div className="text-xs text-violet-700">Sesiones de tu equipo</div>
              <div className="font-semibold text-violet-900">{openProjectSessions} para unirte</div>
            </div>
          )}
        </div>
      </div>

      {reminders.length > 0 && (
        <Link href="/proyectos" className="card block border-amber-200 bg-amber-50 px-4 py-3 text-sm hover:bg-amber-100/60">
          <div className="mb-1 font-semibold text-amber-900">📌 Recordatorios de proyectos</div>
          <ul className="space-y-0.5 text-amber-900">
            {reminders.map((r) => (
              <li key={r.id}>
                {r.pinned ? "📌 " : "• "}
                {r.projectName && <b>{r.projectName}: </b>}
                {r.title}
                {r.dueDate && (
                  <span className="text-amber-700">
                    {" "}— {new Date(r.dueDate).toLocaleDateString("es-MX", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Link>
      )}

      <div className="card flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 text-sm">
        <label className="inline-flex cursor-pointer select-none items-center gap-2">
          <input type="checkbox" className="accent-brand" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Sólo mis horarios
        </label>
        <span className="inline-flex items-center gap-2 text-zinc-500">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: LAB_COLOR }} /> Contigo
          <span className="ml-2 inline-block h-3 w-3 rounded-sm border" style={{ background: `${LAB_COLOR}26`, borderColor: LAB_COLOR }} /> Otros
          <span
            className="ml-2 inline-block h-3 w-3 rounded-sm"
            style={{ background: `repeating-linear-gradient(135deg, ${ASYNC_COLOR} 0 3px, #fff 3px 5px)` }}
          />{" "}
          Asíncrono
          <span className="ml-2 inline-block h-3 w-3 rounded-sm" style={{ background: MISSION_COLOR }} /> 🔁 Sesión fija
        </span>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <select className="input w-auto py-1.5" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
            <option value="all">Todos los miembros</option>
            {teammates.size > 0 && <option value="team">Mi equipo</option>}
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.id === me.id ? `${u.name} (tú)` : u.name}</option>
            ))}
          </select>
          <select className="input w-auto py-1.5" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="all">Lab y proyectos</option>
            <option value="lab">Sólo lab</option>
            <option value="async">Sólo asíncrono</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <WhoIsThere me={me} bookings={bookings} teammates={teammates} onOpen={(id) => setDialog({ type: "booking", id })} />

      <div className={`card p-3 transition-opacity ${loading ? "opacity-70" : ""}`}>
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          locale={esLocale}
          initialView="timeGridWeek"
          headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth" }}
          height="auto"
          allDaySlot={false}
          nowIndicator
          slotDuration={slotDuration}
          snapDuration="00:15:00"
          slotMinTime={minutesToHHMM(Math.max(0, lab.openMinute - 60))}
          slotMaxTime={minutesToHHMM(Math.min(1440, lab.closeMinute + 60)).replace("24:00", "23:59")}
          businessHours={{
            daysOfWeek: lab.openDays,
            startTime: minutesToHHMM(lab.openMinute),
            endTime: minutesToHHMM(lab.closeMinute).replace("24:00", "23:59"),
          }}
          firstDay={1}
          selectable
          selectMirror
          selectLongPressDelay={300}
          eventLongPressDelay={300}
          selectAllow={(s) => s.start.toDateString() === new Date(s.end.getTime() - 1).toDateString()}
          events={events}
          datesSet={onDatesSet}
          select={onSelect}
          eventClick={onEventClick}
          eventDrop={onMoveOrResize}
          eventResize={onMoveOrResize}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        />
      </div>

      {dialog?.type === "create" && (
        <Modal title="¿Cuándo vas a estar?" onClose={() => setDialog(null)}>
          <SlotForm
            initial={{ participantIds: [me.id], start: dialog.start, end: dialog.end, kind: "LAB", projectId: null, notes: "" }}
            users={isAdmin ? users : undefined}
            projects={isAdmin ? projects : myProjects}
            submitLabel="Guardar"
            onSubmit={async (v) => {
              await api("/api/bookings", { method: "POST", body: toBody(v, isAdmin) });
              await closeAndReload();
            }}
          />
        </Modal>
      )}

      {dialog?.type === "mission" && (
        <Modal
          title={`🔁 ${dialog.occurrence.projectName ? `${dialog.occurrence.projectName}: ` : ""}${dialog.occurrence.title}`}
          onClose={() => setDialog(null)}
        >
          <p className="text-sm first-letter:uppercase">
            {formatRange(new Date(dialog.occurrence.start), new Date(dialog.occurrence.end))}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Sesión fija {dialog.occurrence.projectName ? "del proyecto" : "de todo el club"}, se repite cada semana (la define el admin).
          </p>
          <div className="mt-5 flex justify-end">
            <Link href="/proyectos" className="btn-dark">Ver proyectos</Link>
          </div>
        </Modal>
      )}

      {selected && (
        <BookingDialog
          me={me}
          users={users}
          projects={isAdmin ? projects : myProjects}
          booking={selected}
          onClose={() => setDialog(null)}
          onDone={closeAndReload}
        />
      )}
    </div>
  );
}

const toBody = (v: SlotFormValue, includeParticipants: boolean) => ({
  start: v.start.toISOString(),
  end: v.end.toISOString(),
  kind: v.kind,
  projectId: v.projectId,
  notes: v.notes || null,
  ...(includeParticipants ? { participantIds: v.participantIds } : {}),
});

function BookingDialog(props: {
  me: Me;
  users: UserOption[];
  projects: ProjectOption[];
  booking: BookingItem;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { booking, me } = props;
  const isAdmin = me.role === "ADMIN";
  const mine = isIn(booking, me.id);
  const canEdit = isAdmin || booking.createdById === me.id;
  const ended = new Date(booking.end) <= new Date();
  const isTeamMember = !booking.projectId || props.projects.some((p) => p.id === booking.projectId);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await props.onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const title =
    booking.kind === "ASYNC"
      ? `Trabajo asíncrono${booking.project ? ` · ${booking.project.name}` : ""}`
      : booking.kind === "PROJECT" && booking.project
        ? `Sesión de ${booking.project.name}`
        : "En el lab";

  if (editing) {
    return (
      <Modal title={`Editar · ${title}`} onClose={props.onClose}>
        <SlotForm
          initial={{
            participantIds: booking.participants.map((p) => p.userId),
            start: new Date(booking.start),
            end: new Date(booking.end),
            kind: booking.kind,
            projectId: booking.projectId,
            notes: booking.notes ?? "",
          }}
          users={isAdmin ? props.users : undefined}
          projects={props.projects}
          submitLabel="Guardar cambios"
          onSubmit={async (v) => {
            await api(`/api/bookings/${booking.id}`, { method: "PATCH", body: toBody(v, isAdmin) });
            await props.onDone();
          }}
        >
          <button type="button" className="btn-ghost mr-auto" onClick={() => setEditing(false)}>Volver</button>
        </SlotForm>
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={props.onClose}>
      <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Horario</dt>
        <dd className="first-letter:uppercase">{formatRange(new Date(booking.start), new Date(booking.end))}</dd>
        {booking.project && (
          <>
            <dt className="text-zinc-500">Proyecto</dt>
            <dd className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: booking.project.color }} />
              {booking.project.name}
            </dd>
          </>
        )}
        <dt className="text-zinc-500">Participantes</dt>
        <dd>
          <div className="flex flex-wrap gap-1.5">
            {booking.participants.map((p) => (
              <span key={p.userId} className={`rounded-full px-2 py-0.5 text-xs ${p.userId === me.id ? "bg-brand text-white" : "bg-zinc-100"}`}>
                {p.userId === me.id ? "Tú" : p.user.name}
              </span>
            ))}
          </div>
        </dd>
        {booking.notes && (
          <>
            <dt className="text-zinc-500">Notas</dt>
            <dd className="whitespace-pre-wrap">{booking.notes}</dd>
          </>
        )}
        {booking.source === "RECOMMENDED" && (
          <>
            <dt className="text-zinc-500">Origen</dt>
            <dd>Calendario recomendado</dd>
          </>
        )}
      </dl>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!mine && !ended && !isTeamMember && !isAdmin && (
        <p className="mb-3 text-xs text-zinc-500">Para unirte a esta sesión tienes que ser integrante del proyecto.</p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isAdmin && (
          <button
            className="btn-danger mr-auto"
            disabled={busy}
            onClick={() => confirm("¿Eliminar este horario para todos?") && run(() => api(`/api/bookings/${booking.id}`, { method: "DELETE" }))}
          >
            Eliminar
          </button>
        )}
        {canEdit && <button className="btn-ghost" disabled={busy} onClick={() => setEditing(true)}>Editar</button>}
        {mine && (
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={() =>
              (booking.participants.length > 1 || confirm("Eres la única persona: el horario se eliminará. ¿Continuar?")) &&
              run(() => api(`/api/bookings/${booking.id}/leave`, { method: "POST" }))
            }
          >
            Ya no voy
          </button>
        )}
        {!mine && !ended && (isTeamMember || isAdmin) && (
          <button className="btn-primary" disabled={busy} onClick={() => run(() => api(`/api/bookings/${booking.id}/join`, { method: "POST" }))}>
            Yo también voy
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Quién está ahora en el lab y quién coincide conmigo en mis próximos horarios (de la vista actual). */
function WhoIsThere(props: { me: Me; bookings: BookingItem[]; teammates: Set<string>; onOpen: (id: string) => void }) {
  const { me, bookings, teammates } = props;
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const present = useMemo(() => presentAt(now, bookings), [now, bookings]);
  const coincidences = useMemo(
    () => findCoincidences(me.id, bookings, teammates).filter((c) => c.end > now),
    [me.id, bookings, teammates, now],
  );
  const myUpcoming = bookings.some((b) => b.kind !== "ASYNC" && isIn(b, me.id) && new Date(b.end) > now);
  const shown = expanded ? coincidences : coincidences.slice(0, 4);
  const hhmm = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <section className="card grid gap-4 p-4 text-sm md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">🟢 Ahora en el lab</h2>
        {present.length === 0 ? (
          <p className="mt-1 text-zinc-500">Nadie registrado en este momento.</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {present.map((p) => (
              <span
                key={p.userId}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  p.userId === me.id ? "bg-brand text-white" : teammates.has(p.userId) ? "bg-violet-100 text-violet-800" : "bg-zinc-100"
                }`}
              >
                {p.userId === me.id ? "Tú" : p.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">👥 Quién coincide contigo</h2>
        {coincidences.length === 0 ? (
          <p className="mt-1 text-zinc-500">
            {myUpcoming
              ? "Por ahora nadie más registró horario cuando tú vas a estar."
              : "Registra a qué hora vas a estar para ver quién coincide contigo."}
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {shown.map((c) => (
              <li key={c.scheduleId} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <button className="font-medium hover:underline first-letter:uppercase" onClick={() => props.onOpen(c.scheduleId)}>
                  {c.start.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })} {hhmm(c.start)}–{hhmm(c.end)}
                </button>
                {c.people.map((p) => (
                  <span
                    key={p.userId}
                    title={`${hhmm(p.start)}–${hhmm(p.end)}`}
                    className={`rounded-full px-2 py-0.5 text-xs ${p.teammate ? "bg-violet-100 text-violet-800" : "bg-zinc-100 text-zinc-700"}`}
                  >
                    {p.name.split(" ")[0]}
                    <span className="opacity-60"> {hhmm(p.start)}–{hhmm(p.end)}</span>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
        {coincidences.length > 4 && (
          <button className="mt-1 text-xs font-medium text-brand hover:underline" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Ver menos" : `Ver ${coincidences.length - 4} más`}
          </button>
        )}
        {teammates.size > 0 && <p className="mt-2 text-xs text-zinc-400">En morado: gente de tus proyectos.</p>}
      </div>
    </section>
  );
}
