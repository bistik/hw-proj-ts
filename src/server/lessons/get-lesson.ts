import { dbGetLesson } from "@/db/lessons/get-lesson";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

export const getLesson = createServerFn({ method: "GET" })
  .validator(z.number().int().positive("Invalid lesson id"))
  .middleware([authMiddleware])
  .handler(async ({ data: lessonId, context }) => {
    try {
      return await dbGetLesson(lessonId, context.user.id);
    } catch (err) {
      console.error(`Error fetching lesson ${lessonId}`, err);
      throw new Error(`Could not load lesson`, { cause: err });
    }
  });
