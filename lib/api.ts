import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, httpStatusFor } from "./errors";
import { fieldErrors } from "./forms";

// JSON API conventions: errors are { error: string, fields?: Record<field, message> }.

export function apiError(status: number, error: string, fields?: Record<string, string>) {
  return NextResponse.json(fields ? { error, fields } : { error }, { status });
}

/** Wraps a route handler so expected errors become JSON responses instead of 500s. */
export function handle<Context>(handler: (request: Request, context: Context) => Promise<Response>) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof AppError) return apiError(httpStatusFor[error.code], error.message);
      if (error instanceof ZodError) {
        return apiError(400, error.issues[0]?.message ?? "Invalid request.", fieldErrors(error));
      }
      console.error(error);
      return apiError(500, "Something went wrong. Please try again.");
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("BAD_REQUEST", "The request body must be valid JSON.");
  }
}
