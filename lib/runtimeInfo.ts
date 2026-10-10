import { connection } from "next/server";

/**
 * Which build is running and where. APP_VERSION (short git sha) is baked into
 * the image by CI; APP_ENV is set by the server ("staging" on the staging
 * site). connection() makes callers read these per request, so a page that
 * was prerendered at build time can't show a stale or missing value.
 */
export async function runtimeInfo() {
  await connection();
  return {
    version: process.env.APP_VERSION || "dev",
    env: process.env.APP_ENV || "production",
  };
}
