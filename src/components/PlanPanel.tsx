"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventInput } from "@fullcalendar/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { api, formatHours, minutesToHHMM, toDateInput } from "@/lib/client";
import type { LabConfig, ProjectOption, SlotKind } from "@/lib/types";

type Busy = { start: string; end: string; title: string; type: "class" | "booking" | "mission" };
type Block = { key: number; start: Date; end: Date };

function nextWeek() {
  const d = new Date();
  const monday = new Date(d);
  monday.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toDateInput(monday), to: toDateInput(sunday) };
}

const BUSY_STYLE: Record<Busy["type"], { bg: string; label: string }> = {
  class: { bg: "#a1a1aa", label: "Clase" },
  booking: { bg: "#71717a", label: "Ya reservado" },
  mission: { bg: "#16161d", label: "Misión general" },
};

export function PlanPanel(props: { iberoUpdatedAt: string | null; projects: ProjectOption[]; lab: LabConfig }) {
  const router = useRouter();
  const initial = nextWeek();
  const fileRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef(0);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [hours, setHours] = useState(6);
  const [blockMinutes, setBlockMinutes] = useState(120);
  const [kind, setKind] = useState<SlotKind>("LAB");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const totalMinutes = blocks.reduce((a, b) => a + (b.end.getTime() - b.start.getTime()) / 60000, 0);

  async function upload(file: File) {
    setUploadMsg(null);
    try {
      const res = await api<{ events: number; recurring: number }>("/api/me/ibero", { method: "PUT", body: { ics: await file.text() } });
      setUploadMsg({ ok: true, text: `Horario guardado: ${res.events} eventos (${res.recurring} semanales).` });
      router.refresh();
    } catch (err) {
      setUploadMsg({ ok: false, text: (err as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeIbero() {
    if (!confirm("¿Borrar tu horario Ibero guardado?")) return;
    await api("/api/me/ibero", { method: "DELETE" });
    setUploadMsg(null);
    router.refresh();
  }

  async function propose(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await api<{ blocks: { start: string; end: string }[]; busy: Busy[]; missingMinutes: number; hasIbero: boolean }>(
        "/api/me/plan/propose",
        { body: { from, to, weeklyHours: hours, blockMinutes, kind } },
      );
      setBusy(res.busy);
      setBlocks(res.blocks.map((b) => ({ key: ++keyRef.current, start: new Date(b.start), end: new Date(b.end) })));
      if (res.missingMinutes > 0) {
        setMessage({ ok: false, text: `No cupieron ${formatHours(res.missingMinutes)}: no hay suficientes huecos libres en el horario del lab.` });
      }
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api<{ created: number; skipped: { start: string; reason: string }[] }>("/api/me/plan/apply", {
        body: { kind, projectId: projectId || null, blocks: blocks.map((b) => ({ start: b.start, end: b.end })) },
      });
      const skipped = res.skipped.length ? ` ${res.skipped.length} no se pudieron reservar: ${res.skipped.map((s) => s.reason).join("; ")}.` : "";
      setMessage({ ok: res.created > 0, text: `Se reservaron ${res.created} bloques.${skipped}` });
      if (res.created > 0) {
        setBlocks([]);
        setBusy(null);
      }
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const events = useMemo<EventInput[]>(() => {
    const out: EventInput[] = (busy ?? []).map((b, i) => ({
      id: `busy-${i}`,
      start: b.start,
      end: b.end,
      title: `${BUSY_STYLE[b.type].label}: ${b.title}`,
      backgroundColor: BUSY_STYLE[b.type].bg,
      borderColor: BUSY_STYLE[b.type].bg,
      textColor: "#fff",
      editable: false,
      classNames: ["opacity-80"],
    }));
    for (const b of blocks) {
      out.push({
        id: `block-${b.key}`,
        start: b.start,
        end: b.end,
        title: kind === "ASYNC" ? "🌐 Asíncrono (propuesta)" : kind === "PROJECT" ? "🎧 Proyecto (propuesta)" : "🎛️ Lab (propuesta)",
        backgroundColor: kind === "ASYNC" ? "#0891b2" : "#c8102e",
        borderColor: kind === "ASYNC" ? "#0891b2" : "#c8102e",
        editable: true,
        classNames: ["ev-proposal"],
        extendedProps: { key: b.key },
      });
    }
    return out;
  }, [busy, blocks, kind]);

  const updateBlock = (key: number, start: Date | null, end: Date | null) => {
    if (!start || !end) return;
    setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, start, end } : b)));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mi plan</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Sube tu calendario Ibero, di cuántas horas quieres dedicarle al club y te proponemos horarios que no choquen con tus
            clases, cerca de ellas y donde el lab tenga lugar. Arrastra los bloques para ajustarlos y luego resérvalos.
          </p>
        </div>
        <a className="btn-ghost" href="/api/me/export" download>⤓ Exportar mis reservas (.ics)</a>
      </div>

      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">1 · Tu horario Ibero</h2>
            <p className="text-sm text-zinc-500">
              {props.iberoUpdatedAt
                ? `Guardado el ${new Date(props.iberoUpdatedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}. Súbelo de nuevo si cambió.`
                : "Aún no lo subes. Sin él, la propuesta sólo evita tus reservas y las misiones generales."}
            </p>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button className="btn-dark" onClick={() => fileRef.current?.click()}>{props.iberoUpdatedAt ? "Actualizar .ics" : "Subir .ics"}</button>
            {props.iberoUpdatedAt && <button className="btn-ghost" onClick={removeIbero}>Borrar</button>}
          </div>
        </div>
        <details className="text-sm text-zinc-600">
          <summary className="cursor-pointer font-medium text-zinc-700">¿Cómo exporto mi calendario Ibero?</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Entra a Outlook con tu cuenta Ibero (outlook.office.com) y abre <b>Calendario</b>.</li>
            <li>Ve a <b>Configuración → Calendario → Calendarios compartidos → Publicar un calendario</b>.</li>
            <li>Elige tu calendario, permisos <b>“Puede ver todos los detalles”</b> y pulsa <b>Publicar</b>.</li>
            <li>Abre el enlace <b>ICS</b> en el navegador para descargar el archivo y súbelo aquí.</li>
          </ol>
          <p className="mt-2">También sirve cualquier archivo .ics (Google Calendar → Configuración → Exportar).</p>
        </details>
        {uploadMsg && (
          <p className={`rounded-lg px-3 py-2 text-sm ${uploadMsg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{uploadMsg.text}</p>
        )}
      </section>

      <form onSubmit={propose} className="card space-y-4 p-5">
        <h2 className="font-semibold">2 · ¿Cuántas horas quieres?</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div>
            <label className="label">Desde</label>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
          </div>
          <div>
            <label className="label">Horas / semana</label>
            <input className="input" type="number" min={0.5} max={80} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} required />
          </div>
          <div>
            <label className="label">Bloques de</label>
            <select className="input" value={blockMinutes} onChange={(e) => setBlockMinutes(Number(e.target.value))}>
              {[60, 90, 120, 180, 240].map((m) => (
                <option key={m} value={m}>{formatHours(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as SlotKind)}>
              <option value="LAB">🎛️ Lab</option>
              <option value="PROJECT">🎧 Proyecto</option>
              <option value="ASYNC">🌐 Asíncrono</option>
            </select>
          </div>
          <div>
            <label className="label">Proyecto</label>
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={kind === "LAB"} required={kind === "PROJECT"}>
              <option value="">{kind === "PROJECT" ? "Selecciona…" : "Ninguno"}</option>
              {props.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn-dark" disabled={loading}>{loading ? "Calculando…" : "Proponerme horario"}</button>
        </div>
      </form>

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {message.text} {message.ok && <Link href="/calendario" className="font-medium underline">Ver en el calendario</Link>}
        </p>
      )}

      {busy && (
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="card p-3">
            <p className="mb-2 px-1 text-xs text-zinc-500">
              Arrastra o estira los bloques rojos para ajustarlos · arrastra sobre un hueco para agregar uno · clic en un bloque para quitarlo.
            </p>
            <FullCalendar
              key={from}
              plugins={[timeGridPlugin, interactionPlugin]}
              locale={esLocale}
              initialView="timeGridWeek"
              initialDate={from}
              firstDay={1}
              headerToolbar={{ left: "prev,next", center: "title", right: "" }}
              height="auto"
              allDaySlot={false}
              slotMinTime={minutesToHHMM(Math.max(0, props.lab.openMinute - 60))}
              slotMaxTime={minutesToHHMM(Math.min(1439, props.lab.closeMinute + 60))}
              businessHours={{
                daysOfWeek: props.lab.openDays,
                startTime: minutesToHHMM(props.lab.openMinute),
                endTime: minutesToHHMM(props.lab.closeMinute).replace("24:00", "23:59"),
              }}
              snapDuration="00:15:00"
              eventOverlap={false}
              selectOverlap={false}
              selectable
              selectMirror
              selectAllow={(s) => s.start.toDateString() === new Date(s.end.getTime() - 1).toDateString()}
              select={(arg) => {
                arg.view.calendar.unselect();
                setBlocks((bs) => [...bs, { key: ++keyRef.current, start: arg.start, end: arg.end }]);
              }}
              events={events}
              eventDrop={(arg) => updateBlock(arg.event.extendedProps.key, arg.event.start, arg.event.end)}
              eventResize={(arg) => updateBlock(arg.event.extendedProps.key, arg.event.start, arg.event.end)}
              eventClick={(arg) => {
                const key = arg.event.extendedProps.key as number | undefined;
                if (key !== undefined) setBlocks((bs) => bs.filter((b) => b.key !== key));
              }}
              eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
              slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            />
          </div>
          <aside className="space-y-3">
            <div className="card p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Tu propuesta</div>
              <div className="mt-1 text-2xl font-bold">{formatHours(Math.round(totalMinutes))}</div>
              <div className="text-zinc-500">en {blocks.length} bloques</div>
              <ul className="mt-3 space-y-1 text-xs text-zinc-500">
                {Object.entries(BUSY_STYLE).map(([k, v]) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: v.bg }} /> {v.label}
                  </li>
                ))}
              </ul>
            </div>
            <button className="btn-primary w-full" onClick={apply} disabled={loading || blocks.length === 0}>
              Reservar {blocks.length} bloques
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
