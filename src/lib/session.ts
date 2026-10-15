import { SignJWT, jwtVerify } from "jose";

// Este módulo no depende de Node ni de Prisma para poder usarse en el middleware (edge).

export const SESSION_COOKIE = "ai_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export type SessionPayload = {
  sub: string;
  role: "MEMBER" | "ADMIN";
  name: string;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET debe estar definido y tener al menos 32 caracteres");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      role: payload.role === "ADMIN" ? "ADMIN" : "MEMBER",
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}
