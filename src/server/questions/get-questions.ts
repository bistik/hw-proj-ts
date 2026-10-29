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
import { dbGetAssignment } from "@/db/assignments/get-assignment";

export const getQuestions = createServerFn({
  method: "GET",
})
  .validator((assignmentId: number) => assignmentId)
  .middleware([authMiddleware])
  .handler(async ({ data: assignmentId }) => {
    try {
      const result = await dbGetQuestionsByAssignment(assignmentId);
      return result;
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
      const result = dbGetQuestionsForStudent(assignment.id);
      return result;
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
      const result = dbGetQuestionByIdAndAssignment(
        assignment.id,
        data.questionId,
      );
      return result;
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
