import { HarborErrorPayload } from "./types";

/** The Harbor API answered with a non-2xx status. */
export class HarborApiError extends Error {
  constructor(
    readonly status: number,
    readonly requestUrl: string,
    detail: string,
  ) {
    super(`Harbor API returned ${status}${detail ? `: ${detail}` : ""}`);
    this.name = "HarborApiError";
  }

  static async fromResponse(response: Response, requestUrl: string): Promise<HarborApiError> {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as HarborErrorPayload;
      const message = payload.errors?.find((e) => e.message)?.message;
      if (message) {
        detail = message;
      }
    } catch {
      // Not every error response carries the documented JSON error payload.
    }
    return new HarborApiError(response.status, requestUrl, detail);
  }
}

/** The request never got an HTTP response (DNS, TLS, refused connection, timeout…). */
export class HarborConnectionError extends Error {
  constructor(
    readonly requestUrl: string,
    cause: unknown,
  ) {
    super(`Could not reach ${new URL(requestUrl).origin}: ${describeCause(cause)}`, { cause });
    this.name = "HarborConnectionError";
  }
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    if (cause.name === "TimeoutError") {
      return "the request timed out";
    }
    // Node's fetch reports network failures as "fetch failed" and keeps the
    // useful reason (ECONNREFUSED, certificate errors…) in `cause`.
    const inner = cause.cause;
    if (inner instanceof Error && inner.message) {
      return inner.message;
    }
    return cause.message;
  }
  return String(cause);
}
