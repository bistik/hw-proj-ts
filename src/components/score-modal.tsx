import { useEffect, useRef } from "react";

/**
 * The student's score modal (issue #95). Shown after the student
 * submits an assignment whose "Check answers on submit" toggle is on
 * and the submit auto-checked the answers.
 *
 * Renders the auto-check result as "Your score: <correct>/<total>"
 * over all questions of the assignment, together with a confetti.
 * The single action is a [Close] button: the parent uses it to
 * navigate back to the student's course page.
 *
 * Like ConfirmModal, the dialog opens through showModal(), so an open
 * modal carries the daisyUI `open` attribute.
 */
export default function ScoreModal({
  score,
  total,
  onClose,
}: {
  score: number;
  total: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box">
        <p className="py-4 text-center text-xl font-bold">
          Your score: {score}/{total}
        </p>
        <div
          data-testid="confetti"
          aria-hidden="true"
          className="py-4 text-center text-3xl"
        >
          🎉 🎊 🎉
        </div>
        <div className="modal-action">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
