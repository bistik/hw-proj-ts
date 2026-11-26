import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";

/**
 * The student's score modal (issue #95). Shown after the student
 * submits an assignment whose "Check answers on submit" toggle is on
 * and the submit auto-checked the answers.
 *
 * Renders the auto-check result as "Your score: <correct>/<total>"
 * over all questions of the assignment, together with a confetti.
 * The confetti (PR #96 review) is a canvas-confetti fan that fills
 * the screen behind the modal box: the canvas spans the whole dialog
 * (the open dialog covers the viewport), the modal box is z-10 so
 * it paints above the canvas, and pointer-events stay on the dialog
 * and the box. Two narrow jets fire from the bottom corners and aim
 * at the center, so the streams cross and open like a fan while the
 * pieces rise and then fall over the screen. The canvas carries
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

    // Fire the fan once when the modal opens. The animation runs on
    // the main thread, so nothing outlives the closed modal.
    if (!confettiRef.current) return;
    const fire = confetti.create(confettiRef.current, {
      resize: true,
      useWorker: false,
    });
    // Left jet: from the bottom-left corner, aimed up and to the
    // center. angle 60 means 60 degrees from the horizontal.
    fire({
      particleCount: 90,
      angle: 60,
      spread: 25,
      startVelocity: 65,
      origin: { x: 0, y: 1 },
    });
    // Right jet: mirrored, aimed up and to the center. The two jets
    // cross above the modal box and open like a fan.
    fire({
      particleCount: 90,
      angle: 120,
      spread: 25,
      startVelocity: 65,
      origin: { x: 1, y: 1 },
    });
  }, []);

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <canvas
        ref={confettiRef}
        data-testid="confetti"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <div className="modal-box relative z-10">
        <p className="py-4 text-center text-xl font-bold">
          Your score: {score}/{total}
        </p>
        <div className="modal-action">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
