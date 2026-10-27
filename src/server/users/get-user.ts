import { dbGetUsers } from "@/db/users/get-user";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

export const getUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    try {
      return await dbGetUsers();
    } catch (err) {
      console.error("Error in fetching users from db");
      throw new Error("Could not retrieve users", { cause: err });
    }
  });
