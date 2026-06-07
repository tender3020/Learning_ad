import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";

export async function findUserByPhone(phone: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.phone, phone))
    .limit(1);
  return rows.at(0);
}

export async function createUser(data: { phone: string; name?: string }) {
  const result = await getDb()
    .insert(schema.users)
    .values({
      phone: data.phone,
      name: data.name || `用户${data.phone.slice(-4)}`,
      role: "user",
      lastSignInAt: new Date(),
    });
  return Number(result[0].insertId);
}

export async function updateUserSignIn(userId: number) {
  await getDb()
    .update(schema.users)
    .set({ lastSignInAt: new Date() })
    .where(eq(schema.users.id, userId));
}

export async function findUserById(id: number) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return rows.at(0);
}
