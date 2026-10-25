import { dbCreateQuestion } from "@/db/questions/create-question";
import { getCurrentUser } from "@/lib/auth";
import { questionFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createQuestion = createServerFn({ method: "POST" })
  .validator(questionFormSchema)
  .handler(async ({ data }) => {
    await getCurrentUser();
    try {
      const result = await dbCreateQuestion({ ...data });
      return result;
    } catch (err) {
      console.error("Error in inserting a question record", err);
      throw new Error("Could not create a question.", { cause: err });
    }
  });
