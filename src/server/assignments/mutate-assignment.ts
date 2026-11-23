import {
  dbCreateAssignment,
  dbDeleteAssignment,
  dbUpdateAssignment,
} from "@/db/assignments/mutate-assignment";
import {
  dbGetAssignment,
  dbGetAssignmentByIdAndAuthor,
} from "@/db/assignments/get-assignment";
import { dbHasUnsubmittedWork } from "@/db/assignments/submissions/get-submission";
import { requireUserOwnsCourse } from "@/db/authz";
import { authMiddleware } from "@/middlewares/auth-middleware";
import {
  assignmentFormSchema,
  assignmentUpdateFormSchema,
  deleteAssignmentSchema,
} from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createAssignment = createServerFn({ method: "POST" })
  .validator(assignmentFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireUserOwnsCourse(data.courseId, context.user.id);
    try {
      const result = await dbCreateAssignment({ ...data });
      return result;
    } catch (err) {
      console.error("Error in creating assignment", err);
      throw new Error("Could not create assignment.");
    }
  });

export const updateAssignment = createServerFn({ method: "POST" })
  .validator(assignmentUpdateFormSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment || !assignment.courseId)
      throw new Error("Could not fetch assignment or course.");
    await requireUserOwnsCourse(assignment.courseId, context.user.id);

    try {
      return await dbUpdateAssignment(data);
    } catch (err) {
      console.error(`Error in updating assignment`, err);
      throw new Error("Could not update assignment", { cause: err });
    }
  });

/**
 * Deletes an assignment and its course_items outline row (issue #41).
 * The author check runs first (dbGetAssignmentByIdAndAuthor joins on
 * the course author), so a non-author gets "Assignment not found"
 * without touching any row. The unsubmitted-work guard runs next: while
 * a student of the course has not submitted, the delete fails with
 * "Cannot delete an assignment with unsubmitted work." and touches no
 * row. The validator carries only the assignmentId: the server derives
 * the courseId from the assignment row and never trusts a client-sent
 * course id (same shape as deleteLesson).
 */
export const deleteAssignment = createServerFn({ method: "POST" })
  .validator(deleteAssignmentSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const assignment = await dbGetAssignmentByIdAndAuthor(
      data.assignmentId,
      context.user.id,
    );
    // The optional chain is not redundant: assignments.course_id is
    // nullable in the schema, so an assignment row without a course id
    // is a possible state.
    if (!assignment?.courseId) throw new Error("Assignment not found");
    if (await dbHasUnsubmittedWork(data.assignmentId)) {
      throw new Error("Cannot delete an assignment with unsubmitted work.");
    }
    try {
      return await dbDeleteAssignment({
        courseId: assignment.courseId,
        assignmentId: data.assignmentId,
      });
    } catch (err) {
      console.error(`Error in deleting ${data.assignmentId}`, err);
      throw new Error("Could not delete assignment", { cause: err });
    }
  });
