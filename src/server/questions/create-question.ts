import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { requireUserOwnsCourse } from "@/db/authz";
import { dbCreateQuestion } from "@/db/questions/create-question";
import { getCurrentUser } from "@/lib/auth";
import { questionFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createQuestion = createServerFn({ method: "POST" })
  .validator(questionFormSchema)
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    const assignment = await dbGetAssignment(data.assignmentId);
    if (!assignment?.courseId) {
      throw new Error("Course not found");
    }
    await requireUserOwnsCourse(assignment.courseId, user.id);
    try {
      const result = await dbCreateQuestion({ ...data });
      return result;
    } catch (err) {
      console.error("Error in inserting a question record", err);
      throw new Error("Could not create a question.", { cause: err });
    }
  });
