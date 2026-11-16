import { Link } from "@tanstack/react-router";

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
 * The buttons have no actions yet (issue #34 will wire them to the reorder
 * endpoint): they render only where the move is possible and do nothing.
 */
export default function AuthorCourseItemCard({
  itemType,
  itemId,
  title,
  courseId,
  isFirst,
  isLast,
}: AuthorCourseItemCardProps) {
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

      {/* Main window content area: the move controls. No onClick handlers
          yet — reordering lands with the reorder course items endpoint. */}
      <div className="card-body">
        <div className="card-actions justify-end">
          {!isFirst && (
            <button type="button" className="btn btn-secondary btn-sm">
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
              Move up
            </button>
          )}
          {!isLast && (
            <button type="button" className="btn btn-secondary btn-sm">
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
              Move down
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
