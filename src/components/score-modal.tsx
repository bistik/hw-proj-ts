import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";

/**
 * The student's score modal (issue #95). Shown after the student
 * submits an assignment whose "Check answers on submit" toggle is on
 * and the submit auto-checked the answers.
 *
 * Renders the auto-check result as "Your score: <correct>/<total>"
 * over all questions of the assignment, together with a confetti.
 * The confetti is a canvas-confetti burst drawn on the canvas inside
 * the modal (PR #96 review): the dialog carries the top layer, so a
 * full-page canvas would render behind the modal. The canvas carries
 * data-testid="confetti", which the e2e spec uses as its selector.
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
  const confettiRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();

    // Two bursts, one from each side, fired once when the modal opens.
    if (!confettiRef.current) return;
    const fire = confetti.create(confettiRef.current, {
      resize: true,
      useWorker: false,
    });
    fire({ particleCount: 70, spread: 70, origin: { x: 0.2, y: 0.6 } });
    fire({ particleCount: 70, spread: 70, origin: { x: 0.8, y: 0.6 } });
  }, []);

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box">
        <p className="py-4 text-center text-xl font-bold">
          Your score: {score}/{total}
        </p>
        <canvas
          ref={confettiRef}
          data-testid="confetti"
          aria-hidden="true"
          className="h-24 w-full"
        />
        <div className="modal-action">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
