import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { createServerFn } from "@tanstack/react-start";

export const getAssignmentById = createServerFn({
  method: "GET",
})
  .validator((assignmentId: number) => assignmentId)
  .handler(async ({ data: assignmentId }) => {
    try {
      const result = await dbGetAssignment(assignmentId);
      return result;
    } catch (err) {
      console.error(`Error fetching assignment ${assignmentId}`, err);
      throw new Error(`Error in fetching assignment`, { cause: err });
    }
  });
