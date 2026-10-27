import { db } from "@/db/";
import { users } from "../auth-schema";
import { desc } from "drizzle-orm";

export async function dbGetUsers() {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .orderBy(desc(users.id))
    .limit(50);
}
