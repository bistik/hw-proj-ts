type SubmitButtonProps = {
  label: string;
  submittingLabel: string;
  isSubmitting: boolean;
};

export function SubmitButton({
  label,
  submittingLabel,
  isSubmitting,
}: SubmitButtonProps) {
  return (
    <button type="submit" className="btn btn-primary my-4" disabled={isSubmitting}>
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
