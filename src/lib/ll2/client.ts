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

export type LL2ClientOptions = {
  timeoutMs?: number;
  /** Hora límite (ms epoch): pasada, no se reintenta y el timeout se acorta (deadline + 10 s). */
  deadline?: number;
  /** Se ejecuta (y se espera) ANTES de cada petición: registrar en el presupuesto, comprobar el candado… */
  beforeRequest?: () => Promise<void>;
};

export class LL2Client {
  requests = 0;
  private timeoutMs: number;
  private deadline: number;

  constructor(
    private baseUrl: string,
    private maxRequests: number,
    private opts: LL2ClientOptions = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.deadline = opts.deadline ?? Infinity;
  }

  get remaining() {
    return this.maxRequests - this.requests;
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(this.baseUrl.replace(/\/$/, "") + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
    url.searchParams.set("format", "json");

    let last: Error = new Error(`LL2 sin respuesta en ${url.pathname}`);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        if (Date.now() > this.deadline) break; // sin tiempo para reintentar
        await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
      }
      if (this.requests >= this.maxRequests) throw new BudgetExceededError("Presupuesto de peticiones agotado");
      await this.opts.beforeRequest?.();
      this.requests++;
      const timeout = Math.min(this.timeoutMs, Math.max(5000, this.deadline + 10_000 - Date.now()));
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
        headers: { "User-Agent": "NET-academic-launch-monitor/0.1" },
      }).catch((e: Error) => e);

      if (res instanceof Error) {
        last = res;
      } else if (res.status === 429) {
        // No reintentamos: cada reintento gasta presupuesto y alarga el bloqueo.
        const ra = Number(res.headers.get("retry-after"));
        await res.body?.cancel().catch(() => {});
        throw new RateLimitedError(res.headers.get("retry-after") && Number.isFinite(ra) ? ra : null);
      } else if (res.status >= 500) {
        await res.body?.cancel().catch(() => {});
        last = new Error(`LL2 ${res.status} en ${url.pathname}`);
      } else if (!res.ok) {
        throw new Error(`LL2 ${res.status} en ${url.pathname}: ${(await res.text()).slice(0, 200)}`);
      } else {
        return (await res.json()) as T;
      }
    }
    throw last;
  }
}
