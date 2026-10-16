import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { env } from "@/lib/env";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite", // or "pg" or "mysql"
    usePlural: true,
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: env("GITHUB_CLIENT_ID"),
      clientSecret: env("GITHUB_CLIENT_SECRET"),
    },
    google: {
      clientId: env("GOOGLE_CLIENT_ID"),
      clientSecret: env("GOOGLE_CLIENT_SECRET"),
    },
  },
  plugins: [tanstackStartCookies()],
});
