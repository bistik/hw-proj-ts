import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import { dbCreateQuestions } from "@/db/questions/mutate-question";
import { generateQuestionsWithLlm } from "@/lib/ai/llm";
import { buildQuestionPrompt } from "@/lib/ai/prompt";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { aiQuestionsFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

/**
 * Generates questions for an assignment through the LLM (issue #79).
 *
 * The validator runs before any work, so an out-of-range count or an
 * over-long filter never reaches the database or the AI service. The
 * prompt example comes from the assignment row, never from the client,
 * so a caller cannot point the model at another assignment's example.
 * An assignment without an example is rejected: the model would have
 * nothing to learn from (PR #80 review).
 *
 * The fn guards the insert itself and writes through dbCreateQuestions,
 * scoped to the loaded assignment — a server fn does not re-enter
 * another server fn, so the validator, the middleware, and the guards
 * run once (PR #80 follow-up). The fn returns the inserted rows, one
 * per question, so the caller can report the count. An AI or insert
 * failure becomes "Could not generate questions." with the original
 * error as its cause.
 */
export const generateQuestions = createServerFn({ method: "POST" })
  .validator(aiQuestionsFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment?.courseId) {
      throw new Error("Course not found");
    }
    await requireUserOwnsCourse(assignment.courseId, context.user.id);
    // PR #80 review: the form is disabled without an example, but this
    // guard sits behind the ownership check, so the request also fails
    // for a direct client call.
    if (!assignment.example) {
      throw new Error(
        "This assignment has no example yet. Add an example first.",
      );
    }

    const messages = buildQuestionPrompt({
      example: assignment.example,
      filter: data.filter,
      count: data.count,
    });

    let questions;
    try {
      // One stable session id per assignment: repeated generates on the
      // same assignment keep the routing and the prompt cache warm.
      // The count caps the parsed list, so a generate can never insert
      // more questions than the author asked for (PR #80 review).
      questions = await generateQuestionsWithLlm(messages, {
        session: `hw-proj-ts-assignment-${assignment.id}`,
        count: data.count,
      });
    } catch (err) {
      console.error("Error in generating questions with the LLM", err);
      throw new Error("Could not generate questions.", { cause: err });
    }

    try {
      return await dbCreateQuestions({
        assignmentId: assignment.id,
        questions,
      });
    } catch (err) {
      console.error("Error in inserting the generated questions", err);
      throw new Error("Could not generate questions.", { cause: err });
    }
  });
