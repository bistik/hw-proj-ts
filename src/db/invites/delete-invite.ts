import { db } from "@/db/";
import { invitesTable } from "../schema";
import { eq } from "drizzle-orm";

/**
 * Removes one pending invitation row. Called by the sign-up hook after the
 * row converted into an enrollment, so the invite cannot convert twice.
 */
export async function dbDeleteInvite(id: number) {
  await db.delete(invitesTable).where(eq(invitesTable.id, id));
}
