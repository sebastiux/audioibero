import { Nav } from "@/components/Nav";
import { requirePageUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <>
      <Nav user={{ name: user.name, role: user.role }} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
