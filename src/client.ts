import { WayforthError } from './errors.js';
import type {
  WayforthClientOptions,
  SearchOptions,
  SearchResponse,
  ExecuteResult,
  RunOptions,
  RunResult,
  BalanceResponse,
  ServicesOptions,
  ServicesResponse,
  CompareResponse,
} from './types.js';

const DEFAULT_BASE_URL = 'https://gateway.wayforth.io';
const DEFAULT_TIMEOUT_MS = 30_000;

export class WayforthClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: WayforthClientOptions) {
    if (!options.apiKey) throw new Error('apiKey is required');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  private headers(): Record<string, string> {
    return {
      'X-Wayforth-API-Key': this.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(
    method: string,
    path: string,
    opts?: {
      query?: Record<string, string | number | boolean | undefined | null>;
      body?: unknown;
    },
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (opts?.query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.query)) {
        if (v != null) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: this.headers(),
        signal: controller.signal,
        ...(opts?.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new WayforthError('Request timed out', 408, 'timeout');
      }
      throw err;
    }
    clearTimeout(timer);

    if (!res.ok) {
      let raw: unknown;
      try {
        raw = await res.json();
      } catch {
        raw = {};
      }

      // Gateway error shape: { detail: string | { error, message, ... } }
      const detail =
        raw != null && typeof raw === 'object' && 'detail' in (raw as object)
          ? (raw as { detail: unknown }).detail
          : raw;

      const message =
        typeof detail === 'string'
          ? detail
          : typeof detail === 'object' && detail !== null
            ? ((detail as Record<string, unknown>).message as string | undefined) ??
              ((detail as Record<string, unknown>).error as string | undefined) ??
              `HTTP ${res.status}`
            : `HTTP ${res.status}`;

      const code =
        typeof detail === 'object' && detail !== null
          ? ((detail as Record<string, unknown>).error as string | undefined) ??
            String(res.status)
          : String(res.status);

      throw new WayforthError(message, res.status, code);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Semantic search across ~5,000 indexed APIs.
   * @param query Natural language query (e.g. "translate text to Japanese")
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    return this.request<SearchResponse>('GET', '/search', {
      query: {
        q: query,
        limit: options?.limit,
        category: options?.category,
        tier: options?.tier,
      },
    });
  }

  /**
   * Execute a managed service by slug. Wayforth holds the upstream API key.
   * @param serviceSlug Managed service slug (e.g. "deepl", "groq", "serper")
   * @param params      Service-specific request parameters
   */
  async execute(
    serviceSlug: string,
    params: Record<string, unknown>,
  ): Promise<ExecuteResult> {
    return this.request<ExecuteResult>('POST', '/execute', {
      body: { service_slug: serviceSlug, params },
    });
  }

  /**
   * One-call intent routing: search → select best service → execute.
   * @param intent Natural language description of what you want to do
   */
  async run(intent: string, options?: RunOptions): Promise<RunResult> {
    return this.request<RunResult>('POST', '/run', {
      body: { intent, ...options },
    });
  }

  /**
   * Fetch your current credit balance and plan details.
   */
  async balance(): Promise<BalanceResponse> {
    return this.request<BalanceResponse>('GET', '/billing/balance');
  }

  /**
   * Browse the service catalog with optional filtering.
   */
  async services(options?: ServicesOptions): Promise<ServicesResponse> {
    return this.request<ServicesResponse>('GET', '/services', {
      query: {
        category: options?.category,
        tier: options?.tier,
        limit: options?.limit,
        offset: options?.offset,
        sort: options?.sort,
        protocol: options?.protocol,
      },
    });
  }

  /**
   * Compare two services side-by-side (requires Starter plan or above).
   * @param slugA First service slug
   * @param slugB Second service slug
   */
  async compare(slugA: string, slugB: string): Promise<CompareResponse> {
    return this.request<CompareResponse>('GET', '/compare', {
      query: { slugs: `${slugA},${slugB}` },
    });
  }
}
