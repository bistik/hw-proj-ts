import { dbGetLesson } from "@/db/lessons/get-lesson";
import { getCurrentUser } from "@/lib/auth";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

export const getLesson = createServerFn({ method: "GET" })
  .validator(z.number().int().positive("Invalid lesson id"))
  .handler(async ({ data: lessonId }) => {
    const user = await getCurrentUser();
    try {
      return await dbGetLesson(lessonId, user.id);
    } catch (err) {
      console.error(`Error fetching lesson ${lessonId}`, err);
      throw new Error(`Could not load lesson`, { cause: err });
    }
  });
