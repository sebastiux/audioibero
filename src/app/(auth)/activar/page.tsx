import { InvalidLink, SetPasswordForm } from "@/components/AuthForm";
import { findValidToken } from "@/lib/tokens";

export const metadata = { title: "Activar cuenta · Audio Ibero" };
export const dynamic = "force-dynamic";

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const row = await findValidToken(token);
  if (!row || !token) return <InvalidLink />;
  return <SetPasswordForm token={token} name={row.user.name} isInvite={row.type === "INVITE"} />;
}
