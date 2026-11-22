type SubmitButtonProps = {
  label: string;
  submittingLabel: string;
  isSubmitting: boolean;
  /**
   * Extra disabled state for a form whose action cannot run yet, for
   * example the AI generate form while the assignment has no example.
   * Optional; the button alone stays controlled by isSubmitting.
   */
  disabled?: boolean;
};

export function SubmitButton({
  label,
  submittingLabel,
  isSubmitting,
  disabled = false,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className="btn btn-primary my-4"
      disabled={isSubmitting || disabled}
    >
      {isSubmitting ? (
        <>
          <span className="loading loading-spinner"></span>
          {submittingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}
