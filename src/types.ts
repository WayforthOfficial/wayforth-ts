export interface WayforthClientOptions {
  /** Your Wayforth API key — get one at wayforth.io/signup */
  apiKey: string;
  /** Override the gateway base URL (default: https://gateway.wayforth.io) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchOptions {
  /** Maximum results to return (default: gateway default) */
  limit?: number;
  /** Filter by category: "inference" | "translation" | "data" | "search" | etc. */
  category?: string;
  /** Filter by minimum coverage tier (0–3) */
  tier?: number;
}

export interface PaymentOptions {
  track_a: {
    method: 'card';
    processor: string;
    credits_needed: number;
  };
  track_b: {
    method: 'crypto';
    network: string;
    amount_usdc: number;
    calldata_via: string;
  };
  x402_supported: boolean;
}

export interface SearchResult {
  name: string;
  slug: string | null;
  description: string | null;
  /** Semantic relevance score (0–100) */
  score: number;
  /** WayforthRank reliability index (0–100) */
  wri: number;
  ranking_version: 'v1' | 'v2';
  reason: string;
  /** Coverage tier: 0=submitted, 1=probed, 2=verified, 3=managed */
  coverage_tier: 0 | 1 | 2 | 3;
  category: string | null;
  pricing: { per_call_usd: number | null };
  service_id: string;
  wayforth_id: string;
  payment_options: PaymentOptions;
  /** True if the provider currently has an active Pioneer Boost window */
  boost_active: boolean;
  new_provider?: boolean;
  boost_expires_in_days?: number;
}

export interface SearchResponse {
  query_id: string;
  query: string;
  total_results: number;
  total_matches: number;
  results: SearchResult[];
  fallback: boolean;
  fallback_reason: string | null;
  // Authenticated callers
  tier?: string;
  usage_this_month?: number;
  monthly_quota?: number;
  // Unauthenticated callers
  anonymous_searches_remaining?: number;
  signup_url?: string;
  message?: string;
  // Pioneer routing metadata (authenticated)
  pioneer_routing?: boolean;
  pioneer_routed_to_boosted?: boolean;
  signal_weight?: number | null;
}

// ── Execute ───────────────────────────────────────────────────────────────────

export interface ExecuteResult {
  status: 'ok';
  /** The slug of the service that handled the call */
  service: string;
  /** Raw upstream API response */
  result: unknown;
  credits_deducted: number;
  execution_ms: number;
  managed_services_available: number;
  priority: boolean;
  /** Set when the primary service was unavailable and a fallback was used */
  fallback_from?: string;
  fallback_reason?: string;
}

// ── Run ───────────────────────────────────────────────────────────────────────

export interface RunOptions {
  /** Structured input passed to the selected service */
  input?: Record<string, unknown>;
  preferences?: {
    category?: string;
    max_price_per_call?: number;
    /** Minimum coverage tier (default: 2) */
    tier_min?: number;
  };
  agent_id?: string;
}

export interface RunResult {
  /** Raw upstream API response */
  result: unknown;
  service_used: {
    slug: string;
    name: string;
    wri_score: number | null;
    category: string | null;
    credits_used: number;
  };
  search_context: {
    intent: string;
    results_considered: number;
    selected_rank: number;
  };
  credits_remaining: number;
  /** Backward-compat alias for credits_remaining */
  calls_remaining: number;
  execution_ms: number;
  priority: boolean;
  fallback_from?: string;
  fallback_reason?: string;
}

// ── Balance ───────────────────────────────────────────────────────────────────

export interface BalanceResponse {
  plan: string;
  credits_remaining: number;
  credits_included: number;
  /** Backward-compat alias for credits_remaining */
  calls_remaining: number;
  pioneer_credits_remaining?: number;
  total_credits?: number;
  forecast?: {
    daily_avg_credits: number;
    days_remaining_at_current_rate: number;
    daily_avg_calls?: number;
  };
}

// ── Services ──────────────────────────────────────────────────────────────────

export interface Service {
  id: string;
  name: string;
  description: string | null;
  endpoint_url: string | null;
  category: string | null;
  pricing_usdc: number | null;
  coverage_tier: number;
  payment_protocol: string;
  source: string;
  created_at: string;
  last_tested_at: string | null;
  consecutive_failures: number;
  x402_supported: boolean;
}

export interface ServicesOptions {
  category?: string;
  /** Filter by exact coverage tier */
  tier?: number;
  limit?: number;
  offset?: number;
  sort?: string;
  protocol?: 'wayforth' | 'x402' | 'any';
}

export interface ServicesResponse {
  services: Service[];
  total: number;
  limit: number;
  offset: number;
  filters: {
    category: string | null;
    tier: number | null;
    protocol: string | null;
    real_only: boolean;
  };
}

// ── Compare ───────────────────────────────────────────────────────────────────

export interface CompareService {
  slug: string;
  name: string;
  wri_score: number | null;
  coverage_tier: number;
  category: string | null;
  pricing_usdc: number | null;
  consecutive_failures: number;
}

export interface CompareResponse {
  services: CompareService[];
  recommendation?: string;
  [key: string]: unknown;
}
