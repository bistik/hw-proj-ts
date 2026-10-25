import { db } from "@/db/";
import { lessonsTable } from "../schema";

export const dbCreateLesson = async function (data: {
  title: string;
  courseId: number;
  content: string;
}) {
  return db
    .insert(lessonsTable)
    .values(data)
    .returning({ lessonId: lessonsTable.id })
    .then((res) => res[0]);
};
