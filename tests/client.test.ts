import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WayforthClient, WayforthError } from '../src/index.js';
import type {
  SearchResponse,
  ExecuteResult,
  RunResult,
  BalanceResponse,
  ServicesResponse,
} from '../src/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown): void {
  const json = async () => body;
  const ok = status >= 200 && status < 300;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, status, json } as Response),
  );
}

function mockFetchError(name: string): void {
  const err = Object.assign(new Error(name), { name });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));
}

const MOCK_SEARCH_RESPONSE: SearchResponse = {
  query_id: 'abc123',
  query: 'translate to japanese',
  total_results: 1,
  total_matches: 4973,
  results: [
    {
      name: 'DeepL API',
      slug: 'deepl',
      description: 'Best-in-class neural machine translation.',
      score: 35,
      wri: 96.0,
      ranking_version: 'v2',
      reason: 'keyword match',
      coverage_tier: 3,
      category: 'translation',
      pricing: { per_call_usd: 0.0008 },
      service_id: '0xabc',
      wayforth_id: 'wayforth://deepl/abc',
      payment_options: {
        track_a: { method: 'card', processor: 'Stripe Treasury', credits_needed: 20 },
        track_b: {
          method: 'crypto',
          network: 'base-sepolia',
          amount_usdc: 0.0008,
          calldata_via: 'wayforth_pay(...)',
        },
        x402_supported: false,
      },
      boost_active: false,
    },
  ],
  fallback: false,
  fallback_reason: null,
  tier: 'growth',
  usage_this_month: 150,
  monthly_quota: 240000,
};

const MOCK_EXECUTE_RESPONSE: ExecuteResult = {
  status: 'ok',
  service: 'deepl',
  result: { translations: [{ text: 'こんにちは' }] },
  credits_deducted: 20,
  execution_ms: 412,
  managed_services_available: 16,
  priority: false,
};

const MOCK_RUN_RESPONSE: RunResult = {
  result: { translations: [{ text: 'こんにちは世界' }] },
  service_used: {
    slug: 'deepl',
    name: 'DeepL',
    wri_score: 96.0,
    category: 'translation',
    credits_used: 20,
  },
  search_context: {
    intent: 'Translate Hello World to Japanese',
    results_considered: 5,
    selected_rank: 1,
  },
  credits_remaining: 239980,
  calls_remaining: 239980,
  execution_ms: 620,
  priority: false,
};

const MOCK_BALANCE_RESPONSE: BalanceResponse = {
  plan: 'growth',
  credits_remaining: 189375,
  credits_included: 240000,
  calls_remaining: 189375,
  forecast: {
    daily_avg_credits: 1919,
    days_remaining_at_current_rate: 98,
  },
};

const MOCK_SERVICES_RESPONSE: ServicesResponse = {
  services: [
    {
      id: 'abc-def',
      name: 'DeepL',
      description: null,
      endpoint_url: 'https://api.deepl.com',
      category: 'translation',
      pricing_usdc: null,
      coverage_tier: 3,
      payment_protocol: 'wayforth',
      source: 'managed',
      created_at: '2026-01-01T00:00:00Z',
      last_tested_at: '2026-06-10T00:00:00Z',
      consecutive_failures: 0,
      x402_supported: false,
    },
  ],
  total: 1,
  limit: 20,
  offset: 0,
  filters: { category: null, tier: null, protocol: null, real_only: true },
};

// ── Client construction ───────────────────────────────────────────────────────

describe('WayforthClient construction', () => {
  it('throws if apiKey is missing', () => {
    expect(() => new WayforthClient({ apiKey: '' })).toThrow('apiKey is required');
  });

  it('accepts a custom baseUrl', () => {
    const c = new WayforthClient({ apiKey: 'wf_test', baseUrl: 'http://localhost:8000' });
    expect(c).toBeInstanceOf(WayforthClient);
  });
});

// ── search ────────────────────────────────────────────────────────────────────

