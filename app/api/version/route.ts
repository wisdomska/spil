import { route } from "@/lib/api/handler";

/** GET /api/version: the deployed commit, so CI can wait for its own deployment. */
export const GET = route(async () => ({
  sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  env: process.env.APP_ENV ?? "local",
}));
