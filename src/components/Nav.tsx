"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Logo } from "./Logo";

type Props = { user: { name: string; role: "MEMBER" | "ADMIN" } };

export function Nav({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/calendario", label: "Calendario" },
    { href: "/proyectos", label: "Proyectos" },
    ...(user.role === "ADMIN"
      ? [
          { href: "/admin/recomendado", label: "Calendario recomendado" },
          { href: "/admin/miembros", label: "Miembros y lab" },
        ]
      : []),
  ];

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/calendario"><Logo /></Link>
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname.startsWith(l.href) ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <span className="text-sm text-zinc-600">
            {user.name}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${user.role === "ADMIN" ? "bg-brand/10 text-brand" : "bg-zinc-100 text-zinc-600"}`}>
              {user.role === "ADMIN" ? "Admin" : "Miembro"}
            </span>
          </span>
          <button onClick={logout} className="btn-ghost py-1.5">Salir</button>
        </div>
        <button className="btn-ghost ml-auto md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menú">☰</button>
      </div>
      {open && (
        <nav className="border-t border-zinc-200 px-4 py-2 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-zinc-100">
              {l.label}
            </Link>
          ))}
          <button onClick={logout} className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">
            Salir ({user.name})
          </button>
        </nav>
      )}
    </header>
  );
}
