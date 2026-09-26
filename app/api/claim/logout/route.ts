import { ok, route } from "@/lib/http";
import { endSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  endSession();
  return ok({ ok: true });
});
