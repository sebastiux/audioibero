"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventInput } from "@fullcalendar/core";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api, formatHours, minutesToHHMM, toDateInput, toTimeInput } from "@/lib/client";
import type { LabConfig } from "@/lib/types";

type Proposal = {
  projectId: string;
  projectName: string;
  projectColor: string;
  start: string;
  end: string;
  participantIds: string[];
  participants: { id: string; name: string }[];
  reason: string;
};

type Recommendation = {
  proposals: Proposal[];
  shortfall: { projectName: string; minutes: number }[];
  projectsWithoutMembers: string[];
};

function nextWeek() {
  const d = new Date();
  const monday = new Date(d);
  monday.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toDateInput(monday), to: toDateInput(sunday) };
}

export function RecommendPanel({
  lab,
}: {
  lab: LabConfig & { maxWeeklyMinutes: number; projectWeeklyMinutes: number; projectSessionMinutes: number };
}) {
  const initial = nextWeek();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [replace, setReplace] = useState(true);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const kept = useMemo(() => (result ? result.proposals.filter((_, i) => !removed.has(i)) : []), [result, removed]);

  async function generate(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const data = await api<Recommendation>("/api/schedule/recommend", { body: { from, to, replaceRecommended: replace } });
      setResult(data);
      setRemoved(new Set());
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  /** Ajuste manual: el admin arrastra o estira una sesión propuesta antes de aplicarla. */
  function moveProposal(index: number, start: Date | null, end: Date | null) {
    if (!start || !end) return;
    setResult((r) =>
      r ? { ...r, proposals: r.proposals.map((p, i) => (i === index ? { ...p, start: start.toISOString(), end: end.toISOString() } : p)) } : r,
    );
  }

  async function apply() {
    if (!result) return;
    if (!confirm(`Se crearán ${kept.length} sesiones de equipo${replace ? " y se reemplazarán las recomendadas previas del periodo" : ""}. ¿Continuar?`)) return;
    setLoading(true);
    try {
      const res = await api<{ created: number; removed: number; skipped: number }>("/api/schedule/apply", {
        body: { from, to, replaceRecommended: replace, proposals: kept },
      });
      setMessage({
        ok: true,
        text: `Listo: ${res.created} sesiones creadas${res.removed ? `, ${res.removed} recomendadas anteriores reemplazadas` : ""}${res.skipped ? `, ${res.skipped} omitidas por choques` : ""}.`,
      });
      setResult(null);
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const events: EventInput[] = (result?.proposals ?? []).flatMap((p, i) =>
    removed.has(i)
      ? []
      : [
          {
            id: String(i),
            start: p.start,
            end: p.end,
            title: `${p.projectName} · ${p.participants.map((u) => u.name.split(" ")[0]).join(", ")}`,
            backgroundColor: p.projectColor,
            borderColor: p.projectColor,
            classNames: ["ev-proposal"],
            editable: true,
          },
        ],
  );

  const stats = useMemo(() => {
    const m = new Map<string, { name: string; minutes: number }>();
    for (const p of kept) {
      for (const u of p.participants) {
        const cur = m.get(u.id) ?? { name: u.name, minutes: 0 };
        cur.minutes += (new Date(p.end).getTime() - new Date(p.start).getTime()) / 60000;
        m.set(u.id, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.minutes - a.minutes);
  }, [kept]);
  const maxMinutes = Math.max(1, ...stats.map((s) => s.minutes));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Calendario recomendado</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Propone sesiones de equipo para cada proyecto activo ({formatHours(lab.projectWeeklyMinutes)} a la semana en bloques de{" "}
          {formatHours(lab.projectSessionMinutes)}). Busca horarios en los que el equipo no tenga otras reservas, repartidos en días
          distintos y en las horas menos ocupadas, sin rebasar el cupo ({lab.capacity}), el horario ({minutesToHHMM(lab.openMinute)}–
          {minutesToHHMM(lab.closeMinute)}) ni el tope de {formatHours(lab.maxWeeklyMinutes)} por persona.{" "}
          <Link href="/admin/miembros" className="font-medium text-brand hover:underline">Ajustar reglas</Link>
        </p>
      </div>

      <form onSubmit={generate} className="card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="label">Desde</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
        </div>
        <label className="inline-flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" className="accent-brand" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Reemplazar sesiones recomendadas previas
        </label>
        <button className="btn-dark sm:ml-auto" disabled={loading}>{loading ? "Calculando…" : "Generar propuesta"}</button>
      </form>

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Sesiones propuestas" value={String(kept.length)} />
            <Stat label="Horas de equipo" value={formatHours(Math.round(kept.reduce((a, p) => a + (new Date(p.end).getTime() - new Date(p.start).getTime()) / 60000, 0)))} />
            <Stat label="Miembros con sesión" value={String(stats.length)} />
          </div>

          {(result.shortfall.length > 0 || result.projectsWithoutMembers.length > 0) && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {result.shortfall.map((s) => (
                <p key={s.projectName}>
                  <b>{s.projectName}</b>: faltaron {formatHours(s.minutes)} (no hubo horario libre suficiente para el equipo).
                </p>
              ))}
              {result.projectsWithoutMembers.length > 0 && (
                <p>Sin integrantes, no se agendan: {result.projectsWithoutMembers.join(", ")}.</p>
              )}
            </div>
          )}

          {result.proposals.length === 0 ? (
            <div className="card p-10 text-center text-sm text-zinc-500">
              No hay sesiones que proponer. Revisa que haya proyectos activos con integrantes y horas por proyecto configuradas.
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="card p-3">
                <p className="mb-2 px-1 text-xs text-zinc-500">Arrastra o estira las sesiones para ajustar sus horas · clic en una sesión para quitarla de la propuesta.</p>
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
                  slotMinTime={minutesToHHMM(Math.max(0, lab.openMinute - 60))}
                  slotMaxTime={minutesToHHMM(Math.min(1439, lab.closeMinute + 60))}
                  events={events}
                  snapDuration="00:15:00"
                  eventDrop={(arg) => moveProposal(Number(arg.event.id), arg.event.start, arg.event.end)}
                  eventResize={(arg) => moveProposal(Number(arg.event.id), arg.event.start, arg.event.end)}
                  eventClick={(arg) => {
                    const i = Number(arg.event.id);
                    const p = result.proposals[i];
                    if (confirm(`¿Quitar la sesión de ${p.projectName} (${toTimeInput(new Date(p.start))}–${toTimeInput(new Date(p.end))}) de la propuesta?`)) {
                      setRemoved((s) => new Set(s).add(i));
                    }
                  }}
                  eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                  slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                />
              </div>
              <aside className="space-y-4">
                <div className="card p-4">
                  <h2 className="mb-3 text-sm font-semibold">Horas de equipo por miembro</h2>
                  <ul className="space-y-2.5">
                    {stats.map((s) => (
                      <li key={s.name} className="text-sm">
                        <div className="flex justify-between">
                          <span>{s.name}</span>
                          <span className="font-medium">{formatHours(Math.round(s.minutes))}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-zinc-100">
                          <div className="h-1.5 rounded-full bg-brand" style={{ width: `${(s.minutes / maxMinutes) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <button className="btn-primary w-full" onClick={apply} disabled={loading || kept.length === 0}>
                  Aplicar {kept.length} sesiones
                </button>
                {removed.size > 0 && (
                  <button className="btn-ghost w-full" onClick={() => setRemoved(new Set())}>Restaurar {removed.size} quitadas</button>
                )}
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
