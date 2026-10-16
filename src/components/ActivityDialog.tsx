"use client";

import { useState } from "react";
import { api, hhmmToMinutes, minutesToHHMM, WEEKDAYS } from "@/lib/client";
import type { MissionItem } from "@/lib/types";
import { Modal } from "./Modal";

/** Actividades de proyecto: recordatorios y sesiones fijas que se repiten cada semana (las define el admin). */

const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

export function activitySchedule(m: MissionItem) {
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => m.weekdays.includes(d)).map((d) => WEEKDAYS[d]);
  const hours = m.startMinute != null && m.endMinute != null ? `${minutesToHHMM(m.startMinute)}–${minutesToHHMM(m.endMinute)}` : "";
  const range = [m.startsOn && `desde ${fmtDay(m.startsOn)}`, m.endsOn && `hasta ${fmtDay(m.endsOn)}`].filter(Boolean).join(" ");
  return `${days.join(", ")} · ${hours}${range ? ` · ${range}` : ""}`;
}

export function ActivityDialog({
  mission,
  projectId,
  defaultType = "REMINDER",
  onClose,
  onSaved,
}: {
  mission: MissionItem | null;
  /** Proyecto al que pertenece (null = todo el club) */
  projectId: string | null;
  defaultType?: MissionItem["type"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<MissionItem["type"]>(mission?.type ?? defaultType);
  const [title, setTitle] = useState(mission?.title ?? "");
  const [description, setDescription] = useState(mission?.description ?? "");
  const [pinned, setPinned] = useState(mission?.pinned ?? false);
  const [active, setActive] = useState(mission?.active ?? true);
  // Un recordatorio nuevo se envía por correo por defecto; al editar, sólo si se marca.
  const [notify, setNotify] = useState(!mission);
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
      projectId: mission ? mission.projectId : projectId,
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
      notify: type === "REMINDER" && notify,
    };
    try {
      const res = await api<{ email?: { sent: number; failed: number; configured: boolean; recipients: number; error?: string } }>(
        mission ? `/api/missions/${mission.id}` : "/api/missions",
        { method: mission ? "PUT" : "POST", body },
      );
      if (res.email && res.email.sent === 0 && res.email.recipients > 0) {
        alert(
          res.email.configured
            ? `Se guardó, pero Resend no pudo enviar el correo.\n\n${res.email.error ?? ""}`
            : "Se guardó, pero el correo no está configurado (falta RESEND_API_KEY).",
        );
      }
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
    <Modal title={mission ? "Editar actividad" : type === "RECURRING" ? "Nueva sesión fija" : "Nuevo recordatorio"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 rounded-lg bg-zinc-100 p-1 text-sm font-medium">
          {(["REMINDER", "RECURRING"] as const).map((t) => (
            <button type="button" key={t} onClick={() => setType(t)} className={`rounded-md py-1.5 ${type === t ? "bg-white shadow-sm" : "text-zinc-500"}`}>
              {t === "REMINDER" ? "📌 Recordatorio" : "🔁 Sesión fija semanal"}
            </button>
          ))}
        </div>
        <div>
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={140}
            placeholder={type === "REMINDER" ? "Ej. Entregar mezclas del EP" : "Ej. Ensayo del equipo"} />
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
          {type === "REMINDER" && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="accent-brand" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              📧 Enviar por correo al guardar
            </label>
          )}
        </div>
        {type === "REMINDER" && (
          <p className="-mt-2 text-xs text-zinc-500">
            Se envía a {projectId || mission?.projectId ? "los integrantes del proyecto" : "todo el club"}. Si tiene fecha, el día de la
            fecha se manda un aviso automático.
          </p>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          {mission && <button type="button" className="btn-danger mr-auto" onClick={remove}>Eliminar</button>}
          <button className="btn-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}
