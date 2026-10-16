"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Logo } from "./Logo";

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950 px-4">
      <div className="card w-full max-w-sm p-7">
        <Logo className="text-xl" />
        <h1 className="mt-5 text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}

const ErrorBox = ({ error }: { error: string | null }) =>
  error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null;

export function AuthForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/login", { body: Object.fromEntries(new FormData(e.currentTarget)) });
      router.replace("/calendario");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Shell title="Inicia sesión" subtitle="Registra cuándo vas a estar en el lab y ve quién coincide contigo.">
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <ErrorBox error={error} />
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Un momento…" : "Entrar"}</button>
      </form>
      <p className="mt-5 text-center text-sm">
        <Link className="font-medium text-brand hover:underline" href="/recuperar">¿Olvidaste tu contraseña?</Link>
      </p>
      <p className="mt-3 text-center text-xs text-zinc-500">
        Las cuentas las da de alta un admin del club; te llegará un correo para activarla.
      </p>
    </Shell>
  );
}

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/forgot", { body: Object.fromEntries(new FormData(e.currentTarget)) });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Recupera tu acceso" subtitle="Te enviaremos un enlace para crear una nueva contraseña.">
      {sent ? (
        <p className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Si el correo pertenece a una cuenta del club, en unos minutos te llegará el enlace. Revisa también spam.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Correo</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <ErrorBox error={error} />
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Enviando…" : "Enviar enlace"}</button>
        </form>
      )}
      <p className="mt-5 text-center text-sm">
        <Link className="font-medium text-brand hover:underline" href="/login">Volver a iniciar sesión</Link>
      </p>
    </Shell>
  );
}

export function SetPasswordForm({ token, name, isInvite }: { token: string; name: string; isInvite: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) return setError("Las contraseñas no coinciden");
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/activate", { body: { token, password } });
      router.replace("/mi-plan");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Shell
      title={isInvite ? `¡Hola, ${name.split(" ")[0]}!` : "Nueva contraseña"}
      subtitle={isInvite ? "Define tu contraseña para empezar a usar la plataforma del club." : "Escribe tu nueva contraseña."}
    >
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Repite la contraseña</label>
          <input className="input" id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <p className="text-xs text-zinc-500">Mínimo 8 caracteres.</p>
        <ErrorBox error={error} />
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Guardando…" : isInvite ? "Activar mi cuenta" : "Guardar contraseña"}</button>
      </form>
    </Shell>
  );
}

export function InvalidLink() {
  return (
    <Shell title="Enlace no válido" subtitle="El enlace ya se usó o venció.">
      <p className="mt-6 text-sm text-zinc-600">
        Pide un enlace nuevo desde <Link className="font-medium text-brand hover:underline" href="/recuperar">¿Olvidaste tu contraseña?</Link> o
        pídele a un admin del club que te reenvíe la invitación.
      </p>
    </Shell>
  );
}
