import { dbMoveCourseItemDown } from "@/db/course-items/mutate-course-item";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { moveCourseItemDownSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

/**
 * Moves one course item one slot down the author's outline (issue #43):
 * the item's course_items row swaps positions with the row below it.
 *
 * The validator carries only the item coordinates: the server derives the
 * courseId from the course_items row, so a client-sent course id cannot
 * point the move at another course's outline. The db function scopes its
 * lookup to the course author, so a non-author gets "Course item not
 * found" without touching any row.
 */
export const moveCourseItemDown = createServerFn({ method: "POST" })
  .validator(moveCourseItemDownSchema)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    let result: Awaited<ReturnType<typeof dbMoveCourseItemDown>>;
    try {
      result = await dbMoveCourseItemDown({
        itemType: data.itemType,
        itemId: data.itemId,
        userId: context.user.id,
      });
    } catch (err) {
      console.error(`Error moving course item down`, err);
      throw new Error("Could not move the course item down.", { cause: err });
    }
    // This throw sits outside the try, so the client receives the
    // "Course item not found" message, not the wrapped db error.
    if (!result) throw new Error("Course item not found");
    return result;
  });
