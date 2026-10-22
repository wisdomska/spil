import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { ApiError } from "./errors";

type Handler<Ctx> = (request: NextRequest, ctx: Ctx, requestId: string) => Promise<unknown>;

const NO_STORE = { "cache-control": "no-store" };

export function json(
  body: unknown,
  init: { status?: number; requestId: string; headers?: HeadersInit },
) {
  return NextResponse.json(body ?? {}, {
    status: init.status ?? 200,
    headers: { ...NO_STORE, "x-request-id": init.requestId, ...init.headers },
  });
}

export function errorResponse(error: ApiError, requestId: string) {
  return json(
    { error: { code: error.code, message: error.message } },
    { status: error.status, requestId },
  );
}

/**
 * Wraps a route handler: request id, JSON envelope, ApiError mapping. Unknown errors become
 * INTERNAL and are logged without request bodies (answers never reach logs).
 */
export function route<Ctx = unknown>(handler: Handler<Ctx>) {
  return async (request: NextRequest, ctx: Ctx) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const body = await handler(request, ctx, requestId);
      if (body instanceof Response) {
        body.headers.set("x-request-id", requestId);
        return body;
      }
      return json(body, { requestId });
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error, requestId);
      console.error(`[api] ${request.method} ${new URL(request.url).pathname} ${requestId}`, error);
      return errorResponse(new ApiError("INTERNAL"), requestId);
    }
  };
}

/** Parses and validates a JSON body. Empty bodies are treated as {}. */
export async function readBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ApiError("BAD_REQUEST", "Body must be JSON.");
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError("BAD_REQUEST", z.prettifyError(parsed.error));
  return parsed.data;
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
