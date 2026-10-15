"use client";

import { useState } from "react";
import { fromInputs, toDateInput, toTimeInput } from "@/lib/client";
import type { ProjectOption, SlotKind, UserOption } from "@/lib/types";

const KIND_LABEL = { LAB: "🎛️ Lab", PROJECT: "🎧 Sesión de proyecto", ASYNC: "🌐 Asíncrono" } as const;

export type SlotFormValue = {
  participantIds: string[];
  start: Date;
  end: Date;
  kind: SlotKind;
  projectId: string | null;
  notes: string;
};

type Props = {
  initial: SlotFormValue;
  /** Si se pasa, se muestra el selector de participantes (sólo admin). */
  users?: UserOption[];
  projects: ProjectOption[];
  submitLabel: string;
  onSubmit: (value: SlotFormValue) => Promise<void>;
  children?: React.ReactNode;
};

export function SlotForm({ initial, users, projects, submitLabel, onSubmit, children }: Props) {
  const [participantIds, setParticipantIds] = useState(initial.participantIds);
  const [date, setDate] = useState(toDateInput(initial.start));
  const [startTime, setStartTime] = useState(toTimeInput(initial.start));
  const [endTime, setEndTime] = useState(toTimeInput(initial.end));
  const [kind, setKind] = useState<SlotKind>(initial.kind);
  const [projectId, setProjectId] = useState(initial.projectId ?? "");
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleUser = (id: string) =>
    setParticipantIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  function pickProject(id: string) {
    setProjectId(id);
    // Admin: al elegir proyecto propone a todo el equipo como participantes.
    const project = projects.find((p) => p.id === id);
    if (users && project && participantIds.length <= 1) setParticipantIds(project.memberIds);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const start = fromInputs(date, startTime);
    const end = fromInputs(date, endTime === "00:00" ? "23:59" : endTime);
    if (end <= start) return setError("La hora de fin debe ser posterior a la de inicio");
    if (kind === "PROJECT" && !projectId) return setError("Elige un proyecto");
    if (users && participantIds.length === 0) return setError("Elige al menos a un miembro");
    setSaving(true);
    try {
      await onSubmit({ participantIds, start, end, kind, projectId: kind !== "LAB" && projectId ? projectId : null, notes });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
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
        <div className="grid grid-cols-3 gap-2">
          {(["LAB", "PROJECT", "ASYNC"] as const).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${kind === k ? "border-brand bg-brand/5 text-brand" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      {kind === "ASYNC" && (
        <p className="-mt-2 text-xs text-zinc-500">Trabajo remoto o fuera del lab: cuenta como horas pero no ocupa cupo.</p>
      )}
      {kind !== "LAB" && (
        <div>
          <label className="label">Proyecto{kind === "ASYNC" ? " (opcional)" : ""}</label>
          {projects.length === 0 && kind === "PROJECT" ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No perteneces a ningún proyecto activo. Pide a un admin que te agregue.
            </p>
          ) : (
            <select className="input" value={projectId} onChange={(e) => pickProject(e.target.value)} required={kind === "PROJECT"}>
              <option value="" disabled={kind === "PROJECT"}>{kind === "PROJECT" ? "Selecciona…" : "Sin proyecto"}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {kind === "PROJECT" && <p className="mt-1 text-xs text-zinc-500">Tu equipo podrá unirse a este horario desde el calendario.</p>}
        </div>
      )}
      {users && (
        <div>
          <label className="label">Participantes ({participantIds.length})</label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2">
            {users.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-50">
                <input type="checkbox" className="accent-brand" checked={participantIds.includes(u.id)} onChange={() => toggleUser(u.id)} />
                {u.name}
              </label>
            ))}
          </div>
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
