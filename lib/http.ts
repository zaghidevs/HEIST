import "server-only";
import { NextResponse } from "next/server";

export const ok = (data: unknown) => NextResponse.json(data);
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Wraps a route so thrown errors become a JSON error instead of an HTML 500 page. */
export function route<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A): Promise<Response> => {
    try {
      return await fn(...a);
    } catch (e: any) {
      console.error(e);
      return fail(e?.message?.slice(0, 300) || "Something went wrong", 500);
    }
  };
}
