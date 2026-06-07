import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const secret = new TextEncoder().encode(env.jwtSecret);

export async function createToken(payload: { userId: number; phone: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<{ userId: number; phone: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });
    return {
      userId: payload.userId as number,
      phone: payload.phone as string,
    };
  } catch {
    return null;
  }
}
