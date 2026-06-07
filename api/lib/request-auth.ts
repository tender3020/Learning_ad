import type { User } from "@db/schema";
import { verifyToken } from "./jwt";
import { findUserById } from "../queries/phone-users";

function extractToken(req: Request): string | null {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const cookie = req.headers.get("cookie");
  if (cookie) {
    const match = cookie.match(/yizhi_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  try {
    const token = extractToken(req);
    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    return (await findUserById(payload.userId)) ?? null;
  } catch {
    return null;
  }
}
