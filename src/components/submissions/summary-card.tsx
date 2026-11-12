type SubmissionSummaryCardProps = {
  assigneeName: string;
  assigneeEmail: string;
  startedAt: Date | string;
  correctCount: number;
  total: number;
  /** Offer the "Mark as completed" action (submitted, not yet completed). */
  canComplete: boolean;
  onComplete: () => void;
};

function formatStartedAt(startedAt: Date | string) {
  return new Date(startedAt).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Summary card for a submission under review by the course author. */
export default function SubmissionSummaryCard({
  assigneeName,
  assigneeEmail,
  startedAt,
  correctCount,
  total,
  canComplete,
  onComplete,
}: SubmissionSummaryCardProps) {
  return (
    <div className="card w-full bg-base-100 border-2 border-base-300 shadow-md">
      {/* Header strip in a muted dark color so the summary stands out from
          the base-300 header strips of the answer cards. */}
      <div className="flex items-center bg-neutral text-neutral-content px-4 py-2.5 rounded-t-[14px] border-b-2 border-base-300">
        <h2 className="card-title">Submission overview</h2>
      </div>

      {/* Main Window Content Area */}
      <div className="card-body">
        <p>{assigneeEmail}</p>
        <p>{assigneeName}</p>
        <p>Started: {formatStartedAt(startedAt)}</p>
        <p>
          {correctCount} of {total}
        </p>
        {canComplete && (
          <div className="card-actions justify-end">
            <button
              type="button"
              className="btn bg-primary text-primary-content hover:opacity-80"
              onClick={onComplete}
            >
              Mark as completed
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
