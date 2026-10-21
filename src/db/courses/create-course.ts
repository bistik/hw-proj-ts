import { db } from "@/db/";
import { coursesTable } from "../schema";

export async function dbCreateCourse(data: {
  title: string;
  description: string;
  authorId: string;
}) {
  try {
    await db.insert(coursesTable).values(data);
    return true;
  } catch (err) {
    console.error("Error inserting new course record", err);
    return false;
  }
}
