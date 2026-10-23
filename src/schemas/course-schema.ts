import { z } from "zod";

export const courseFormSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string(),
});

export const defaultCourse: z.input<typeof courseFormSchema> = {
  title: "",
  description: "",
};

export const lessonFormSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  content: z.string().min(1, { message: "Content is required" }),
  courseId: z
    .number({
      error: "Please select a course",
    })
    .int()
    .positive("Please select a valid course"),
});

export const defaultValuesLesson: z.input<typeof lessonFormSchema> = {
  title: "",
  content: "",
  courseId: 0,
};
