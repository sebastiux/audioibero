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
import type { AssignmentItem, CalendarItem, LabConfig, Me, ProjectOption, UserOption } from "@/lib/types";
import { Modal } from "./Modal";
import { SlotForm, type SlotFormValue } from "./SlotForm";

type Props = {
  me: Me;
  users: UserOption[];
  projects: ProjectOption[];
  lab: LabConfig;
};

type Dialog =
  | { type: "create"; start: Date; end: Date }
  | { type: "availability"; item: CalendarItem }
  | { type: "assignment"; item: AssignmentItem }
  | null;

const LAB_COLOR = "#c8102e";

export function CalendarView({ me, users, projects, lab }: Props) {
  const isAdmin = me.role === "ADMIN";
  const calendarRef = useRef<FullCalendar>(null);
  const rangeRef = useRef<{ start: Date; end: Date } | null>(null);
  const [availabilities, setAvailabilities] = useState<CalendarItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isMobile, setIsMobile] = useState(false);

  const [showMine, setShowMine] = useState(true);
  const [showOthers, setShowOthers] = useState(true);
  const [showAssignments, setShowAssignments] = useState(true);
  const [memberFilter, setMemberFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const myProjects = useMemo(() => projects.filter((p) => p.memberIds.includes(me.id)), [projects, me.id]);

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
      const data = await api<{ availabilities: CalendarItem[]; assignments: AssignmentItem[] }>(`/api/calendar?${qs}`);
      setAvailabilities(data.availabilities);
      setAssignments(data.assignments);
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

  const matchesFilters = useCallback(
    (item: CalendarItem) =>
      (memberFilter === "all" || item.userId === memberFilter) &&
      (projectFilter === "all" || (projectFilter === "lab" ? item.kind === "LAB" : item.projectId === projectFilter)),
    [memberFilter, projectFilter],
  );

  const events = useMemo<EventInput[]>(() => {
    const out: EventInput[] = [];
    for (const a of availabilities) {
      const mine = a.userId === me.id;
      if ((mine && !showMine) || (!mine && !showOthers) || !matchesFilters(a)) continue;
      const color = a.project?.color ?? "#16a34a";
      const what = a.kind === "PROJECT" && a.project ? a.project.name : "Lab";
      out.push({
        id: `av:${a.id}`,
        start: a.start,
        end: a.end,
        title: mine ? `Disponible · ${what}` : `${a.user.name} · disponible (${what})`,
        backgroundColor: mine ? `${color}33` : "#f4f4f5",
        borderColor: mine ? color : "#a1a1aa",
        textColor: mine ? "#14532d" : "#52525b",
        classNames: ["ev-availability", ...(mine ? ["ev-mine"] : [])],
        editable: mine || isAdmin,
        extendedProps: { type: "availability", item: a },
      });
    }
    if (showAssignments) {
      for (const a of assignments) {
        if (!matchesFilters(a)) continue;
        const mine = a.userId === me.id;
        out.push({
          id: `as:${a.id}`,
          start: a.start,
          end: a.end,
          title: `${mine ? "★ Tú" : a.user.name} · ${a.kind === "PROJECT" && a.project ? a.project.name : "Lab"}`,
          backgroundColor: a.project?.color ?? LAB_COLOR,
          borderColor: a.project?.color ?? LAB_COLOR,
          textColor: "#fff",
          classNames: mine ? ["ev-mine"] : [],
          editable: isAdmin,
          extendedProps: { type: "assignment", item: a },
        });
      }
    }
    return out;
  }, [availabilities, assignments, me.id, isAdmin, showMine, showOthers, showAssignments, matchesFilters]);

  // Resumen de la semana visible para el usuario actual.
  const summary = useMemo(() => {
    const minutes = (items: CalendarItem[]) =>
      items
        .filter((i) => i.userId === me.id)
        .reduce((acc, i) => acc + (new Date(i.end).getTime() - new Date(i.start).getTime()) / 60000, 0);
    return { available: minutes(availabilities), assigned: minutes(assignments) };
  }, [availabilities, assignments, me.id]);

  /** Alternativa a arrastrar (útil en celular): abre el formulario con el siguiente bloque de 2 h. */
  function openQuickCreate() {
    const base = calendarRef.current?.getApi().getDate() ?? new Date();
    const start = new Date(base);
    const now = new Date();
    const minutes = start.toDateString() === now.toDateString()
      ? Math.max(lab.openMinute, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30)
      : lab.openMinute;
    const clamped = Math.min(minutes, 22 * 60);
    start.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    setDialog({ type: "create", start, end });
  }

  function onSelect(arg: DateSelectArg) {
    arg.view.calendar.unselect();
    setDialog({ type: "create", start: arg.start, end: arg.end });
  }

  function onEventClick(arg: EventClickArg) {
    const { type, item } = arg.event.extendedProps as { type: string; item: CalendarItem };
    setDialog(type === "assignment" ? { type: "assignment", item: item as AssignmentItem } : { type: "availability", item });
  }

  async function onMoveOrResize(arg: EventDropArg | EventResizeDoneArg) {
    const { type, item } = arg.event.extendedProps as { type: string; item: CalendarItem };
    const path = type === "assignment" ? `/api/assignments/${item.id}` : `/api/availability/${item.id}`;
    try {
      await api(path, { method: "PATCH", body: { start: arg.event.start, end: arg.event.end } });
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

  const slotDuration = `00:${String(Math.min(lab.slotMinutes, 30)).padStart(2, "0")}:00`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendario del lab</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Arrastra sobre el calendario para marcar cuándo puedes ir al lab o trabajar en un proyecto.
            Lab abierto {minutesToHHMM(lab.openMinute)}–{minutesToHHMM(lab.closeMinute)} · cupo {lab.capacity} personas.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <button className="btn-primary" onClick={openQuickCreate}>+ Agregar espacio libre</button>
          <div className="card px-4 py-2">
            <div className="text-xs text-zinc-500">Tu disponibilidad</div>
            <div className="font-semibold">{formatHours(Math.round(summary.available))}</div>
          </div>
          <div className="card px-4 py-2">
            <div className="text-xs text-zinc-500">Tus horas asignadas</div>
            <div className="font-semibold text-brand">{formatHours(Math.round(summary.assigned))}</div>
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 text-sm">
        <Toggle checked={showMine} onChange={setShowMine} label="Mis espacios libres" swatch="#16a34a" dashed />
        <Toggle checked={showOthers} onChange={setShowOthers} label="Espacios de otros" swatch="#a1a1aa" dashed />
        <Toggle checked={showAssignments} onChange={setShowAssignments} label="Asignaciones" swatch={LAB_COLOR} />
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <select className="input w-auto py-1.5" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
            <option value="all">Todos los miembros</option>
            <option value={me.id}>Sólo yo</option>
            {users.filter((u) => u.id !== me.id).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select className="input w-auto py-1.5" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="all">Lab y proyectos</option>
            <option value="lab">Sólo lab</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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
        <CreateDialog
          me={me}
          users={users}
          projects={projects}
          myProjects={myProjects}
          start={dialog.start}
          end={dialog.end}
          onClose={() => setDialog(null)}
          onSaved={closeAndReload}
        />
      )}

      {dialog?.type === "availability" && (
        <AvailabilityDialog
          me={me}
          users={users}
          projects={projects}
          myProjects={myProjects}
          item={dialog.item}
          onClose={() => setDialog(null)}
          onDone={closeAndReload}
        />
      )}

      {dialog?.type === "assignment" && (
        <AssignmentDialog
          me={me}
          users={users}
          projects={projects}
          item={dialog.item}
          onClose={() => setDialog(null)}
          onDone={closeAndReload}
        />
      )}
    </div>
  );
}

