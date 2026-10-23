import { dbCreateQuestion } from "@/db/questions/create-question";
import { questionFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createQuestion = createServerFn({ method: "POST" })
  .validator(questionFormSchema)
  .handler(async ({ data }) => {
    const result = await dbCreateQuestion({ ...data });
    return result;
  });
