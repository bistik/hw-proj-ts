import { dbCreateAssignment } from "@/db/assignments/create-assignment";
import { getCurrentUser } from "@/lib/auth";
import { assignmentFormSchema } from "@/schemas/course-schema";
import { createServerFn } from "@tanstack/react-start";

export const createAssignment = createServerFn({ method: "POST" })
  .validator(assignmentFormSchema)
  .handler(async ({ data }) => {
    await getCurrentUser();
    try {
      const result = await dbCreateAssignment({ ...data });
      return result;
    } catch (err) {
      console.error("Error in creating assignment", err);
      throw new Error("Could not create assignment.");
    }
  });
