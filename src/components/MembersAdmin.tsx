"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, formatHours, hhmmToMinutes, minutesToHHMM, WEEKDAYS } from "@/lib/client";
import { Modal } from "./Modal";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "MEMBER" | "ADMIN";
  active: boolean;
  createdAt: string;
  weekMinutes: number;
};

type Settings = {
  capacity: number;
  openMinute: number;
  closeMinute: number;
  openDays: number[];
  slotMinutes: number;
  minSessionMinutes: number;
  maxWeeklyMinutes: number;
};

export function MembersAdmin({ meId, users, settings }: { meId: string; users: UserRow[]; settings: Settings }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()));

  async function update(id: string, body: Partial<Pick<UserRow, "role" | "active">>) {
    try {
      await api(`/api/users/${id}`, { method: "PATCH", body });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Miembros</h1>
            <p className="mt-1 text-sm text-zinc-500">{users.filter((u) => u.active).length} activos · horas asignadas esta semana</p>
          </div>
          <div className="flex gap-2">
            <input className="input w-48" placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn-primary" onClick={() => setAdding(true)}>+ Alta</button>
          </div>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Semana</th>
                <th className="px-4 py-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}{u.id === meId && <span className="ml-1 text-zinc-400">(tú)</span>}</div>
                    <div className="text-xs text-zinc-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="input w-auto py-1"
                      value={u.role}
                      disabled={u.id === meId}
                      onChange={(e) => update(u.id, { role: e.target.value as UserRow["role"] })}
                    >
                      <option value="MEMBER">Miembro</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">{formatHours(u.weekMinutes)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost py-1" disabled={u.id === meId} onClick={() => update(u.id, { active: !u.active })}>
                      {u.active ? "Desactivar" : "Reactivar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <SettingsForm settings={settings} onSaved={() => router.refresh()} />

      {adding && (
        <AddMemberDialog
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function SettingsForm({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((cur) => ({ ...cur, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api("/api/settings", { method: "PUT", body: s });
      setMsg({ ok: true, text: "Configuración guardada" });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card h-fit space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Reglas del laboratorio</h2>
        <p className="text-xs text-zinc-500">Se usan en el calendario y al generar el calendario recomendado.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Abre</label>
          <input className="input" type="time" value={minutesToHHMM(s.openMinute)} onChange={(e) => set("openMinute", hhmmToMinutes(e.target.value))} required />
        </div>
        <div>
          <label className="label">Cierra</label>
          <input className="input" type="time" value={minutesToHHMM(s.closeMinute)} onChange={(e) => set("closeMinute", hhmmToMinutes(e.target.value))} required />
        </div>
      </div>
      <div>
        <label className="label">Días abiertos</label>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = s.openDays.includes(d);
            return (
              <button
                type="button"
                key={d}
                onClick={() => set("openDays", on ? s.openDays.filter((x) => x !== d) : [...s.openDays, d])}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? "border-brand bg-brand text-white" : "border-zinc-300 text-zinc-600"}`}
              >
                {WEEKDAYS[d]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Cupo simultáneo" value={s.capacity} min={1} max={100} onChange={(v) => set("capacity", v)} suffix="personas" />
        <div>
          <label className="label">Bloques de</label>
          <select className="input" value={s.slotMinutes} onChange={(e) => set("slotMinutes", Number(e.target.value))}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
        <NumberField label="Sesión mínima" value={s.minSessionMinutes} min={15} max={720} step={15} onChange={(v) => set("minSessionMinutes", v)} suffix="min" />
        <NumberField
          label="Tope semanal"
          value={s.maxWeeklyMinutes / 60}
          min={1}
          max={168}
          onChange={(v) => set("maxWeeklyMinutes", v * 60)}
          suffix="h / persona"
        />
      </div>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <button className="btn-dark w-full" disabled={saving}>{saving ? "Guardando…" : "Guardar reglas"}</button>
    </form>
  );
}

function NumberField(props: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label">{props.label}</label>
      <div className="flex items-center gap-2">
        <input
          className="input"
          type="number"
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={(e) => props.onChange(Number(e.target.value))}
          required
        />
        <span className="shrink-0 text-xs text-zinc-500">{props.suffix}</span>
      </div>
    </div>
  );
}

function AddMemberDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/users", { body: Object.fromEntries(new FormData(e.currentTarget)) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal title="Dar de alta a un miembro" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input className="input" name="name" required minLength={2} />
        </div>
        <div>
          <label className="label">Correo</label>
          <input className="input" name="email" type="email" required />
        </div>
        <div>
          <label className="label">Contraseña temporal</label>
          <input className="input" name="password" type="text" required minLength={8} />
        </div>
        <div>
          <label className="label">Perfil</label>
          <select className="input" name="role" defaultValue="MEMBER">
            <option value="MEMBER">Miembro</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end">
          <button className="btn-primary" disabled={saving}>{saving ? "Guardando…" : "Dar de alta"}</button>
        </div>
      </form>
    </Modal>
  );
}
