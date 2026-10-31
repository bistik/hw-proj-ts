import {
  int,
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { users } from "./auth-schema";
import { relations, sql } from "drizzle-orm";

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

export const courseItemTypes = ["lesson", "assignment"] as const;

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

// Course outline: keeps the author-defined sequence of a course's items
// (lesson A → assignment X → lesson B, ...). One row per item, one ordered
// list per course.
//
// Row lifecycle:
//  - DELETE course  → rows cascade automatically (declared FK below)
//  - CREATE item attached to a course → row inserted in the create-lesson /
//    create-assignment transaction (position = max + 1, see course-items fns)
//  - DELETE lesson/assignment → row must be deleted in the same app-level
//    transaction (no FK on item_id: a column can only reference one table,
//    and lessons/assignments ids come from separate value spaces)
export const courseItemsTable = sqliteTable(
  "course_items",
  {
    id: int().primaryKey({ autoIncrement: true }),
    courseId: int("course_id")
      .notNull()
      .references(() => coursesTable.id, { onDelete: "cascade" }),
    itemType: text("item_type", { enum: courseItemTypes }).notNull(),
    itemId: int("item_id").notNull(),
    position: int().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // one row per (course, slot) — enables the max+1 insert pattern
    uniqueIndex("course_items_course_position_unique").on(
      table.courseId,
      table.position,
    ),
    // a lesson/assignment can appear in at most one course outline
    uniqueIndex("course_items_type_item_unique").on(
      table.itemType,
      table.itemId,
    ),
    // future item types (e.g. optional "exercises") extend this enum + check
    check(
      "course_items_type_check",
      sql`${table.itemType} in ('lesson', 'assignment')`,
    ),
  ],
);

export const questionsTable = sqliteTable("questions", {
  id: int().primaryKey({ autoIncrement: true }),
  questionText: text("question_text").notNull(),
  assignmentId: int("assignment_id").references(() => assignmentsTable.id, {
    onDelete: "cascade",
  }),
  answer: text().notNull(),
  position: int().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => [
    uniqueIndex("questions_assignment_position_unique").on(
      table.assignmentId,
      table.position,
    ),
  ],
);

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
  (table) => [
    uniqueIndex("assignment_submissions_assignment_assignee_unique").on(
      table.assignmentId,
      table.assigneeId,
    ),
  ],
);

export const submissionAnswersTable = sqliteTable(
  "submission_answers",
  {
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
  },
  (table) => [
    uniqueIndex("submission_answers_question_submission_unique").on(
      table.questionId,
      table.submissionId,
    ),
  ],
);

export const enrollmentsTable = sqliteTable(
  "enrollments",
  {
    id: int().primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: int("course_id")
      .notNull()
      .references(() => coursesTable.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "completed", "dropped"] })
      .notNull()
      .default("active"),
    enrolledAt: integer("enrolled_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // one enrollment per user/course; re-enrolling is ignored
    uniqueIndex("enrollments_user_course_unique").on(
      table.userId,
      table.courseId,
    ),
    // "who is enrolled in this course?" — the composite index above can't serve this
    index("enrollments_courseId_idx").on(table.courseId),
    check(
      "enrollments_status_check",
      sql`${table.status} in ('active', 'completed', 'dropped')`,
    ),
  ],
);

export const coursesRelations = relations(coursesTable, ({ many }) => ({
  lessons: many(lessonsTable),
  assignments: many(assignmentsTable),
  enrollments: many(enrollmentsTable),
  items: many(courseItemsTable),
}));

export const courseItemsRelations = relations(courseItemsTable, ({ one }) => ({
  course: one(coursesTable, {
    fields: [courseItemsTable.courseId],
    references: [coursesTable.id],
  }),
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

export const enrollmentsRelations = relations(enrollmentsTable, ({ one }) => ({
  user: one(users, {
    fields: [enrollmentsTable.userId],
    references: [users.id],
  }),
  course: one(coursesTable, {
    fields: [enrollmentsTable.courseId],
    references: [coursesTable.id],
  }),
}));

export * from "./auth-schema";
