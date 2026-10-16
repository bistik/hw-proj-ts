import { int, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const settingsTable = sqliteTable("settings", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  value: text().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),

  // Stored as milliseconds (JS millisecond timestamp)
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});
