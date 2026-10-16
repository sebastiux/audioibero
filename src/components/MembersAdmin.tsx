"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, fmtDate, formatHours, hhmmToMinutes, minutesToHHMM, WEEKDAYS } from "@/lib/client";
import { Modal } from "./Modal";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "MEMBER" | "ADMIN";
  active: boolean;
  createdAt: string;
  weekMinutes: number;
  /** Aún no define su contraseña desde el correo de invitación */
  pending: boolean;
  invitedAt: string | null;
};

type Settings = {
  openMinute: number;
  closeMinute: number;
  openDays: number[];
  slotMinutes: number;
};

export function MembersAdmin({ meId, users, settings }: { meId: string; users: UserRow[]; settings: Settings }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()));

  const [notice, setNotice] = useState<InviteNotice | null>(null);

  async function resend(u: UserRow) {
    try {
      const res = await api<InviteResult & { kind: "invite" | "reset" }>(`/api/users/${u.id}/invite`, { method: "POST" });
      setNotice({ email: u.email, ...res });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

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
            <p className="mt-1 text-sm text-zinc-500">{users.filter((u) => u.active).length} activos · horas registradas esta semana</p>
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
                    {u.pending && (
                      <div className="mt-0.5 text-xs font-medium text-amber-700">
                        ✉️ Invitación pendiente{u.invitedAt ? ` · enviada el ${fmtDate(u.invitedAt, { day: "numeric", month: "short" })}` : ""}
                      </div>
                    )}
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
                  <td className="space-x-1 whitespace-nowrap px-4 py-3 text-right">
                    {u.active && u.id !== meId && (
                      <button className="btn-ghost py-1" onClick={() => resend(u)} title={u.pending ? "Reenviar el correo de invitación" : "Enviar enlace para cambiar contraseña"}>
                        {u.pending ? "Reenviar invitación" : "Enlace de contraseña"}
                      </button>
                    )}
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

      <div className="space-y-6">
        <SettingsForm settings={settings} onSaved={() => router.refresh()} />
        <EmailCard />
      </div>

      {adding && (
        <AddMemberDialog
          onClose={() => setAdding(false)}
          onSaved={(n) => {
            setAdding(false);
            setNotice(n);
            router.refresh();
          }}
        />
      )}

      {notice && <InviteNoticeDialog notice={notice} onClose={() => setNotice(null)} />}
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
        <p className="text-xs text-zinc-500">Se usan en el calendario y al proponer horarios en Mi plan.</p>
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
        <div>
          <label className="label">Bloques de</label>
          <select className="input" value={s.slotMinutes} onChange={(e) => set("slotMinutes", Number(e.target.value))}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
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

type InviteResult = { emailSent: boolean; emailConfigured: boolean; link?: string; emailError?: string };
type InviteNotice = InviteResult & { email: string; kind?: "invite" | "reset" };

function AddMemberDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (n: InviteNotice) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const body = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const res = await api<InviteResult>("/api/users", { body });
      onSaved({ email: body.email, kind: "invite", ...res });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal title="Dar de alta a un miembro" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-zinc-500">
          Le llegará un correo con un enlace para activar su cuenta y definir su contraseña (vale 7 días).
        </p>
        <div>
          <label className="label">Nombre</label>
          <input className="input" name="name" required minLength={2} />
        </div>
        <div>
          <label className="label">Correo</label>
          <input className="input" name="email" type="email" required placeholder="nombre@correo.ibero.mx" />
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
          <button className="btn-primary" disabled={saving}>{saving ? "Enviando invitación…" : "Dar de alta y enviar invitación"}</button>
        </div>
      </form>
    </Modal>
  );
}

function InviteNoticeDialog({ notice, onClose }: { notice: InviteNotice; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const what = notice.kind === "reset" ? "el enlace para cambiar su contraseña" : "la invitación";
  return (
    <Modal title={notice.emailSent ? "Correo enviado" : "No se pudo enviar el correo"} onClose={onClose}>
      {notice.emailSent ? (
        <p className="text-sm">
          Enviamos {what} a <b>{notice.email}</b>. Si no le llega, que revise spam o reenvíala desde la tabla.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            {notice.emailConfigured ? "Resend rechazó el envío." : "El correo no está configurado (falta RESEND_API_KEY)."}
            {notice.link ? " Mientras tanto, comparte este enlace con la persona:" : ""}
          </p>
          {notice.emailError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{notice.emailError}</p>}
          {notice.link && (
            <div className="flex gap-2">
              <input className="input text-xs" readOnly value={notice.link} onFocus={(e) => e.target.select()} />
              <button
                className="btn-dark shrink-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(notice.link!);
                  setCopied(true);
                }}
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <button className="btn-primary" onClick={onClose}>Listo</button>
      </div>
    </Modal>
  );
}

/** Estado del correo (Resend) y botón para mandarse un correo de prueba. */
function EmailCard() {
  const [status, setStatus] = useState<{ configured: boolean; from: string; appUrl: string } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api<{ configured: boolean; from: string; appUrl: string }>("/api/admin/email-test").then(setStatus).catch(() => null);
  }, []);

  async function test() {
    setSending(true);
    setResult(null);
    try {
      const r = await api<{ sent: number; configured: boolean; error?: string; to: string }>("/api/admin/email-test", { method: "POST" });
      setResult(
        r.sent > 0
          ? { ok: true, text: `Enviado a ${r.to}. Si no llega en un par de minutos, revisa spam y el registro de envíos en resend.com/emails.` }
          : { ok: false, text: r.configured ? (r.error ?? "Resend rechazó el envío.") : "Falta RESEND_API_KEY en las variables de la app." },
      );
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card space-y-3 p-5 text-sm">
      <div>
        <h2 className="font-semibold">Correo (Resend)</h2>
        <p className="text-xs text-zinc-500">Invitaciones, recuperar contraseña y recordatorios.</p>
      </div>
      {status && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-zinc-500">Estado</dt>
          <dd className={status.configured ? "text-emerald-700" : "text-red-700"}>{status.configured ? "Configurado" : "Falta RESEND_API_KEY"}</dd>
          <dt className="text-zinc-500">Remitente</dt>
          <dd className="break-all">{status.from}</dd>
          <dt className="text-zinc-500">Enlaces a</dt>
          <dd className="break-all">{status.appUrl}</dd>
        </dl>
      )}
      {result && (
        <p className={`rounded-lg px-3 py-2 text-xs ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{result.text}</p>
      )}
      <button className="btn-ghost w-full" onClick={test} disabled={sending}>
        {sending ? "Enviando…" : "Enviarme un correo de prueba"}
      </button>
    </section>
  );
}
