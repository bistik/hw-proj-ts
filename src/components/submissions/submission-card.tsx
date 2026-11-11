import type { ReactNode } from "react";

type SubmissionCardProps = {
  cardTitle: string;
  cardDescription?: ReactNode;
  handleCompleted: () => void;
  handleReset?: () => void;
  /** Hide and disable the options menu while its actions are not wired to the server. */
  actionsDisabled?: boolean;
};

export default function SubmissionCard({
  handleCompleted,
  handleReset,
  cardTitle,
  cardDescription,
  actionsDisabled = false,
}: SubmissionCardProps) {
  return (
    <div className="card w-full bg-base-100 border-2 border-base-300 shadow-md">
      <div className="flex items-center justify-end bg-base-300 px-4 py-2.5 rounded-t-[14px] border-b-2 border-base-300">
        <div className="dropdown dropdown-end">
          <div
            tabIndex={actionsDisabled ? -1 : 0}
            role="button"
            aria-label="Window options"
            aria-disabled={actionsDisabled}
            className={
              actionsDisabled
                ? "btn btn-ghost btn-circle btn-sm btn-disabled pointer-events-none opacity-50"
                : "btn btn-ghost btn-circle btn-sm hover:bg-base-100/60"
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="inline-block h-6 w-6 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.25"
                d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
              />
            </svg>
          </div>

          {/* Larger, High-Contrast Dropdown Menu. Hidden while actions are disabled. */}
          {!actionsDisabled && (
            <ul
              tabIndex={0}
              className="menu menu-md dropdown-content bg-base-100 border-2 border-base-300 rounded-box z-20 mt-2 w-60 p-2.5 shadow-2xl"
            >
              <li>
                <button
                  type="button"
                  className="font-medium py-2.5"
                  onClick={handleCompleted}
                >
                  Mark as completed
                </button>
              </li>
              {handleReset && (
                <li>
                  <button
                    type="button"
                    className="font-medium py-2.5"
                    onClick={handleReset}
                  >
                    Reset to In Progress
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Main Window Content Area */}
      <div className="card-body">
        <h2 className="card-title">{cardTitle}</h2>
        {cardDescription && <p>{cardDescription}</p>}
      </div>
    </div>
  );
}
