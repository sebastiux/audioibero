"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import type { Me, MissionItem, UserOption } from "@/lib/types";
import { ActivityDialog, activitySchedule, fmtDay } from "./ActivityDialog";
import { Modal } from "./Modal";

export type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  memberIds: string[];
};

const PALETTE = ["#c8102e", "#7c3aed", "#2563eb", "#0891b2", "#059669", "#ca8a04", "#ea580c", "#db2777"];

type ActivityEdit = { mission: MissionItem | null; projectId: string | null; type: MissionItem["type"] };

/** Sesiones fijas y recordatorios de un proyecto (o de todo el club). */
function Activities({
  items,
  isAdmin,
  projectId,
  onEdit,
}: {
  items: MissionItem[];
  isAdmin: boolean;
  projectId: string | null;
  onEdit: (e: ActivityEdit) => void;
}) {
  const sessions = items.filter((m) => m.type === "RECURRING");
  const reminders = items.filter((m) => m.type === "REMINDER");
  if (!isAdmin && items.length === 0) return null;
  const today = new Date(new Date().toDateString());
  return (
    <div className="mt-4 space-y-3 border-t border-zinc-100 pt-3 text-sm">
      {(sessions.length > 0 || isAdmin) && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">🔁 Sesiones fijas</span>
            {isAdmin && (
              <button className="text-xs font-medium text-brand hover:underline" onClick={() => onEdit({ mission: null, projectId, type: "RECURRING" })}>
                + Agregar
              </button>
            )}
          </div>
          {sessions.length === 0 && <p className="text-xs text-zinc-400">Sin sesiones fijas.</p>}
          <ul className="space-y-1">
            {sessions.map((m) => (
              <li key={m.id} className={`flex items-start justify-between gap-2 ${m.active ? "" : "opacity-50"}`}>
                <span>
                  <b>{m.title}</b> <span className="text-zinc-500">· {activitySchedule(m)}{m.kind === "ASYNC" ? " · remota" : ""}</span>
                </span>
                {isAdmin && (
                  <button className="shrink-0 text-xs text-zinc-500 hover:underline" onClick={() => onEdit({ mission: m, projectId, type: m.type })}>
                    Editar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(reminders.length > 0 || isAdmin) && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">📌 Recordatorios</span>
            {isAdmin && (
              <button className="text-xs font-medium text-brand hover:underline" onClick={() => onEdit({ mission: null, projectId, type: "REMINDER" })}>
                + Agregar
              </button>
            )}
          </div>
          {reminders.length === 0 && <p className="text-xs text-zinc-400">Sin recordatorios.</p>}
          <ul className="space-y-1.5">
            {reminders.map((m) => (
              <li key={m.id} className={`flex items-start justify-between gap-2 ${m.active ? "" : "opacity-50"}`}>
                <span>
                  {m.pinned && "📌 "}
                  <b>{m.title}</b>
                  {m.dueDate && (
                    <span className={`first-letter:uppercase ${new Date(m.dueDate) < today ? "text-zinc-400 line-through" : "text-brand"}`}>
                      {" "}· {fmtDay(m.dueDate)}
                    </span>
                  )}
                  {m.description && <span className="block whitespace-pre-wrap text-xs text-zinc-600">{m.description}</span>}
                </span>
                {isAdmin && (
                  <button className="shrink-0 text-xs text-zinc-500 hover:underline" onClick={() => onEdit({ mission: m, projectId, type: m.type })}>
                    Editar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ProjectsManager({
  me,
  projects,
  users,
  activities,
}: {
  me: Me;
  projects: ProjectRow[];
  users: UserOption[];
  activities: MissionItem[];
}) {
  const router = useRouter();
  const isAdmin = me.role === "ADMIN";
  const [editing, setEditing] = useState<ProjectRow | "new" | null>(null);
  const [activity, setActivity] = useState<ActivityEdit | null>(null);
  const clubActivities = activities.filter((a) => a.projectId === null);
  const [showArchived, setShowArchived] = useState(false);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const visible = projects.filter((p) => showArchived || p.active);

  async function toggleActive(p: ProjectRow) {
    try {
      await api(`/api/projects/${p.id}`, { method: "PATCH", body: { active: !p.active } });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proyectos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Proyectos de equipo del club. Cada uno tiene sus sesiones fijas (se repiten cada semana) y recordatorios; además puedes
            abrir sesiones extra en el calendario y tu equipo se une al mismo horario.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" className="accent-brand" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Ver archivados
          </label>
          {isAdmin && <button className="btn-primary" onClick={() => setEditing("new")}>+ Nuevo proyecto</button>}
        </div>
      </div>

      {(isAdmin || clubActivities.length > 0) && (
        <article className="card p-5">
          <h2 className="font-semibold">Todo el club</h2>
          <p className="text-sm text-zinc-500">Sesiones y recordatorios que aplican a todos los miembros.</p>
          <Activities items={clubActivities} isAdmin={isAdmin} projectId={null} onEdit={setActivity} />
        </article>
      )}

      {visible.length === 0 && (
        <div className="card p-10 text-center text-sm text-zinc-500">
          Aún no hay proyectos{isAdmin ? ". Da de alta el primero." : "."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => {
          const mine = p.memberIds.includes(me.id);
          return (
            <article key={p.id} className={`card flex flex-col overflow-hidden ${p.active ? "" : "opacity-60"}`}>
              <div className="h-1.5" style={{ background: p.color }} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{p.name}</h2>
                  <div className="flex shrink-0 gap-1">
                    {mine && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Tu equipo</span>}
                    {!p.active && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">Archivado</span>}
                  </div>
                </div>
                {p.description && <p className="mt-2 line-clamp-3 text-sm text-zinc-600">{p.description}</p>}
                {(p.startDate || p.endDate) && (
                  <p className="mt-2 text-xs text-zinc-500">
                    {p.startDate ? new Date(p.startDate).toLocaleDateString("es-MX", { timeZone: "UTC" }) : "…"} →{" "}
                    {p.endDate ? new Date(p.endDate).toLocaleDateString("es-MX", { timeZone: "UTC" }) : "…"}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.memberIds.length === 0 && <span className="text-xs text-zinc-400">Sin integrantes</span>}
                  {p.memberIds.map((id) => (
                    <span key={id} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">{userName.get(id) ?? "Inactivo"}</span>
                  ))}
                </div>
                <Activities
                  items={activities.filter((a) => a.projectId === p.id)}
                  isAdmin={isAdmin}
                  projectId={p.id}
                  onEdit={setActivity}
                />
                {isAdmin && (
                  <div className="mt-auto flex gap-2 pt-5">
                    <button className="btn-ghost py-1.5" onClick={() => setEditing(p)}>Editar</button>
                    <button className="btn-ghost py-1.5" onClick={() => toggleActive(p)}>{p.active ? "Archivar" : "Reactivar"}</button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {activity && (
        <ActivityDialog
          mission={activity.mission}
          projectId={activity.projectId}
          defaultType={activity.type}
          onClose={() => setActivity(null)}
          onSaved={() => {
            setActivity(null);
            router.refresh();
          }}
        />
      )}

      {editing && (
        <ProjectDialog
          project={editing === "new" ? null : editing}
          users={users}
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

function ProjectDialog({
  project,
  users,
  onClose,
  onSaved,
}: {
  project: ProjectRow | null;
  users: UserOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState(project?.color ?? PALETTE[1]);
  const [startDate, setStartDate] = useState(project?.startDate ? project.startDate.slice(0, 10) : "");
  const [endDate, setEndDate] = useState(project?.endDate ? project.endDate.slice(0, 10) : "");
  const [memberIds, setMemberIds] = useState<string[]>(project?.memberIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name,
      description: description || null,
      color,
      startDate: startDate ? `${startDate}T00:00:00Z` : null,
      endDate: endDate ? `${endDate}T00:00:00Z` : null,
      memberIds,
    };
    try {
      await api(project ? `/api/projects/${project.id}` : "/api/projects", { method: project ? "PATCH" : "POST", body });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!project || !confirm(`¿Eliminar "${project.name}"? Sus horarios quedarán como trabajo de lab.`)) return;
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title={project ? "Editar proyecto" : "Nuevo proyecto"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap items-center gap-2">
            {PALETTE.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full ring-offset-2 ${color === c ? "ring-2 ring-zinc-900" : ""}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 cursor-pointer" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Inicio</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Entrega</label>
            <input className="input" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Integrantes ({memberIds.length})</label>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2">
            {users.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-50">
                <input type="checkbox" className="accent-brand" checked={memberIds.includes(u.id)} onChange={() => toggle(u.id)} />
                {u.name}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          {project && <button type="button" className="btn-danger mr-auto" onClick={remove}>Eliminar</button>}
          <button className="btn-primary" disabled={saving}>{saving ? "Guardando…" : project ? "Guardar" : "Dar de alta"}</button>
        </div>
      </form>
    </Modal>
  );
}