describe('search', () => {
  let client: WayforthClient;
  beforeEach(() => {
    client = new WayforthClient({ apiKey: 'wf_live_test' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns search results on success', async () => {
    mockFetch(200, MOCK_SEARCH_RESPONSE);
    const res = await client.search('translate to japanese', { limit: 5 });
    expect(res.results).toHaveLength(1);
    expect(res.results[0].slug).toBe('deepl');
    expect(res.results[0].wri).toBe(96.0);
    expect(res.total_matches).toBe(4973);
  });

  it('passes query params correctly', async () => {
    mockFetch(200, MOCK_SEARCH_RESPONSE);
    await client.search('translate', { limit: 3, category: 'translation', tier: 2 });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('q=translate');
    expect(url).toContain('limit=3');
    expect(url).toContain('category=translation');
    expect(url).toContain('tier=2');
  });

  it('passes X-Wayforth-API-Key header', async () => {
    mockFetch(200, MOCK_SEARCH_RESPONSE);
    await client.search('test');
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)['X-Wayforth-API-Key']).toBe('wf_live_test');
  });

  it('throws WayforthError on 401', async () => {
    mockFetch(401, { detail: 'Invalid API key' });
    await expect(client.search('hello')).rejects.toThrow(WayforthError);
    await expect(client.search('hello')).rejects.toMatchObject({
      status: 401,
      code: '401',
      message: 'Invalid API key',
    });
  });

  it('throws WayforthError on 429 with code', async () => {
    mockFetch(429, { detail: { error: 'rate_limited', message: 'Too many requests' } });
    const err = await client.search('hello').catch((e) => e as WayforthError);
    expect(err).toBeInstanceOf(WayforthError);
    expect(err.status).toBe(429);
    expect(err.code).toBe('rate_limited');
    expect(err.message).toBe('Too many requests');
  });
});

// ── execute ───────────────────────────────────────────────────────────────────

describe('execute', () => {
  let client: WayforthClient;
  beforeEach(() => {
    client = new WayforthClient({ apiKey: 'wf_live_test' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns execute result on success', async () => {
    mockFetch(200, MOCK_EXECUTE_RESPONSE);
    const res = await client.execute('deepl', { text: 'Hello', target_lang: 'JA' });
    expect(res.status).toBe('ok');
    expect(res.service).toBe('deepl');
    expect(res.credits_deducted).toBe(20);
  });

  it('sends correct POST body with service_slug and params', async () => {
    mockFetch(200, MOCK_EXECUTE_RESPONSE);
    await client.execute('deepl', { text: 'Hello', target_lang: 'JA' });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      service_slug: 'deepl',
      params: { text: 'Hello', target_lang: 'JA' },
    });
  });

  it('throws WayforthError on 402 insufficient credits', async () => {
    mockFetch(402, {
      detail: {
        error: 'insufficient_credits',
        message: 'You need 10 more credits for this call.',
        credits_balance: 0,
        credits_needed: 20,
      },
    });
    const err = await client.execute('deepl', { text: 'hi' }).catch((e) => e as WayforthError);
    expect(err).toBeInstanceOf(WayforthError);
    expect(err.status).toBe(402);
    expect(err.code).toBe('insufficient_credits');
    expect(err.message).toContain('credits');
  });
});

// ── run ───────────────────────────────────────────────────────────────────────

