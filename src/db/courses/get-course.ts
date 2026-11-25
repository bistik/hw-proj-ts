import { db } from "@/db/";
import {
  assignmentSubmissionsTable,
  assignmentsTable,
  coursesTable,
  lessonsTable,
  questionsTable,
  submissionAnswersTable,
} from "../schema";
import { and, desc, eq, sql } from "drizzle-orm";

export async function dbGetCoursesByUser(authorId: string) {
  try {
    const result = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.authorId, authorId))
      .orderBy(desc(coursesTable.id))
      .limit(50);
    return result;
  } catch (err) {
    console.error(`Error retrieving course records for user ${authorId}`, err);
    return null;
  }
}

export async function dbGetCourseByIdAndAuthor(
  courseId: number,
  authorId: string,
) {
  try {
    const course = await db.query.coursesTable.findFirst({
      where: (coursesTable, { and, eq }) =>
        and(eq(coursesTable.id, courseId), eq(coursesTable.authorId, authorId)),
    });
    return course;
  } catch (err) {
    console.error(
      `Error retrieving course ${courseId} for user ${authorId}`,
      err,
    );
    return null;
  }
}

/**
 * The author's courses with lesson/assignment counts. Each count is a
 * correlated subquery (not joins — joining both tables would multiply rows
 * and skew counts) computed directly from the lessons/assignments tables,
 * so items missing from the course_items outline are still counted.
 * Zero-count courses keep both "0 assignments"/"0 lessons" links.
 */
export async function dbGetCoursesWithItemCountsByUser(authorId: string) {
  return db
    .select({
      id: coursesTable.id,
      title: coursesTable.title,
      description: coursesTable.description,
      lessonCount: db.$count(
        lessonsTable,
        eq(lessonsTable.courseId, coursesTable.id),
      ),
      assignmentCount: db.$count(
        assignmentsTable,
        eq(assignmentsTable.courseId, coursesTable.id),
      ),
    })
    .from(coursesTable)
    .where(eq(coursesTable.authorId, authorId))
    .orderBy(desc(coursesTable.id))
    .limit(50);
}

export async function dbGetEnrolledCourses(studentId: string) {
  return db.query.enrollmentsTable.findMany({
    where: (enrollmentsTable, { and, eq, inArray }) =>
      and(
        eq(enrollmentsTable.userId, studentId),
        inArray(enrollmentsTable.status, ["active", "completed"]),
      ),
    with: {
      course: { columns: { id: true, title: true, description: true } },
    },
    orderBy: (enrollmentsTable, { desc }) => desc(enrollmentsTable.enrolledAt),
    limit: 50,
  });
}

export async function dbGetEnrollmentByCourseAndStudent(
  courseId: number,
  studentId: string,
) {
  return db.query.enrollmentsTable.findFirst({
    where: (enrollmentsTable, { and, eq, inArray }) =>
      and(
        eq(enrollmentsTable.courseId, courseId),
        eq(enrollmentsTable.userId, studentId),
        inArray(enrollmentsTable.status, ["active", "completed"]),
      ),
    with: {
      course: {
        with: {
          // The outline rows in display order: the student page lists items
          // by course_items.position (issue #32), not by table or id order.
          items: {
            columns: { itemType: true, itemId: true, position: true },
            orderBy: (courseItemsTable, { asc }) => asc(courseItemsTable.position),
          },
          lessons: { columns: { id: true, title: true } },
          assignments: {
            columns: { id: true, title: true },
            // Only the viewing student's submission per assignment, so the
            // page can badge the card when the student already submitted.
            with: {
              submissions: {
                columns: { submittedAt: true },
                where: (assignmentSubmissionsTable, { eq }) =>
                  eq(assignmentSubmissionsTable.assigneeId, studentId),
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Issue #89: the student's accumulated points in one course. The page
 * shows them below the course title as "Points: X / Y".
 *
 * earned sums assignments.points over the student's answers with
 * is_correct = true in the course. The sum is computed at read time
 * from the current assignments.points; no per-answer points are
 * stored (issue #88 removed that column), so an author's points edit
 * or a question delete changes the next read.
 *
 * possible sums points x question count over all assignments in the
 * course. Ungraded answers (is_correct is null) and wrong answers add
 * nothing to earned, but their questions still count in possible.
 */
export async function dbGetStudentCoursePoints(
  courseId: number,
  studentId: string,
): Promise<{ earned: number; possible: number }> {
  // One row per (assignment, question) pair: each question contributes
  // its assignment's current points once. An assignment without
  // questions contributes nothing, because there is nothing to answer.
  // coalesce turns the empty-course sum (null) into 0.
  const [possibleRow] = await db
    .select({
      possible: sql`coalesce(sum(${assignmentsTable.points}), 0)`,
    })
    .from(assignmentsTable)
    .innerJoin(
      questionsTable,
      eq(questionsTable.assignmentId, assignmentsTable.id),
    )
    .where(eq(assignmentsTable.courseId, courseId));

  // The student's correct answers: the answer row joins its question,
  // the question joins the assignment (for the course scope and the
  // current points), and the submission row names the student.
  const [earnedRow] = await db
    .select({
      earned: sql`coalesce(sum(${assignmentsTable.points}), 0)`,
    })
    .from(submissionAnswersTable)
    .innerJoin(
      questionsTable,
      eq(submissionAnswersTable.questionId, questionsTable.id),
    )
    .innerJoin(
      assignmentsTable,
      eq(questionsTable.assignmentId, assignmentsTable.id),
    )
    .innerJoin(
      assignmentSubmissionsTable,
      eq(submissionAnswersTable.submissionId, assignmentSubmissionsTable.id),
    )
    .where(
      and(
        eq(assignmentsTable.courseId, courseId),
        eq(assignmentSubmissionsTable.assigneeId, studentId),
        eq(submissionAnswersTable.isCorrect, true),
      ),
    );

  return {
    // sum() comes back as a string or a number depending on the driver;
    // Number() normalizes both.
    earned: Number(earnedRow?.earned ?? 0),
    possible: Number(possibleRow?.possible ?? 0),
  };
}
