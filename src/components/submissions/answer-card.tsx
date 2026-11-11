type AnswerCardProps = {
  /** Zero-based position of the question in the assignment. */
  position: number;
  questionText: string;
  studentAnswer: string | null;
  correctAnswer: string;
  /** null while the answer is not graded yet. */
  isCorrect: boolean | null;
  /** Show the Correct/Mistake actions (only for submitted, answered questions). */
  gradable: boolean;
  onGrade: (isCorrect: boolean) => void;
};

/** Card for one question of a submission under review by the course author. */
export default function AnswerCard({
  position,
  questionText,
  studentAnswer,
  correctAnswer,
  isCorrect,
  gradable,
  onGrade,
}: AnswerCardProps) {
  return (
    <div className="card w-full bg-base-100 border-2 border-base-300 shadow-md">
      {/* Header strip: question heading with the grade mark on the right. */}
      <div className="flex items-center justify-between bg-base-300 px-4 py-2.5 rounded-t-[14px] border-b-2 border-base-300">
        <h2 className="card-title">Question #{position + 1}</h2>
        {isCorrect === true && <span className="badge badge-success">✓</span>}
        {isCorrect === false && <span className="badge badge-error">✗</span>}
      </div>

      {/* Main Window Content Area */}
      <div className="card-body">
        <p>
          <span className="font-bold">Question: </span>
          {questionText}
        </p>
        {studentAnswer !== null && (
          <p>
            <span className="font-bold">Student answer: </span>
            {studentAnswer}
          </p>
        )}
        <p>
          <span className="font-bold">Correct answer: </span>
          {correctAnswer}
        </p>
        {gradable && studentAnswer !== null && (
          <div className="card-actions justify-end">
            <button
              type="button"
              className="btn bg-success text-success-content hover:opacity-80"
              onClick={() => onGrade(true)}
            >
              Correct
            </button>
            <button
              type="button"
              className="btn bg-error text-error-content hover:opacity-80"
              onClick={() => onGrade(false)}
            >
              Mistake
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
