import jwt from "jsonwebtoken";
import { env } from "../env";
import type { Role } from "../constants";

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl as any });
}

/** `ttl` overrides the configured lifetime (student sessions are kept short: lab computers are shared). */
export function signRefreshToken(payload: { sub: string }, ttl?: string): string {
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: (ttl ?? env.jwt.refreshTtl) as any });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwt.refreshSecret) as { sub: string };
}
