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

export const assignmentFormSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  courseId: z
    .number({
      error: "Please select a course",
    })
    .int()
    .positive("Please select a valid course"),
});

export const defaultValuesAssignment: z.input<typeof assignmentFormSchema> = {
  title: "",
  courseId: 0,
};

export const questionFormSchema = z.object({
  questionText: z.string().min(1, { message: "Question text is required" }),
  answer: z.string().min(1, { message: "Answer is required" }),
  assignmentId: z
    .number({
      error: "Please select an assignment",
    })
    .int()
    .positive("Please select a valid assignment"),
});

export const questionUpdateFormSchema = questionFormSchema
  .pick({ questionText: true, answer: true })
  .extend({
    questionId: z
      .number({
        error: "Please select a question",
      })
      .int()
      .positive("Please select a valid question"),
  });

export const courseByIdSchema = z.object({
  courseId: z.number().int().positive("Invalid course id"),
});
