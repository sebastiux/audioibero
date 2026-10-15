"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventInput } from "@fullcalendar/core";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api, formatHours, minutesToHHMM, toDateInput, toTimeInput } from "@/lib/client";
import type { LabConfig } from "@/lib/types";

type Proposal = {
  userId: string;
  userName: string;
  start: string;
  end: string;
  kind: "LAB" | "PROJECT";
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  reason: string;
};

type Recommendation = {
  proposals: Proposal[];
  stats: { userId: string; name: string; minutes: number }[];
  totalAvailabilities: number;
  unassignedCount: number;
};

function nextWeek() {
  const d = new Date();
  const monday = new Date(d);
  monday.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toDateInput(monday), to: toDateInput(sunday) };
}

export function RecommendPanel({ lab }: { lab: LabConfig & { minSessionMinutes: number; maxWeeklyMinutes: number } }) {
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

  async function apply() {
    if (!result) return;
    if (!confirm(`Se crearán ${kept.length} asignaciones${replace ? " y se reemplazarán las recomendadas previas del periodo" : ""}. ¿Continuar?`)) return;
    setLoading(true);
    try {
      const res = await api<{ created: number; removed: number; skipped: number }>("/api/schedule/apply", {
        body: { from, to, replaceRecommended: replace, proposals: kept },
      });
      setMessage({
        ok: true,
        text: `Listo: ${res.created} asignaciones creadas${res.removed ? `, ${res.removed} reemplazadas` : ""}${res.skipped ? `, ${res.skipped} omitidas por choques` : ""}.`,
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
            title: `${p.userName} · ${p.projectName ?? "Lab"}`,
            backgroundColor: p.projectColor ?? "#c8102e",
            borderColor: p.projectColor ?? "#c8102e",
            classNames: ["ev-proposal"],
          },
        ],
  );

  const stats = useMemo(() => {
    const m = new Map<string, { name: string; minutes: number }>();
    for (const p of kept) {
      const cur = m.get(p.userId) ?? { name: p.userName, minutes: 0 };
      cur.minutes += (new Date(p.end).getTime() - new Date(p.start).getTime()) / 60000;
      m.set(p.userId, cur);
    }
    return [...m.values()].sort((a, b) => b.minutes - a.minutes);
  }, [kept]);
  const maxMinutes = Math.max(1, ...stats.map((s) => s.minutes));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Calendario recomendado</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Genera una propuesta a partir de los espacios libres de los miembros: primero agenda sesiones donde coincide el equipo de cada
          proyecto y luego reparte el lab de forma equitativa. Respeta el cupo ({lab.capacity}), el horario ({minutesToHHMM(lab.openMinute)}–
          {minutesToHHMM(lab.closeMinute)}), sesiones de al menos {lab.minSessionMinutes} min y máximo {formatHours(lab.maxWeeklyMinutes)} por
          persona a la semana.{" "}
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
          Reemplazar asignaciones recomendadas previas
        </label>
        <button className="btn-dark sm:ml-auto" disabled={loading}>{loading ? "Calculando…" : "Generar propuesta"}</button>
      </form>

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Horarios propuestos" value={String(kept.length)} />
            <Stat label="Horas totales" value={formatHours(Math.round(stats.reduce((a, s) => a + s.minutes, 0)))} />
            <Stat label="Espacios libres sin cubrir" value={`${result.unassignedCount} de ${result.totalAvailabilities}`} />
          </div>

          {result.proposals.length === 0 ? (
            <div className="card p-10 text-center text-sm text-zinc-500">
              No hay espacios libres que se puedan asignar en ese periodo. Pide a los miembros que marquen su disponibilidad.
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="card p-3">
                <p className="mb-2 px-1 text-xs text-zinc-500">Haz clic en un horario para quitarlo de la propuesta.</p>
                <FullCalendar
                  key={from}
                  plugins={[timeGridPlugin]}
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
                  eventClick={(arg) => {
                    const i = Number(arg.event.id);
                    const p = result.proposals[i];
                    if (confirm(`Quitar a ${p.userName} (${toTimeInput(new Date(p.start))}–${toTimeInput(new Date(p.end))}) de la propuesta?`)) {
                      setRemoved((s) => new Set(s).add(i));
                    }
                  }}
                  eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                  slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                />
              </div>
              <aside className="space-y-4">
                <div className="card p-4">
                  <h2 className="mb-3 text-sm font-semibold">Horas por miembro</h2>
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
                  Aplicar {kept.length} asignaciones
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
