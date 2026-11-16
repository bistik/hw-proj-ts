import { db } from "@/db/";
import { courseItemsTable, lessonsTable } from "../schema";
import { and, eq, max } from "drizzle-orm";

/**
 * Inserts the lesson row and its course_items outline row in one
 * transaction (issue #35). The student page /student/courses/<id> builds its
 * item list from course_items only (dbGetEnrollmentByCourseAndStudent in
 * src/db/courses/get-course.ts), so a lesson without an outline row is
 * invisible to students even though the author sees it on the lessons tab.
 */
export const dbCreateLesson = async function (data: {
  title: string;
  courseId: number;
  content: string;
}) {
  return db.transaction(async (tx) => {
    const lesson = await tx
      .insert(lessonsTable)
      .values(data)
      .returning({ lessonId: lessonsTable.id })
      .then((res) => res[0]);

    // Next free outline position for this course: max(position) + 1, so the
    // new row does not collide with an existing position on the
    // course_items_course_position_unique index. max is null on an empty
    // outline, so the ?? -1 makes the first row take position 0.
    const [{ maxPosition }] = await tx
      .select({ maxPosition: max(courseItemsTable.position) })
      .from(courseItemsTable)
      .where(eq(courseItemsTable.courseId, data.courseId));

    await tx.insert(courseItemsTable).values({
      courseId: data.courseId,
      itemType: "lesson",
      itemId: lesson.lessonId,
      position: (maxPosition ?? -1) + 1,
    });

    return lesson;
  });
};

export async function dbUpdateLesson(
  data: { title: string; content: string },
  lessonId: number,
) {
  return db
    .update(lessonsTable)
    .set(data)
    .where(eq(lessonsTable.id, lessonId))
    .returning()
    .then((res) => res[0]);
}

/**
 * Deletes the lesson row and its course_items outline row in one
 * transaction (issue #40). course_items has no foreign key on item_id
 * (lesson and assignment ids share one value space), so the database
 * cannot cascade the outline row: the app must delete it here, in the
 * same transaction, or the outline keeps pointing at a missing lesson.
 *
 * The delete does not renumber the other outline rows: their positions
 * stay as they are (the course_items_course_position_unique index has
 * no collision with gaps).
 *
 * The where clauses scope both deletes to the course, so a caller that
 * mixed up course and lesson ids cannot delete rows of another course.
 */
export const dbDeleteLesson = async function (data: {
  courseId: number;
  lessonId: number;
}) {
  return db.transaction(async (tx) => {
    await tx
      .delete(courseItemsTable)
      .where(
        and(
          eq(courseItemsTable.courseId, data.courseId),
          eq(courseItemsTable.itemType, "lesson"),
          eq(courseItemsTable.itemId, data.lessonId),
        ),
      );

    const deleted = await tx
      .delete(lessonsTable)
      .where(
        and(
          eq(lessonsTable.id, data.lessonId),
          eq(lessonsTable.courseId, data.courseId),
        ),
      )
      .returning({ lessonId: lessonsTable.id });

    return deleted[0] ?? null;
  });
};
