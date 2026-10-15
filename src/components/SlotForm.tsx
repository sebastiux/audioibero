"use client";

import { useState } from "react";
import { fromInputs, toDateInput, toTimeInput } from "@/lib/client";
import type { ProjectOption, SlotKind, UserOption } from "@/lib/types";

export type SlotFormValue = {
  userId: string;
  start: Date;
  end: Date;
  kind: SlotKind;
  projectId: string | null;
  notes: string;
};

type Props = {
  initial: SlotFormValue;
  /** Si se pasa, se muestra el selector de miembro (sólo admin). */
  users?: UserOption[];
  projects: ProjectOption[];
  submitLabel: string;
  onSubmit: (value: SlotFormValue) => Promise<void>;
  children?: React.ReactNode;
};

export function SlotForm({ initial, users, projects, submitLabel, onSubmit, children }: Props) {
  const [userId, setUserId] = useState(initial.userId);
  const [date, setDate] = useState(toDateInput(initial.start));
  const [startTime, setStartTime] = useState(toTimeInput(initial.start));
  const [endTime, setEndTime] = useState(toTimeInput(initial.end));
  const [kind, setKind] = useState<SlotKind>(initial.kind);
  const [projectId, setProjectId] = useState(initial.projectId ?? "");
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Un miembro sólo ve sus proyectos; el admin ve los del miembro seleccionado primero.
  const projectChoices = users
    ? [...projects].sort((a, b) => Number(b.memberIds.includes(userId)) - Number(a.memberIds.includes(userId)))
    : projects;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const start = fromInputs(date, startTime);
    const end = fromInputs(date, endTime === "00:00" ? "23:59" : endTime);
    if (end <= start) return setError("La hora de fin debe ser posterior a la de inicio");
    if (kind === "PROJECT" && !projectId) return setError("Elige un proyecto");
    setSaving(true);
    try {
      await onSubmit({ userId, start, end, kind, projectId: kind === "PROJECT" ? projectId : null, notes });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {users && (
        <div>
          <label className="label">Miembro</label>
          <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="" disabled>Selecciona…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Día</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label">Desde</label>
          <input className="input" type="time" step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input className="input" type="time" step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="label">¿Para qué?</label>
        <div className="grid grid-cols-2 gap-2">
          {(["LAB", "PROJECT"] as const).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${kind === k ? "border-brand bg-brand/5 text-brand" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
            >
              {k === "LAB" ? "🎛️ Trabajar en el lab" : "🎧 Proyecto de equipo"}
            </button>
          ))}
        </div>
      </div>
      {kind === "PROJECT" && (
        <div>
          <label className="label">Proyecto</label>
          {projectChoices.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No perteneces a ningún proyecto activo. Pide a un admin que te agregue.
            </p>
          ) : (
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {projectChoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {users && userId && !p.memberIds.includes(userId) ? " (no es integrante)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <div>
        <label className="label">Notas (opcional)</label>
        <textarea className="input min-h-16" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. mezcla de la pista 3, necesito la consola" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
        <button className="btn-primary" disabled={saving}>{saving ? "Guardando…" : submitLabel}</button>
      </div>
    </form>
  );
}
