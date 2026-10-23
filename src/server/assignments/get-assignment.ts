import { dbGetAssignment } from "@/db/assignments/get-assignment";
import { createServerFn } from "@tanstack/react-start";

export const getAssignmentById = createServerFn({
  method: "GET",
})
  .validator((assignmentId: number) => assignmentId)
  .handler(async ({ data: assignmentId }) => {
    const result = await dbGetAssignment(assignmentId);
    return result;
  });
