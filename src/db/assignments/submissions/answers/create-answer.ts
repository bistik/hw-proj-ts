import { db } from "@/db";
import { submissionAnswersTable } from "@/db/schema";

export async function dbUpsertAnswer(data: {
  questionId: number;
  submissionId: number;
  answer: string;
}) {
  return db
    .insert(submissionAnswersTable)
    .values(data)
    .onConflictDoUpdate({
      target: [
        submissionAnswersTable.questionId,
        submissionAnswersTable.submissionId,
      ],
      set: { answer: data.answer },
    })
    .returning({ id: submissionAnswersTable.id });
}
