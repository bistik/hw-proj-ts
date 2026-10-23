import { db } from "..";
import { lessonsTable } from "../schema";

export const dbCreateLesson = async function (data: {
  title: string;
  courseId: number;
  content: string;
}) {
  try {
    await db.insert(lessonsTable).values(data);
    return true;
  } catch (err) {
    console.error("Error in inserting lesson", err);
    return false;
  }
};
