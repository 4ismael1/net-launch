// Cliente de Launch Library 2 con presupuesto de peticiones, timeout y backoff.
// Solo lo usa el sincronizador (scripts/sync.ts), nunca el frontend.

export class BudgetExceededError extends Error {}
export class RateLimitedError extends Error {
  constructor(public retryAfterSec: number | null) {
    super(`LL2 rate limit (retry-after: ${retryAfterSec ?? "?"}s)`);
  }
}

export interface Page<T> {
  count: number;
  next: string | null;
  results: T[];
}

export class LL2Client {
  requests = 0;

  constructor(
    private baseUrl: string,
    private maxRequests: number,
    private timeoutMs = 30_000,
  ) {}

  get remaining() {
    return this.maxRequests - this.requests;
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(this.baseUrl.replace(/\/$/, "") + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
    url.searchParams.set("format", "json");

    for (let attempt = 0; attempt < 3; attempt++) {
      if (this.requests >= this.maxRequests) throw new BudgetExceededError("Presupuesto de peticiones agotado");
      this.requests++;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { "User-Agent": "NET-academic-launch-monitor/0.1" },
      }).catch((e: Error) => e);

      if (res instanceof Error) {
        if (attempt === 2) throw res;
      } else if (res.status === 429) {
        // No reintentamos: cada reintento gasta presupuesto y alarga el bloqueo.
        const ra = Number(res.headers.get("retry-after"));
        throw new RateLimitedError(Number.isFinite(ra) ? ra : null);
      } else if (res.status >= 500) {
        if (attempt === 2) throw new Error(`LL2 ${res.status} en ${url.pathname}`);
      } else if (!res.ok) {
        throw new Error(`LL2 ${res.status} en ${url.pathname}: ${(await res.text()).slice(0, 200)}`);
      } else {
        return (await res.json()) as T;
      }
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
    throw new Error("unreachable");
  }
}
