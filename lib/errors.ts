// Expected failures (bad state, missing records, lost booking races) are thrown
// as AppError so API routes and server actions can turn them into clean
// responses instead of 500s.

export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "SLOT_UNAVAILABLE"
  | "BUSY"
  | "RATE_LIMITED";

export const httpStatusFor: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_STATE: 409,
  SLOT_UNAVAILABLE: 409,
  BUSY: 409,
  RATE_LIMITED: 429,
};

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
