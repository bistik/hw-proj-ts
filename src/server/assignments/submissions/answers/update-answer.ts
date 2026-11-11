import { dbGradeSubmissionAnswer } from "@/db/assignments/submissions/answers/update-answer";
import { requireUserOwnsCourse } from "@/db/authz";
import { db } from "@/db";
import { assignmentSubmissionsTable, assignmentsTable } from "@/db/schema";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { and, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

const gradeSubmissionAnswerSchema = z.object({
  courseId: z.number().int().positive("Course id is required"),
  submissionId: z.number().int().positive("Submission id is required"),
  questionId: z.number().int().positive("Question id is required"),
  isCorrect: z.boolean(),
});

export const gradeSubmissionAnswer = createServerFn({ method: "POST" })
  .validator(gradeSubmissionAnswerSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireUserOwnsCourse(data.courseId, context.user.id);

    // The submission must exist, belong to this course, and contain the
    // answer that is being graded.
    const [row] = await db
      .select({ id: assignmentSubmissionsTable.id })
      .from(assignmentSubmissionsTable)
      .innerJoin(
        assignmentsTable,
        eq(assignmentSubmissionsTable.assignmentId, assignmentsTable.id),
      )
      .where(
        and(
          eq(assignmentSubmissionsTable.id, data.submissionId),
          eq(assignmentsTable.courseId, data.courseId),
        ),
      )
      .limit(1);

    if (!row) throw new Error("Submission not found");

    const updated = await dbGradeSubmissionAnswer({
      submissionId: data.submissionId,
      questionId: data.questionId,
      isCorrect: data.isCorrect,
    });
    if (!updated) throw new Error("Answer not found");

    return updated;
  });
