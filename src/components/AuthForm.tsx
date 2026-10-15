"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Logo } from "./Logo";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      await api(isLogin ? "/api/auth/login" : "/api/auth/register", { body: form });
      router.replace("/calendario");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950 px-4">
      <div className="card w-full max-w-sm p-7">
        <Logo className="text-xl" />
        <h1 className="mt-5 text-lg font-semibold">{isLogin ? "Inicia sesión" : "Únete al club"}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isLogin ? "Organiza tus horas en el lab y en los proyectos." : "Necesitas el código de invitación del club."}
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {!isLogin && (
            <div>
              <label className="label" htmlFor="name">Nombre</label>
              <input className="input" id="name" name="name" required autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Correo</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              required
              minLength={isLogin ? 1 : 8}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>
          {!isLogin && (
            <div>
              <label className="label" htmlFor="inviteCode">Código de invitación</label>
              <input className="input" id="inviteCode" name="inviteCode" required />
            </div>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Un momento…" : isLogin ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-zinc-500">
          {isLogin ? (
            <>¿Eres nuevo? <Link className="font-medium text-brand hover:underline" href="/registro">Regístrate</Link></>
          ) : (
            <>¿Ya tienes cuenta? <Link className="font-medium text-brand hover:underline" href="/login">Inicia sesión</Link></>
          )}
        </p>
      </div>
    </main>
  );
}
