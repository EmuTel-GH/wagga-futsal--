/** Public base URL for links we hand out (APP_URL at runtime, else the request's origin). */
export const siteUrl = (req: Request) => (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
