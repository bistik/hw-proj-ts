import { int, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./auth-schema";
import { relations } from "drizzle-orm";

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

export const coursesTable = sqliteTable("courses", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  description: text(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const lessonsTable = sqliteTable("lessons", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  content: text().notNull(),
  courseId: int("course_id").references(() => coursesTable.id, {
    onDelete: "cascade",
  }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const assignmentsTable = sqliteTable("assignments", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  courseId: int("course_id").references(() => coursesTable.id, {
    onDelete: "cascade",
  }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const questionsTable = sqliteTable("questions", {
  id: int().primaryKey({ autoIncrement: true }),
  questionText: text("question_text").notNull(),
  assignmentId: int("assignment_id").references(() => assignmentsTable.id, {
    onDelete: "cascade",
  }),
  answer: text().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const assignmentSubmissionsTable = sqliteTable(
  "assignment_submissions",
  {
    id: int().primaryKey({ autoIncrement: true }),
    assignmentId: int("assignment_id").references(() => assignmentsTable.id, {
      onDelete: "cascade",
    }),
    assigneeId: text("assignee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: integer("started_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    submittedAt: integer("submitted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
);

export const submissionAnswersTable = sqliteTable("submission_answers", {
  id: int().primaryKey({ autoIncrement: true }),
  answer: text().notNull(),
  points: int().default(0),
  isCorrect: int("is_correct", { mode: "boolean" }),
  comment: text(),
  questionId: int("question_id").references(() => questionsTable.id, {
    onDelete: "cascade",
  }),
  submissionId: int("submission_id").references(
    () => assignmentSubmissionsTable.id,
    { onDelete: "cascade" },
  ),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
});

export const coursesRelations = relations(coursesTable, ({ many }) => ({
  lessons: many(lessonsTable),
  assignments: many(assignmentsTable),
}));

export const lessonsRelations = relations(lessonsTable, ({ one }) => ({
  course: one(coursesTable, {
    fields: [lessonsTable.courseId],
    references: [coursesTable.id],
  }),
}));

export const assignmentsRelations = relations(assignmentsTable, ({ one }) => ({
  course: one(coursesTable, {
    fields: [assignmentsTable.courseId],
    references: [coursesTable.id],
  }),
}));

export * from "./auth-schema";
