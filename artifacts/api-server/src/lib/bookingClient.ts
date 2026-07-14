// Thin HTTP client for the standalone booking-service (see
// artifacts/booking-service). This is the only place that knows about its
// base URL/API key — every route file goes through here so the service
// boundary stays a single, swappable seam (e.g. pointing at a different
// deployment of booking-service just means changing these two env vars).

export class BookingServiceError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Booking service responded with ${status}`);
  }
}

function baseUrl(): string {
  const url = process.env.BOOKING_SERVICE_URL;
  if (!url) {
    throw new Error("BOOKING_SERVICE_URL must be set. Did you forget to configure the booking service?");
  }
  return url.replace(/\/+$/, "");
}

function apiKey(): string {
  const key = process.env.BOOKING_SERVICE_API_KEY;
  if (!key) {
    throw new Error("BOOKING_SERVICE_API_KEY must be set. Did you forget to configure the booking service?");
  }
  return key;
}

export async function bookingRequest<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  options: { query?: Record<string, string | undefined>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-key": apiKey(),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new BookingServiceError(response.status, parsed);
  }
  return parsed as T;
}
