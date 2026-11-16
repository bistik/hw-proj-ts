import { and, eq } from "drizzle-orm";
import { db } from "..";
import { courseItemsTable, lessonsTable } from "../schema";

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
