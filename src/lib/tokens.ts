import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";

export type TokenType = "INVITE" | "RESET";

const TTL_HOURS: Record<TokenType, number> = { INVITE: 24 * 7, RESET: 2 };
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Crea un enlace de un solo uso (invalida los anteriores del mismo tipo). Devuelve el token en claro. */
export async function issueToken(userId: string, type: TokenType) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authToken.create({
      data: { userId, type, tokenHash: hash(token), expiresAt: new Date(Date.now() + TTL_HOURS[type] * 3600_000) },
    }),
  ]);
  return token;
}

/** Busca un token vigente (sin usar ni vencido). */
export async function findValidToken(token: string | undefined | null) {
  if (!token || token.length < 20) return null;
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.active) return null;
  return row;
}

export async function consumeToken(id: string) {
  await prisma.authToken.update({ where: { id }, data: { usedAt: new Date() } });
}
