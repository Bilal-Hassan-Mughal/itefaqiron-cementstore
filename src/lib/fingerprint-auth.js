import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const COOKIE = "fp_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

export function signSession(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: MAX_AGE_SECONDS });
}

export function verifySession(token) {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (!decoded || typeof decoded !== "object") return null;
    const { sub, name, email } = /** @type {any} */ (decoded);
    if (typeof sub !== "string" || typeof name !== "string" || typeof email !== "string") return null;
    return { sub, name, email };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export const SESSION_COOKIE = COOKIE;
