import { useEffect, useRef, useState } from "react";

/**
 * Generic confirmation modal with [Okay] and [Cancel] buttons.
 *
 * onConfirm may be async: while it is pending, the Okay button shows a
 * spinner and both actions are disabled — the modal also stays open over
 * the page, which double-clicks-proofs the confirmed action until it
 * resolves (e.g. while the page reloads behind it).
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *
 *   <ConfirmModal
 *     open={open}
 *     message="This action cannot be undone. Delete it?"
 *     onConfirm={handleDelete}
 *     onClose={() => setOpen(false)}
 *   />
 */
export default function ConfirmModal({
  open,
  message,
  onConfirm,
  onClose,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box">
        <p className="py-4">{message}</p>
        <div className="modal-action">
          <form method="dialog">
            <button className="btn btn-ghost" disabled={confirming}>
              Cancel
            </button>
          </form>
          <button
            className="btn btn-primary"
            disabled={confirming}
            onClick={async () => {
              setConfirming(true);
              try {
                await onConfirm();
              } finally {
                setConfirming(false);
              }
              dialogRef.current?.close();
            }}
          >
            {confirming ? (
              <>
                <span className="loading loading-spinner"></span>
                Okay
              </>
            ) : (
              "Okay"
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
