"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, hhmmToMinutes, minutesToHHMM, WEEKDAYS } from "@/lib/client";
import type { Me, MissionItem } from "@/lib/types";
import { Modal } from "./Modal";

const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

function schedule(m: MissionItem) {
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => m.weekdays.includes(d)).map((d) => WEEKDAYS[d]);
  const hours = m.startMinute != null && m.endMinute != null ? `${minutesToHHMM(m.startMinute)}–${minutesToHHMM(m.endMinute)}` : "";
  const range = [m.startsOn && `desde ${fmtDay(m.startsOn)}`, m.endsOn && `hasta ${fmtDay(m.endsOn)}`].filter(Boolean).join(" ");
  return `${days.join(", ")} · ${hours}${range ? ` · ${range}` : ""}`;
}

export function MissionsManager({ me, missions }: { me: Me; missions: MissionItem[] }) {
  const router = useRouter();
  const isAdmin = me.role === "ADMIN";
  const [editing, setEditing] = useState<MissionItem | "new" | null>(null);
  const reminders = missions.filter((m) => m.type === "REMINDER");
  const recurring = missions.filter((m) => m.type === "RECURRING");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Misiones generales</h1>
          <p className="mt-1 text-sm text-zinc-500">Recordatorios relevantes del club y sesiones generales que se repiten cada semana.</p>
        </div>
        {isAdmin && <button className="btn-primary" onClick={() => setEditing("new")}>+ Nueva misión</button>}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Recordatorios</h2>
        {reminders.length === 0 && <p className="card p-6 text-sm text-zinc-500">No hay recordatorios por ahora.</p>}
        {reminders.map((m) => (
          <article key={m.id} className={`card p-5 ${m.active ? "" : "opacity-50"} ${m.pinned ? "border-amber-300 bg-amber-50/60" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{m.pinned && "📌 "}{m.title}</h3>
                {m.dueDate && (
                  <p className={`mt-0.5 text-sm first-letter:uppercase ${new Date(m.dueDate) < new Date(new Date().toDateString()) ? "text-zinc-400 line-through" : "text-brand"}`}>
                    {fmtDay(m.dueDate)}
                  </p>
                )}
              </div>
              {isAdmin && <button className="btn-ghost py-1" onClick={() => setEditing(m)}>Editar</button>}
            </div>
            {m.description && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{m.description}</p>}
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Sesiones generales recurrentes</h2>
        {recurring.length === 0 && <p className="card p-6 text-sm text-zinc-500">No hay sesiones generales definidas.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {recurring.map((m) => (
            <article key={m.id} className={`card p-5 ${m.active ? "" : "opacity-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">⭐ {m.title}</h3>
                  <p className="mt-0.5 text-sm text-zinc-600">{schedule(m)}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{m.kind === "ASYNC" ? "🌐 Remota" : "🎛️ En el lab"}{m.active ? "" : " · inactiva"}</p>
                </div>
                {isAdmin && <button className="btn-ghost py-1" onClick={() => setEditing(m)}>Editar</button>}
              </div>
              {m.description && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{m.description}</p>}
            </article>
          ))}
        </div>
      </section>

      {editing && (
        <MissionDialog
          mission={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function MissionDialog({ mission, onClose, onSaved }: { mission: MissionItem | null; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<MissionItem["type"]>(mission?.type ?? "REMINDER");
  const [title, setTitle] = useState(mission?.title ?? "");
  const [description, setDescription] = useState(mission?.description ?? "");
  const [pinned, setPinned] = useState(mission?.pinned ?? false);
  const [active, setActive] = useState(mission?.active ?? true);
  const [dueDate, setDueDate] = useState(dateOnly(mission?.dueDate ?? null));
  const [weekdays, setWeekdays] = useState<number[]>(mission?.weekdays ?? []);
  const [start, setStart] = useState(minutesToHHMM(mission?.startMinute ?? 18 * 60));
  const [end, setEnd] = useState(minutesToHHMM(mission?.endMinute ?? 19 * 60));
  const [startsOn, setStartsOn] = useState(dateOnly(mission?.startsOn ?? null));
  const [endsOn, setEndsOn] = useState(dateOnly(mission?.endsOn ?? null));
  const [kind, setKind] = useState<"LAB" | "ASYNC">(mission?.kind === "ASYNC" ? "ASYNC" : "LAB");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const asDate = (d: string) => (d ? `${d}T00:00:00Z` : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      title,
      description: description || null,
      type,
      pinned,
      active,
      dueDate: asDate(dueDate),
      weekdays,
      startMinute: hhmmToMinutes(start),
      endMinute: hhmmToMinutes(end),
      startsOn: asDate(startsOn),
      endsOn: asDate(endsOn),
      kind,
    };
    try {
      await api(mission ? `/api/missions/${mission.id}` : "/api/missions", { method: mission ? "PUT" : "POST", body });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!mission || !confirm(`¿Eliminar "${mission.title}"?`)) return;
    try {
      await api(`/api/missions/${mission.id}`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title={mission ? "Editar misión" : "Nueva misión general"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 rounded-lg bg-zinc-100 p-1 text-sm font-medium">
          {(["REMINDER", "RECURRING"] as const).map((t) => (
            <button type="button" key={t} onClick={() => setType(t)} className={`rounded-md py-1.5 ${type === t ? "bg-white shadow-sm" : "text-zinc-500"}`}>
              {t === "REMINDER" ? "📌 Recordatorio" : "🔁 Sesión recurrente"}
            </button>
          ))}
        </div>
        <div>
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={140}
            placeholder={type === "REMINDER" ? "Ej. Entregar mezclas del EP" : "Ej. Junta general del club"} />
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
        </div>

        {type === "REMINDER" ? (
          <div>
            <label className="label">Fecha (opcional)</label>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        ) : (
          <>
            <div>
              <label className="label">Se repite los</label>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = weekdays.includes(d);
                  return (
                    <button type="button" key={d}
                      onClick={() => setWeekdays(on ? weekdays.filter((x) => x !== d) : [...weekdays, d])}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? "border-brand bg-brand text-white" : "border-zinc-300 text-zinc-600"}`}>
                      {WEEKDAYS[d]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Desde</label>
                <input className="input" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} required />
              </div>
              <div>
                <label className="label">Hasta</label>
                <input className="input" type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} required />
              </div>
              <div>
                <label className="label">Empieza el</label>
                <input className="input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </div>
              <div>
                <label className="label">Termina el</label>
                <input className="input" type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              {(["LAB", "ASYNC"] as const).map((k) => (
                <label key={k} className="inline-flex items-center gap-2">
                  <input type="radio" className="accent-brand" checked={kind === k} onChange={() => setKind(k)} />
                  {k === "LAB" ? "En el lab" : "Remota"}
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          {type === "REMINDER" && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="accent-brand" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Fijar arriba del calendario
            </label>
          )}
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="accent-brand" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Activa
          </label>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          {mission && <button type="button" className="btn-danger mr-auto" onClick={remove}>Eliminar</button>}
          <button className="btn-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}
