import { dbCreateAssignment } from "@/db/assignments/create-assignment";
import { assignmentFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createAssignment = createServerFn({ method: "POST" })
  .validator(assignmentFormSchema)
  .handler(async ({ data }) => {
    const result = await dbCreateAssignment({ ...data });
    return result;
  });
