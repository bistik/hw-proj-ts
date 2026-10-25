import { db } from "@/db/";
import { coursesTable } from "../schema";

export async function dbCreateCourse(data: {
  title: string;
  description: string;
  authorId: string;
}) {
  return db
    .insert(coursesTable)
    .values(data)
    .returning({ courseId: coursesTable.id })
    .then((res) => res[0]);
}
