import { runCrank } from "@/lib/crank";
import { env } from "@/lib/env";
import { ok, fail, route } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hit every 1-2 minutes by an external scheduler (cron-job.org, Vercel Cron, GitHub Actions)
// with the header:  Authorization: Bearer <CRON_SECRET>
async function handler(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) return fail("unauthorized", 401);
  return ok(await runCrank());
}

export const GET = route(handler);
export const POST = route(handler);
