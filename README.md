# wayforth-sdk

TypeScript/JavaScript SDK for the [Wayforth](https://wayforth.io) API runtime — one integration for 5,000+ APIs, executed with managed keys.

[![npm](https://img.shields.io/npm/v/wayforth-sdk)](https://www.npmjs.com/package/wayforth-sdk)
[![License](https://img.shields.io/badge/license-BSL_1.1-64748B)](LICENSE)

---

## Install

```bash
npm install wayforth-sdk
# or
pnpm add wayforth-sdk
# or
yarn add wayforth-sdk
```

Requires **Node 18+**. No peer dependencies.

---

## Quickstart

```ts
import { WayforthClient } from 'wayforth-sdk';

const wayforth = new WayforthClient({ apiKey: 'wf_live_...' });

// Search the catalog
const { results } = await wayforth.search('translate text to Japanese');
console.log(results[0].name, results[0].wri); // DeepL API  96.0

// Execute a managed service (Wayforth holds the key)
const { result } = await wayforth.execute('deepl', { text: 'Hello', target_lang: 'JA' });
console.log(result); // { translations: [{ text: 'こんにちは' }] }

// One-call intent routing — search + select + execute in one shot
const run = await wayforth.run('Translate Hello World to Japanese');
console.log(run.service_used.name, run.result);

// Account balance
const bal = await wayforth.balance();
console.log(bal.credits_remaining, '/', bal.credits_included);
```

Get an API key at **[wayforth.io/signup](https://wayforth.io/signup)** — free tier included.

---

## API Reference

### `new WayforthClient(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | required | Your `wf_live_...` API key |
| `baseUrl` | `string` | `https://gateway.wayforth.io` | Override gateway URL |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |

---

### `wayforth.search(query, options?)`

Semantic search across ~5,000 indexed APIs.

```ts
const response = await wayforth.search('real-time stock data', {
  limit: 5,         // max results (optional)
  category: 'data', // filter by category (optional)
  tier: 2,          // minimum coverage tier 0–3 (optional)
});
// response.results: SearchResult[]
// response.total_matches: number
```

**Returns** `SearchResponse`

| Field | Type | Description |
|-------|------|-------------|
| `results` | `SearchResult[]` | Ranked service results |
| `total_matches` | `number` | Total catalog matches |
| `query_id` | `string` | Unique query identifier |

Each `SearchResult`:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Service name |
| `slug` | `string \| null` | Execution slug |
| `wri` | `number` | WayforthRank score 0–100 |
| `coverage_tier` | `0\|1\|2\|3` | 0=submitted · 1=probed · 2=verified · 3=managed |
| `pricing.per_call_usd` | `number \| null` | USD price per call |
| `boost_active` | `boolean` | True if provider has an active Pioneer Boost |

---

### `wayforth.execute(serviceSlug, params)`

Execute a **managed** service by slug. Wayforth holds the upstream API key — no credentials needed.

```ts
const { result, credits_deducted } = await wayforth.execute('deepl', {
  text: 'Hello world',
  target_lang: 'JA',
});
```

Managed slugs: `groq`, `together`, `mistral`, `gemini`, `deepl`, `serper`, `tavily`, `brave`, `openweather`, `newsapi`, `alphavantage`, `jina`, `firecrawl`, `assemblyai`, `stability`, `resend`

**Returns** `ExecuteResult`

| Field | Type | Description |
|-------|------|-------------|
| `result` | `unknown` | Raw upstream API response |
| `service` | `string` | The slug that handled the call |
| `credits_deducted` | `number` | Credits consumed |
| `execution_ms` | `number` | Round-trip latency |

---

### `wayforth.run(intent, options?)`

One-call intent routing: natural language → best service → executed result.

```ts
const { result, service_used } = await wayforth.run(
  'Get current weather in Tokyo',
  {
    preferences: { tier_min: 2, category: 'data' },
  }
);
console.log(service_used.name); // OpenWeather
```

**Returns** `RunResult`

| Field | Type | Description |
|-------|------|-------------|
| `result` | `unknown` | Raw upstream API response |
| `service_used` | `object` | `{ slug, name, wri_score, category, credits_used }` |
| `search_context` | `object` | `{ intent, results_considered, selected_rank }` |
| `credits_remaining` | `number` | Credits left after this call |

---

### `wayforth.balance()`

Fetch your current credit balance and plan details.

```ts
const { plan, credits_remaining, credits_included, forecast } = await wayforth.balance();
```

**Returns** `BalanceResponse`

---

### `wayforth.services(options?)`

Browse the service catalog.

```ts
const { services, total } = await wayforth.services({
  category: 'inference',
  tier: 2,
  limit: 20,
  offset: 0,
});
```

**Returns** `ServicesResponse`

---

### `wayforth.compare(slugA, slugB)`

Side-by-side comparison of two services. Requires Starter plan or above.

```ts
const comparison = await wayforth.compare('deepl', 'serper');
```

**Returns** `CompareResponse`

---

## Error Handling

All API errors throw `WayforthError`:

```ts
import { WayforthClient, WayforthError } from 'wayforth-sdk';

try {
  await wayforth.execute('deepl', { text: 'hello' });
} catch (err) {
  if (err instanceof WayforthError) {
    console.error(err.message);  // human-readable message
    console.error(err.status);   // HTTP status code: 401, 402, 429, etc.
    console.error(err.code);     // machine-readable: "insufficient_credits", "rate_limited", etc.
  }
}
```

Common error codes:

| Status | Code | Meaning |
|--------|------|---------|
| 401 | `401` | Invalid or missing API key |
| 402 | `insufficient_credits` | Not enough credits — top up at wayforth.io/billing |
| 429 | `rate_limited` | Too many requests |
| 404 | `404` | Service not found |
| 422 | `no_managed_service` | No managed service matched the intent |
| 408 | `timeout` | Request timed out (client-side) |

---

## TypeScript

All types are exported:

```ts
import type {
  WayforthClientOptions,
  SearchResult,
  SearchResponse,
  ExecuteResult,
  RunResult,
  RunOptions,
  BalanceResponse,
  Service,
  ServicesResponse,
  CompareResponse,
} from 'wayforth-sdk';
```

---

## ESM + CJS

The package ships dual ESM + CJS output and works in:
- Node.js 18+ (native fetch)
- Bundlers: Webpack, Rollup, esbuild, Vite
- Edge runtimes: Cloudflare Workers, Vercel Edge, Deno

---

## Links

- **Quickstart:** [wayforth.io/quickstart](https://wayforth.io/quickstart)
- **API Reference:** [gateway.wayforth.io/guide/](https://gateway.wayforth.io/guide/)
- **Python SDK:** [pypi.org/project/wayforth-sdk](https://pypi.org/project/wayforth-sdk/)
- **MCP Server:** [pypi.org/project/wayforth-mcp](https://pypi.org/project/wayforth-mcp/)
- **Dashboard:** [wayforth.io/dashboard](https://wayforth.io/dashboard)

---

## License

Business Source License 1.1 (BSL 1.1) — converts to Apache 2.0 on April 25, 2030.

© 2026 Wayforth Technologies Inc.
