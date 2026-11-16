import { db } from "@/db/";

/**
 * One outline row of a course outline, resolved to its lesson or assignment:
 * the course_items row decides the slot, the lessons/assignments row provides
 * the title.
 *
 * Rows whose item row is missing (no FK on item_id — see schema notes) are
 * skipped, so a stale outline row cannot break the outline list.
 */
export type CourseItemView = {
  itemType: "lesson" | "assignment";
  id: number;
  title: string;
  position: number;
};

/**
 * All outline rows of one course in course_items.position order (issue #33),
 * each resolved to its lesson/assignment title. Returns an empty list for an
 * unknown course id — ownership is checked by the callers (the author server
 * fn resolves the course first).
 */
export async function dbGetCourseItemsByCourse(
  courseId: number,
): Promise<CourseItemView[]> {
  const course = await db.query.coursesTable.findFirst({
    where: (coursesTable, { eq }) => eq(coursesTable.id, courseId),
    columns: { id: true },
    with: {
      // Outline rows in display order: course_items.position decides the
      // slot (issue #32/#33), not table or id order.
      items: {
        columns: { itemType: true, itemId: true, position: true },
        orderBy: (courseItemsTable, { asc }) =>
          asc(courseItemsTable.position),
      },
      lessons: { columns: { id: true, title: true } },
      assignments: { columns: { id: true, title: true } },
    },
  });
  if (!course) return [];

  const lessonsById = new Map(course.lessons.map((lesson) => [lesson.id, lesson]));
  const assignmentsById = new Map(
    course.assignments.map((assignment) => [assignment.id, assignment]),
  );

  const items: CourseItemView[] = [];
  for (const { itemType, itemId, position } of course.items) {
    if (itemType === "lesson") {
      const lesson = lessonsById.get(itemId);
      if (lesson) {
        items.push({
          itemType,
          id: lesson.id,
          title: lesson.title,
          position,
        });
      }
    } else {
      const assignment = assignmentsById.get(itemId);
      if (assignment) {
        items.push({
          itemType,
          id: assignment.id,
          title: assignment.title,
          position,
        });
      }
    }
  }
  return items;
}