describe('run', () => {
  let client: WayforthClient;
  beforeEach(() => {
    client = new WayforthClient({ apiKey: 'wf_live_test' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns run result on success', async () => {
    mockFetch(200, MOCK_RUN_RESPONSE);
    const res = await client.run('Translate Hello World to Japanese');
    expect(res.service_used.slug).toBe('deepl');
    expect(res.credits_remaining).toBe(239980);
    expect(res.search_context.intent).toBe('Translate Hello World to Japanese');
  });

  it('sends intent in POST body', async () => {
    mockFetch(200, MOCK_RUN_RESPONSE);
    await client.run('Translate Hello World to Japanese');
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.intent).toBe('Translate Hello World to Japanese');
  });

  it('passes preferences and input through', async () => {
    mockFetch(200, MOCK_RUN_RESPONSE);
    await client.run('translate hello', {
      input: { text: 'hello' },
      preferences: { category: 'translation', tier_min: 2 },
    });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.input).toEqual({ text: 'hello' });
    expect(body.preferences).toEqual({ category: 'translation', tier_min: 2 });
  });

  it('throws WayforthError on 401 missing API key', async () => {
    mockFetch(401, { detail: { error: 'X-Wayforth-API-Key header required' } });
    const err = await client.run('do something').catch((e) => e as WayforthError);
    expect(err).toBeInstanceOf(WayforthError);
    expect(err.status).toBe(401);
  });
});

// ── balance ───────────────────────────────────────────────────────────────────

describe('balance', () => {
  let client: WayforthClient;
  beforeEach(() => {
    client = new WayforthClient({ apiKey: 'wf_live_test' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns balance on success', async () => {
    mockFetch(200, MOCK_BALANCE_RESPONSE);
    const res = await client.balance();
    expect(res.plan).toBe('growth');
    expect(res.credits_remaining).toBe(189375);
    expect(res.credits_included).toBe(240000);
    expect(res.forecast?.days_remaining_at_current_rate).toBe(98);
  });

  it('throws WayforthError on 401', async () => {
    mockFetch(401, { detail: 'Invalid API key' });
    const err = await client.balance().catch((e) => e as WayforthError);
    expect(err).toBeInstanceOf(WayforthError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('Invalid API key');
  });
});

// ── services ──────────────────────────────────────────────────────────────────

describe('services', () => {
  let client: WayforthClient;
  beforeEach(() => {
    client = new WayforthClient({ apiKey: 'wf_live_test' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns service list on success', async () => {
    mockFetch(200, MOCK_SERVICES_RESPONSE);
    const res = await client.services({ limit: 1 });
    expect(res.services).toHaveLength(1);
    expect(res.services[0].name).toBe('DeepL');
    expect(res.total).toBe(1);
  });

  it('passes category and tier filters', async () => {
    mockFetch(200, MOCK_SERVICES_RESPONSE);
    await client.services({ category: 'translation', tier: 3, limit: 10 });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('category=translation');
    expect(url).toContain('tier=3');
    expect(url).toContain('limit=10');
  });
});

// ── WayforthError ─────────────────────────────────────────────────────────────

describe('WayforthError', () => {
  it('is an instance of Error', () => {
    const err = new WayforthError('test', 400, 'bad_request');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(WayforthError);
  });

  it('has name WayforthError', () => {
    const err = new WayforthError('msg', 500, 'server_error');
    expect(err.name).toBe('WayforthError');
  });

  it('preserves status and code', () => {
    const err = new WayforthError('Rate limited', 429, 'rate_limited');
    expect(err.status).toBe(429);
    expect(err.code).toBe('rate_limited');
    expect(err.message).toBe('Rate limited');
  });

  it('works with instanceof after throw/catch', () => {
    function thrower() {
      throw new WayforthError('boom', 503, 'service_unavailable');
    }
    try {
      thrower();
    } catch (e) {
      expect(e).toBeInstanceOf(WayforthError);
    }
  });
});

// ── timeout / network errors ──────────────────────────────────────────────────

describe('network errors', () => {
  let client: WayforthClient;
  beforeEach(() => {
    client = new WayforthClient({ apiKey: 'wf_live_test', timeout: 5000 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('wraps AbortError as WayforthError timeout', async () => {
    mockFetchError('AbortError');
    const err = await client.search('hello').catch((e) => e as WayforthError);
    expect(err).toBeInstanceOf(WayforthError);
    expect(err.status).toBe(408);
    expect(err.code).toBe('timeout');
  });
});
