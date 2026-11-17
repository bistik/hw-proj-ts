import { dbMoveCourseItem } from "@/db/course-items/mutate-course-item";
import { authMiddleware } from "@/middlewares/auth-middleware";
import {
  moveCourseItemDownSchema,
  moveCourseItemUpSchema,
} from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

/**
 * Runs one outline move through dbMoveCourseItem and wraps its errors. The
 * moveCourseItemDown and moveCourseItemUp server fns share this handler;
 * they differ only in the direction they pass and the move name in the
 * error messages.
 *
 * The validator carries only the item coordinates: the server derives the
 * courseId from the course_items row, so a client-sent course id cannot
 * point the move at another course's outline. The db function scopes its
 * lookup to the course author, so a non-author gets "Course item not
 * found" without touching any row.
 */
function runMove(direction: "up" | "down", moveName: string) {
  return async ({
    data,
    context,
  }: {
    data: { itemType: "lesson" | "assignment"; itemId: number };
    context: { user: { id: string } };
  }) => {
    let result: Awaited<ReturnType<typeof dbMoveCourseItem>>;
    try {
      result = await dbMoveCourseItem({
        itemType: data.itemType,
        itemId: data.itemId,
        userId: context.user.id,
        direction,
      });
    } catch (err) {
      console.error(`Error moving course item ${moveName}`, err);
      throw new Error(`Could not move the course item ${moveName}.`, {
        cause: err,
      });
    }
    // This throw sits outside the try, so the client receives the
    // "Course item not found" message, not the wrapped db error.
    if (!result) throw new Error("Course item not found");
    return result;
  };
}

/**
 * Moves one course item one slot down the author's outline (issue #43):
 * the item's course_items row swaps positions with the row below it.
 */
export const moveCourseItemDown = createServerFn({ method: "POST" })
  .validator(moveCourseItemDownSchema)
  .middleware([authMiddleware])
  .handler(runMove("down", "down"));

/**
 * Moves one course item one slot up the author's outline (issue #44): the
 * item's course_items row swaps positions with the row above it.
 */
export const moveCourseItemUp = createServerFn({ method: "POST" })
  .validator(moveCourseItemUpSchema)
  .middleware([authMiddleware])
  .handler(runMove("up", "up"));
