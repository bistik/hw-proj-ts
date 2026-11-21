import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import {
  dbCreateQuestion,
  dbCreateQuestions,
  dbDeleteQuestion,
  dbUpdateQuestion,
} from "@/db/questions/mutate-question";
import { dbGetQuestionByIdAndAuthor } from "@/db/questions/get-questions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import {
  deleteQuestionSchema,
  questionFormSchema,
  questionsBulkFormSchema,
  questionUpdateFormSchema,
} from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createQuestion = createServerFn({ method: "POST" })
  .validator(questionFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment?.courseId) {
      throw new Error("Course not found");
    }
    await requireUserOwnsCourse(assignment.courseId, context.user.id);
    try {
      const result = await dbCreateQuestion({ ...data });
      return result;
    } catch (err) {
      console.error("Error in inserting a question record", err);
      throw new Error("Could not create a question.", { cause: err });
    }
  });

/**
 * Creates every question of one submission in one call (issue #73). The
 * validator rejects an empty list before the fn touches the database.
 * The ownership check runs before the insert, and a database failure
 * becomes "Could not create questions." with the original error as its
 * cause.
 */
export const createQuestions = createServerFn({ method: "POST" })
  .validator(questionsBulkFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment?.courseId) {
      throw new Error("Course not found");
    }
    await requireUserOwnsCourse(assignment.courseId, context.user.id);
    try {
      return await dbCreateQuestions(data);
    } catch (err) {
      console.error("Error in inserting question records", err);
      throw new Error("Could not create questions.", { cause: err });
    }
  });

export const updateQuestion = createServerFn({ method: "POST" })
  .validator(questionUpdateFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const question = await dbGetQuestionByIdAndAuthor(
      data.questionId,
      context.user.id,
    );
    if (!question) throw new Error("Question not found");
    try {
      return await dbUpdateQuestion(
        { questionText: data.questionText, answer: data.answer },
        data.questionId,
      );
    } catch (err) {
      console.error(`Error in updating question ${data.questionId}`, err);
      throw new Error("Could not update question", { cause: err });
    }
  });

/**
 * Deletes one question of an assignment (issue #54). The author check
 * runs first (dbGetQuestionByIdAndAuthor joins on the course author), so
 * a non-author gets "Question not found" without touching any row. The
 * validator carries only the questionId: the server derives the course
 * from the question's assignment and never trusts a client-sent course
 * id (same shape as deleteLesson).
 */
export const deleteQuestion = createServerFn({ method: "POST" })
  .validator(deleteQuestionSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const question = await dbGetQuestionByIdAndAuthor(
      data.questionId,
      context.user.id,
    );
    if (!question) throw new Error("Question not found");
    try {
      return await dbDeleteQuestion(data.questionId);
    } catch (err) {
      console.error(`Error in deleting question ${data.questionId}`, err);
      throw new Error("Could not delete question", { cause: err });
    }
  });
