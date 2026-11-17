import { db } from "@/db/";
import { courseItemsTable, coursesTable } from "@/db/schema";
import { and, asc, desc, eq, gt, lt, max } from "drizzle-orm";

/**
 * Swaps the outline row of the given item with the outline row below it
 * (issue #43): the item takes the next higher position in its course and
 * the item below takes the item's old position. Only the two rows change,
 * so gapped positions elsewhere in the outline keep their slots.
 *
 * The authorId scopes the row lookup in the same query (the course_items
 * row joins its course), so a caller who does not own the course matches
 * no row — the same guard shape as dbGetLesson.
 *
 * Returns the moved row's new state, or null when the row does not exist
 * or no item sits below it (the caller hides [Move down] at the last
 * position, so that state only comes from a stale or forged request).
 *
 * The three updates run in one transaction because the
 * course_items_course_position_unique index blocks a direct two-row swap:
 * while the neighbor still holds the target position, writing it to the
 * item would collide. The item is parked one position past the course's
 * current max first, which frees both swapped positions.
 */
export const dbMoveCourseItemDown = async function (data: {
  itemType: "lesson" | "assignment";
  itemId: number;
  userId: string;
}) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ item: courseItemsTable })
      .from(courseItemsTable)
      .innerJoin(coursesTable, eq(courseItemsTable.courseId, coursesTable.id))
      .where(
        and(
          eq(courseItemsTable.itemType, data.itemType),
          eq(courseItemsTable.itemId, data.itemId),
          eq(coursesTable.authorId, data.userId),
        ),
      )
      .limit(1);
    if (!row) return null;

    const item = row.item;

    // The item below: the outline row with the smallest position greater
    // than the item's, in the same course.
    const [neighbor] = await tx
      .select()
      .from(courseItemsTable)
      .where(
        and(
          eq(courseItemsTable.courseId, item.courseId),
          gt(courseItemsTable.position, item.position),
        ),
      )
      .orderBy(asc(courseItemsTable.position))
      .limit(1);
    if (!neighbor) return null;

    // Next free position: one past the course's current max. The max is
    // never null here (the item itself is an outline row of the course),
    // but the ?? -1 keeps the max+1 insert pattern of dbCreateLesson.
    const [{ maxPosition }] = await tx
      .select({ maxPosition: max(courseItemsTable.position) })
      .from(courseItemsTable)
      .where(eq(courseItemsTable.courseId, item.courseId));

    await tx
      .update(courseItemsTable)
      .set({ position: (maxPosition ?? -1) + 1 })
      .where(eq(courseItemsTable.id, item.id));
    await tx
      .update(courseItemsTable)
      .set({ position: item.position })
      .where(eq(courseItemsTable.id, neighbor.id));
    await tx
      .update(courseItemsTable)
      .set({ position: neighbor.position })
      .where(eq(courseItemsTable.id, item.id));

    return {
      courseId: item.courseId,
      itemType: item.itemType,
      itemId: item.itemId,
      position: neighbor.position,
    };
  });
};

/**
 * Swaps the outline row of the given item with the outline row above it
 * (issue #44): the item takes the next lower position in its course and
 * the item above takes the item's old position. Only the two rows change,
 * so gapped positions elsewhere in the outline keep their slots.
 *
 * The authorId scopes the row lookup in the same query (the course_items
 * row joins its course), so a caller who does not own the course matches
 * no row — the same guard shape as dbMoveCourseItemDown.
 *
 * Returns the moved row's new state, or null when the row does not exist
 * or no item sits above it (the caller hides [Move up] at the first
 * position, so that state only comes from a stale or forged request).
 *
 * The three updates run in one transaction because the
 * course_items_course_position_unique index blocks a direct two-row swap:
 * while the neighbor still holds the target position, writing it to the
 * item would collide. The item is parked one position past the course's
 * current max first, which frees both swapped positions.
 */
export const dbMoveCourseItemUp = async function (data: {
  itemType: "lesson" | "assignment";
  itemId: number;
  userId: string;
}) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ item: courseItemsTable })
      .from(courseItemsTable)
      .innerJoin(coursesTable, eq(courseItemsTable.courseId, coursesTable.id))
      .where(
        and(
          eq(courseItemsTable.itemType, data.itemType),
          eq(courseItemsTable.itemId, data.itemId),
          eq(coursesTable.authorId, data.userId),
        ),
      )
      .limit(1);
    if (!row) return null;

    const item = row.item;

    // The item above: the outline row with the largest position smaller
    // than the item's, in the same course.
    const [neighbor] = await tx
      .select()
      .from(courseItemsTable)
      .where(
        and(
          eq(courseItemsTable.courseId, item.courseId),
          lt(courseItemsTable.position, item.position),
        ),
      )
      .orderBy(desc(courseItemsTable.position))
      .limit(1);
    if (!neighbor) return null;

    // Next free position: one past the course's current max. The max is
    // never null here (the item itself is an outline row of the course),
    // but the ?? -1 keeps the max+1 insert pattern of dbCreateLesson.
    const [{ maxPosition }] = await tx
      .select({ maxPosition: max(courseItemsTable.position) })
      .from(courseItemsTable)
      .where(eq(courseItemsTable.courseId, item.courseId));

    await tx
      .update(courseItemsTable)
      .set({ position: (maxPosition ?? -1) + 1 })
      .where(eq(courseItemsTable.id, item.id));
    await tx
      .update(courseItemsTable)
      .set({ position: item.position })
      .where(eq(courseItemsTable.id, neighbor.id));
    await tx
      .update(courseItemsTable)
      .set({ position: neighbor.position })
      .where(eq(courseItemsTable.id, item.id));

    return {
      courseId: item.courseId,
      itemType: item.itemType,
      itemId: item.itemId,
      position: neighbor.position,
    };
  });
};
