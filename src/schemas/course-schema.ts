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

export const lessonUpdateFormSchema = lessonFormSchema
  .omit({ courseId: true })
  .extend({
    lessonId: z
      .number({
        error: "Please select a lesson",
      })
      .int()
      .positive("Please select a valid lesson"),
  });

export const defaultValuesLesson: z.input<typeof lessonFormSchema> = {
  title: "",
  content: "",
  courseId: 0,
};

export const assignmentFormSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }),
  example: z.string(),
  courseId: z
    .number({
      error: "Please select a course",
    })
    .int()
    .positive("Please select a valid course"),
});

export const defaultValuesAssignment: z.input<typeof assignmentFormSchema> = {
  title: "",
  example: "",
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

// Issue #73: bulk creation of questions. The list must hold at least
// one item, and every item needs a non-empty questionText and answer,
// like questionFormSchema. The assignment id follows questionFormSchema
// too. The cap of 100 items stops one POST from carrying thousands
// of items.
export const questionsBulkFormSchema = z.object({
  assignmentId: z
    .number({
      error: "Please select an assignment",
    })
    .int()
    .positive("Please select a valid assignment"),
  questions: z
    .array(
      z.object({
        questionText: z.string().min(1, { message: "Question text is required" }),
        answer: z.string().min(1, { message: "Answer is required" }),
      }),
    )
    .min(1, { message: "At least one question is required" })
    .max(100, { message: "A submission cannot hold more than 100 questions" }),
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

// Only the lessonId: the deleteLesson server fn derives the courseId from
// the lesson row, so a client-sent course id cannot point the delete at a
// lesson of another course.
export const deleteLessonSchema = z.object({
  lessonId: z.number().int().positive("Invalid lesson id"),
});

// Only the questionId: the deleteQuestion server fn derives the courseId
// from the question's assignment row (same shape as deleteLessonSchema),
// so a client-sent course id cannot point the delete at another course's
// question.
export const deleteQuestionSchema = z.object({
  questionId: z.number().int().positive("Invalid question id"),
});

// Only the item coordinates: the move server fns derive the courseId from
// the course_items row (same shape as deleteLessonSchema), so a
// client-sent course id cannot point the move at another course's outline.
// The two direction fns share one schema; the aliases keep the per-fn
// names without duplicating the shape.
export const moveCourseItemSchema = z.object({
  itemType: z.enum(["lesson", "assignment"]),
  itemId: z.number().int().positive("Invalid item id"),
});

export const moveCourseItemDownSchema = moveCourseItemSchema;
export const moveCourseItemUpSchema = moveCourseItemSchema;

// Exactly one of the two invite inputs is required: the registered-student
// select (userId) or the email text field for an unregistered invitee
// (inviteEmail, issue #31). "Exactly one of two fields" cannot live on a
// single field, so every violation is reported as a form-level issue and
// rendered through FormErrorAlert.
export const enrollmentFormSchema = z
  .object({
    courseId: z.number().int().positive("Invalid course id"),
    userId: z.string().trim(),
    inviteEmail: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    const hasUser = data.userId.length > 0;
    const hasEmail = data.inviteEmail.length > 0;
    const reject = (message: string) =>
      ctx.addIssue({ code: "custom", message });

    if (hasUser && hasEmail) {
      reject(
        "Choose a registered student or enter an email address, not both.",
      );
    } else if (!hasUser && !hasEmail) {
      reject("Select a student or enter an email address to invite.");
    } else if (hasEmail && !z.email().safeParse(data.inviteEmail).success) {
      reject("Enter a valid email address.");
    }
  });

export const submitAnswerFormSchema = z.object({
  assignmentId: z.number().int().positive("Invalid assignment id"),
  questionId: z.number().int().positive("Invalid question id"),
  answer: z.string().trim().min(1, { message: "Answer is required" }),
});

export const assignmentUpdateFormSchema = z.object({
  assignmentId: z.number().int().positive("Invalid assignment id"),
  title: z.string().trim().min(1, { message: "Title is required" }),
  example: z.string(),
});

export const courseUpdateFormSchema = z.object({
  courseId: z.number().int().positive("Invalid course id"),
  title: z.string().trim().min(1, { message: "Title is required" }),
  description: z.string(),
});
