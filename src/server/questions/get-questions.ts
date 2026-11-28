import {
  dbGetNextQuestionByPosition,
  dbGetPreviousQuestionByPosition,
  dbGetQuestionByIdAndAssignment,
  dbGetQuestionByIdAndAuthor,
  dbGetQuestionsByAssignment,
  dbGetQuestionsForStudent,
} from "@/db/questions/get-questions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { requireUserEnrolledInCourse } from "@/db/authz";
import {
  dbGetAssignment,
  dbGetAssignmentByIdAndAuthor,
} from "@/db/assignments/get-assignment";
import { dbIsSubmissionSubmitted } from "@/db/assignments/submissions/get-submission";

export const getQuestions = createServerFn({
  method: "GET",
})
  .validator((assignmentId: number) => assignmentId)
  .middleware([authMiddleware])
  .handler(async ({ data: assignmentId, context }) => {
    try {
      // The author check runs first and joins on the course author,
      // exactly like getAssignmentById (issue #18 review). A caller
      // who is not the course author gets null, and the questions
      // query never runs, so no answer column can leak.
      const assignment = await dbGetAssignmentByIdAndAuthor(
        assignmentId,
        context.user.id,
      );
      if (!assignment) return null;
      return await dbGetQuestionsByAssignment(assignmentId);
    } catch (err) {
      console.error(
        `Error in fetching questions for assignment ${assignmentId}`,
        err,
      );
      throw new Error("Could not fetch questions", { cause: err });
    }
  });

export const getQuestion = createServerFn({ method: "GET" })
  .validator((questionId: number) => questionId)
  .middleware([authMiddleware])
  .handler(async ({ data: questionId, context }) => {
    try {
      return await dbGetQuestionByIdAndAuthor(questionId, context.user.id);
    } catch (err) {
      console.error(`Error in fetching question ${questionId}`, err);
      throw new Error("Could not retrieve question", { cause: err });
    }
  });

export const getStudentQuestions = createServerFn({ method: "GET" })
  .validator(
    z.object({
      assignmentId: z.number().int().positive("Invalid assignment id"),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment || !assignment.courseId)
      throw new Error("Could not find assignment");
    try {
      await requireUserEnrolledInCourse(assignment.courseId, context.user.id);
      // The route also needs the assignment's course id to render its
      // "Back to course" link; the enrollment guard above already proved
      // the caller is a member, so sharing it here is safe.
      return {
        courseId: assignment.courseId,
        questions: await dbGetQuestionsForStudent(assignment.id),
      };
    } catch (err) {
      console.error(
        `Error fetching student assignment questions ${data.assignmentId}`,
        err,
      );
      throw new Error("Could not get questions.");
    }
  });

export const getStudentQuestion = createServerFn({ method: "GET" })
  .validator(
    z.object({
      assignmentId: z.number().int().positive("Invalid assignment id"),
      questionId: z.number().int().positive("Invalid question id"),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment || !assignment.courseId)
      throw new Error("Could not find assignment");
    try {
      await requireUserEnrolledInCourse(assignment.courseId, context.user.id);
      // Issue #101: the question route also needs the course id, so its
      // score modal can redirect back to the course page after a
      // checked submit. The enrollment guard above already proved the
      // caller is a member, so sharing it here is safe.
      //
      // Issue #104: the question page shows the correct answer once
      // the student submitted the assignment. While the submission is
      // in progress the answer must not leave the server at all, or a
      // student could read it from the network payload and copy it
      // into the still-open answer form. dbIsSubmissionSubmitted is
      // the gate: the answer column travels only with a submitted
      // submission, so it is undefined below exactly while the
      // student may still edit answers.
      const submitted = await dbIsSubmissionSubmitted(
        assignment.id,
        context.user.id,
      );
      const question = await dbGetQuestionByIdAndAssignment(
        assignment.id,
        data.questionId,
      );
      return {
        courseId: assignment.courseId,
        question: !question
          ? null
          : { ...question, answer: submitted ? question.answer : undefined },
      };
    } catch (err) {
      console.error(
        `Error fetching student assignment question ${data.questionId}`,
        err,
      );
      throw new Error("Could not get question.");
    }
  });

export const getStudentNextQuestion = createServerFn({ method: "GET" })
  .validator(
    z.object({
      assignmentId: z.number().int().positive("Invalid assignment id"),
      questionId: z.number().int().positive("Invalid question id"),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment || !assignment.courseId)
      throw new Error("Could not find assignment");
    try {
      await requireUserEnrolledInCourse(assignment.courseId, context.user.id);
      const question = await dbGetQuestionByIdAndAssignment(
        assignment.id,
        data.questionId,
      );
      if (!question) return null;
      const nextQuestion = await dbGetNextQuestionByPosition(
        assignment.id,
        question.position,
      );
      return nextQuestion;
    } catch (err) {
      console.error(
        `Error fetching student assignment question ${data.questionId}`,
        err,
      );
      throw new Error("Could not get question.");
    }
  });

export const getStudentPreviousQuestion = createServerFn({ method: "GET" })
  .validator(
    z.object({
      assignmentId: z.number().int().positive("Invalid assignment id"),
      questionId: z.number().int().positive("Invalid question id"),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment || !assignment.courseId)
      throw new Error("Could not find assignment");
    try {
      await requireUserEnrolledInCourse(assignment.courseId, context.user.id);
      const question = await dbGetQuestionByIdAndAssignment(
        assignment.id,
        data.questionId,
      );
      if (!question) return null;
      const prevQuestion = await dbGetPreviousQuestionByPosition(
        assignment.id,
        question.position,
      );
      return prevQuestion;
    } catch (err) {
      console.error(
        `Error fetching student assignment question ${data.questionId}`,
        err,
      );
      throw new Error("Could not get question.");
    }
  });
