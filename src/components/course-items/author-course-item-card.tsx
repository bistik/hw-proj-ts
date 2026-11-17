import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import ConfirmModal from "@/components/confirm-modal";
import { deleteLesson } from "@/server/lessons/mutate-lesson";

/** Identifies one outline row: the coordinates the move server fn takes. */
export type CourseItemRef = {
  itemType: "lesson" | "assignment";
  itemId: number;
};

type AuthorCourseItemCardProps = {
  itemType: "lesson" | "assignment";
  /** Id of the lesson/assignment row the outline row points at. */
  itemId: number;
  title: string;
  courseId: string;
  /** No item sits above the first card, so it shows no "Move up". */
  isFirst: boolean;
  /** No item sits below the last card, so it shows no "Move down". */
  isLast: boolean;
  /** The outline move in flight, or null while no move runs. Every move
   * button disables while any move runs (issue #43), and the clicked
   * button on the moving card shows the loading spinner. One object holds
   * the item and the direction together, because they always change at
   * the same time. */
  moving: { item: CourseItemRef; direction: "up" | "down" } | null;
  /** Click handler for the [Move up] button (issue #44). */
  onMoveUp: () => void;
  /** Click handler for the [Move down] button (issue #43). */
  onMoveDown: () => void;
};

/** daisyUI badge class per item type, so the two types are told apart at a glance. */
function itemTypeBadgeClass(itemType: "lesson" | "assignment") {
  // badge-outline keeps both types subtle (border + text color only, no
  // filled background); the color class still tells the types apart.
  return itemType === "lesson"
    ? "badge-outline badge-accent"
    : "badge-outline badge-primary";
}

/**
 * One course item on the author's Course Details tab (issue #33): a daisyUI
 * card in the SubmissionCard / AnswerCard style, with the item's title in
 * the .card-title and move up / move down buttons.
 *
 * The [Move down] button is wired to the moveCourseItemDown server fn
 * (issue #43) and the [Move up] button to the moveCourseItemUp server fn
 * (issue #44): clicking either swaps the item's course_items position with
 * the neighboring item, then reloads the route data so the outline
 * re-renders in the new order. The route owns the in-flight state and
 * hands it down as moving, so while any move runs, every move button
 * disables and the clicked button shows a loading spinner — a second
 * reorder cannot start before the first one lands.
 *
 * Lesson cards carry a "Delete lesson" action (issue #40): it opens the
 * ConfirmModal and, on Okay, deletes the lesson row and its course_items
 * outline row through the deleteLesson server fn, then reloads the route
 * data. Assignment cards get no delete action (issue #41 covers them).
 */
export default function AuthorCourseItemCard({
  itemType,
  itemId,
  title,
  courseId,
  isFirst,
  isLast,
  moving,
  onMoveUp,
  onMoveDown,
}: AuthorCourseItemCardProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const showMoveUp = !isFirst;
  const showMoveDown = !isLast;
  // Every move button disables while any outline move is in flight, so a
  // second reorder cannot start before the first one lands (issue #43).
  const moveDisabled = moving !== null;
  // The moving card is the one whose coordinates match the move in flight.
  const isMovingCard =
    moving !== null &&
    moving.item.itemType === itemType &&
    moving.item.itemId === itemId;
  // Only the clicked button shows the spinner; the other move buttons on
  // the same card disable without one.
  const moveUpPending = isMovingCard && moving.direction === "up";
  const moveDownPending = isMovingCard && moving.direction === "down";
  return (
    <div className="card w-full bg-base-100 border-2 border-base-300 shadow-md">
      {/* Header strip: item title link, with the type badge on the right
          (like the status badge on the student course page cards). */}
      <div className="flex items-center justify-between bg-base-300 px-4 py-2.5 rounded-t-[14px] border-b-2 border-base-300">
        <h2 className="card-title">
          {itemType === "lesson" ? (
            <Link
              to="/courses/$courseId/lessons/$lessonId/edit"
              params={{ courseId, lessonId: String(itemId) }}
              className="link hover:font-bold hover:text-primary"
            >
              {title}
            </Link>
          ) : (
            <Link
              to="/assignments/$assignmentId"
              params={{ assignmentId: String(itemId) }}
              className="link hover:font-bold hover:text-primary"
            >
              {title}
            </Link>
          )}
        </h2>
        <span className={`badge capitalize ${itemTypeBadgeClass(itemType)}`}>
          {itemType}
        </span>
      </div>

      {/* Main window content area: the move controls and, on lesson cards,
          the delete action. [Move down] calls the moveCourseItemDown server
          fn through the route's onMoveDown handler (issue #43); [Move up]
          calls the moveCourseItemUp server fn through the route's onMoveUp
          handler (issue #44). A single-item assignment card shows no
          button, so the body renders only when something can be shown. */}
      {(showMoveUp || showMoveDown || itemType === "lesson") && (
        <div className="card-body">
          <div className="card-actions justify-end">
            {showMoveUp && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={moveDisabled}
                onClick={onMoveUp}
              >
                {moveUpPending ? (
                  // daisyUI spinner while the move server fn runs, like the
                  // ConfirmModal's Okay button (issue #43).
                  <span className="loading loading-spinner"></span>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="inline-block h-4 w-4 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.25"
                      d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"
                    />
                  </svg>
                )}
                Move up
              </button>
            )}
            {showMoveDown && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={moveDisabled}
                onClick={onMoveDown}
              >
                {moveDownPending ? (
                  // daisyUI spinner while the move server fn runs, like the
                  // ConfirmModal's Okay button (issue #43).
                  <span className="loading loading-spinner"></span>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="inline-block h-4 w-4 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.25"
                      d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"
                    />
                  </svg>
                )}
                Move down
              </button>
            )}
            {itemType === "lesson" && (
              <button
                type="button"
                className="btn btn-error btn-sm"
                onClick={() => setDeleteOpen(true)}
              >
                Delete lesson
              </button>
            )}
          </div>
        </div>
      )}

      {itemType === "lesson" && (
        <ConfirmModal
          open={deleteOpen}
          message={`Delete lesson "${title}"? This cannot be undone.`}
          onConfirm={async () => {
            // Remove the lesson and its outline row, then reload the route
            // so the outline drops the card. The ConfirmModal keeps the
            // button spinning until this resolves, so the delete cannot be
            // double-fired while the page reloads.
            await deleteLesson({
              data: { lessonId: itemId },
            });
            await router.invalidate();
          }}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
