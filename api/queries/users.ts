import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";

export async function findUserByFirebaseUid(firebaseUid: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.firebaseUid, firebaseUid))
    .limit(1);
  return rows.at(0);
}

export async function upsertUser(data: InsertUser) {
  const values = { ...data };

  await getDb()
    .insert(schema.users)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        updatedAt: new Date(),
        ...data,
      },
    });
}
