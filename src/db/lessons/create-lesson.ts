import { db } from "@/db/";
import { courseItemsTable, lessonsTable } from "../schema";
import { eq, max } from "drizzle-orm";

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