function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: string; swatch: string; dashed?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2">
      <input type="checkbox" className="accent-brand" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{
          background: props.dashed ? "transparent" : props.swatch,
          border: `1.5px ${props.dashed ? "dashed" : "solid"} ${props.swatch}`,
        }}
      />
      {props.label}
    </label>
  );
}

/** Pide confirmación si se rebasa el cupo del lab y reintenta con ?force=1. */
async function withCapacityOverride(path: string, method: string, body: unknown) {
  try {
    return await api(path, { method, body });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("lleno") && confirm(`${msg}. ¿Asignar de todos modos?`)) {
      return api(`${path}?force=1`, { method, body });
    }
    throw err;
  }
}

const toBody = (v: SlotFormValue) => ({
  userId: v.userId,
  start: v.start.toISOString(),
  end: v.end.toISOString(),
  kind: v.kind,
  projectId: v.projectId,
  notes: v.notes || null,
});

type DialogBase = {
  me: Me;
  users: UserOption[];
  projects: ProjectOption[];
  onClose: () => void;
};

function CreateDialog(props: DialogBase & { myProjects: ProjectOption[]; start: Date; end: Date; onSaved: () => Promise<void> }) {
  const isAdmin = props.me.role === "ADMIN";
  const [mode, setMode] = useState<"availability" | "assignment">("availability");
  const initial: SlotFormValue = { userId: props.me.id, start: props.start, end: props.end, kind: "LAB", projectId: null, notes: "" };

  return (
    <Modal title={mode === "availability" ? "Nuevo espacio libre" : "Nueva asignación"} onClose={props.onClose}>
      {isAdmin && (
        <div className="mb-4 grid grid-cols-2 rounded-lg bg-zinc-100 p-1 text-sm font-medium">
          {(["availability", "assignment"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md py-1.5 ${mode === m ? "bg-white shadow-sm" : "text-zinc-500"}`}>
              {m === "availability" ? "Espacio libre" : "Asignar día"}
            </button>
          ))}
        </div>
      )}
      {mode === "availability" ? (
        <SlotForm
          key="availability"
          initial={initial}
          users={isAdmin ? props.users : undefined}
          projects={isAdmin ? props.projects : props.myProjects}
          submitLabel="Guardar disponibilidad"
          onSubmit={async (v) => {
            await api("/api/availability", { body: toBody(v) });
            await props.onSaved();
          }}
        />
      ) : (
        <SlotForm
          key="assignment"
          initial={{ ...initial, userId: "" }}
          users={props.users}
          projects={props.projects}
          submitLabel="Asignar"
          onSubmit={async (v) => {
            await withCapacityOverride("/api/assignments", "POST", toBody(v));
            await props.onSaved();
          }}
        />
      )}
    </Modal>
  );
}

function Details({ item, extra }: { item: CalendarItem; extra?: React.ReactNode }) {
  return (
    <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      <dt className="text-zinc-500">Miembro</dt>
      <dd className="font-medium">{item.user.name}</dd>
      <dt className="text-zinc-500">Horario</dt>
      <dd className="capitalize">{formatRange(new Date(item.start), new Date(item.end))}</dd>
      <dt className="text-zinc-500">Para</dt>
      <dd>
        {item.kind === "PROJECT" && item.project ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.project.color }} />
            {item.project.name}
          </span>
        ) : (
          "Trabajo en el lab"
        )}
      </dd>
      {item.notes && (
        <>
          <dt className="text-zinc-500">Notas</dt>
          <dd className="whitespace-pre-wrap">{item.notes}</dd>
        </>
      )}
      {extra}
    </dl>
  );
}

function AvailabilityDialog(props: DialogBase & { myProjects: ProjectOption[]; item: CalendarItem; onDone: () => Promise<void> }) {
  const { item, me } = props;
  const isAdmin = me.role === "ADMIN";
  const canEdit = item.userId === me.id || isAdmin;
  const [busy, setBusy] = useState(false);
  const initial: SlotFormValue = {
    userId: item.userId,
    start: new Date(item.start),
    end: new Date(item.end),
    kind: item.kind,
    projectId: item.projectId,
    notes: item.notes ?? "",
  };

  async function remove() {
    if (!confirm("¿Eliminar este espacio libre?")) return;
    setBusy(true);
    try {
      await api(`/api/availability/${item.id}`, { method: "DELETE" });
      await props.onDone();
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  async function assign() {
    setBusy(true);
    try {
      await withCapacityOverride("/api/assignments", "POST", toBody(initial));
      await props.onDone();
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={item.userId === me.id ? "Tu espacio libre" : `Espacio libre de ${item.user.name}`} onClose={props.onClose}>
      {!canEdit ? (
        <Details item={item} />
      ) : (
        <SlotForm
          initial={initial}
          projects={isAdmin ? props.projects : props.myProjects}
          submitLabel="Guardar cambios"
          onSubmit={async (v) => {
            await api(`/api/availability/${item.id}`, { method: "PATCH", body: { ...toBody(v), userId: undefined } });
            await props.onDone();
          }}
        >
          {isAdmin && (
            <>
              <button type="button" className="btn-danger mr-auto" onClick={remove} disabled={busy}>Eliminar</button>
              <button type="button" className="btn-dark" onClick={assign} disabled={busy}>Asignar este horario</button>
            </>
          )}
        </SlotForm>
      )}
      {!isAdmin && item.userId === me.id && (
        <p className="mt-4 text-xs text-zinc-500">Para eliminar un espacio libre pide a un admin que lo borre.</p>
      )}
    </Modal>
  );
}

function AssignmentDialog(props: DialogBase & { item: AssignmentItem; onDone: () => Promise<void> }) {
  const { item, me } = props;
  const [busy, setBusy] = useState(false);
  const sourceLabel = item.source === "RECOMMENDED" ? "Calendario recomendado" : "Asignación manual";

  async function remove() {
    if (!confirm("¿Eliminar esta asignación?")) return;
    setBusy(true);
    try {
      await api(`/api/assignments/${item.id}`, { method: "DELETE" });
      await props.onDone();
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  if (me.role !== "ADMIN") {
    return (
      <Modal title={item.userId === me.id ? "Tu horario asignado" : "Horario asignado"} onClose={props.onClose}>
        <Details
          item={item}
          extra={
            <>
              <dt className="text-zinc-500">Origen</dt>
              <dd>{sourceLabel}</dd>
            </>
          }
        />
      </Modal>
    );
  }

  return (
    <Modal title={`Asignación · ${sourceLabel}`} onClose={props.onClose}>
      <SlotForm
        initial={{
          userId: item.userId,
          start: new Date(item.start),
          end: new Date(item.end),
          kind: item.kind,
          projectId: item.projectId,
          notes: item.notes ?? "",
        }}
        users={props.users}
        projects={props.projects}
        submitLabel="Guardar cambios"
        onSubmit={async (v) => {
          await withCapacityOverride(`/api/assignments/${item.id}`, "PATCH", toBody(v));
          await props.onDone();
        }}
      >
        <button type="button" className="btn-danger mr-auto" onClick={remove} disabled={busy}>Eliminar</button>
      </SlotForm>
    </Modal>
  );
}
