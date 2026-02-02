/**
 * RPC Load Balancer
 *
 * Weighted round-robin load balancer for Solana RPC endpoints.
 * Includes circuit breaker pattern with exponential backoff.
 */

// =============================================================================
// TYPES
// =============================================================================

type Upstream = {
  url: string;
  weight?: number;
};

type State = {
  failUntil: number;
  failures: number;
};

// =============================================================================
// STATE
// =============================================================================

const STATES: State[] = [];
let rr = 0;

function now() {
  return Date.now();
}

function normalize(url: string) {
  return url.trim().replace(/\/+$/, '');
}

// =============================================================================
// CONFIGURATION
// =============================================================================

function parseUpstreamsFromEnv(): Upstream[] {
  const list = process.env.SOLANA_RPC_URLS?.trim();
  if (list) {
    const urls = list
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((u) => ({ url: normalize(u), weight: 1 }));
    return urls;
  }

  // fallback to single
  const single = process.env.SOLANA_RPC_URL?.trim();
  if (!single) return [];
  return [{ url: normalize(single), weight: 1 }];
}

// =============================================================================
// HEALTH TRACKING
// =============================================================================

function initStates(n: number) {
  while (STATES.length < n) STATES.push({ failUntil: 0, failures: 0 });
  while (STATES.length > n) STATES.pop();
}

function isHealthy(i: number) {
  return (STATES[i]?.failUntil ?? 0) <= now();
}

function penaltyMs(failures: number) {
  // 1s, 2s, 4s, 8s ... capped at 60s
  const ms = 1000 * Math.pow(2, Math.min(6, failures));
  return Math.min(ms, 60_000);
}

function markFailure(i: number) {
  const s = STATES[i];
  s.failures += 1;
  s.failUntil = now() + penaltyMs(s.failures);
}

function markSuccess(i: number) {
  const s = STATES[i];
  s.failures = 0;
  s.failUntil = 0;
}

// =============================================================================
// WEIGHT EXPANSION
// =============================================================================

function expandByWeight(ups: Upstream[]) {
  const expanded: string[] = [];
  for (const u of ups) {
    const w = Math.max(1, Math.min(10, u.weight ?? 1));
    for (let i = 0; i < w; i++) expanded.push(u.url);
  }
  return expanded;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Pick an RPC URL (round-robin), skipping temporarily penalized ones.
 */
export function pickRpcUrl(): string {
  const ups = parseUpstreamsFromEnv();
  if (!ups.length) throw new Error('Missing SOLANA_RPC_URL or SOLANA_RPC_URLS in env');

  const urls = expandByWeight(ups);
  initStates(urls.length);

  // try a few picks until we find a healthy one
  for (let tries = 0; tries < urls.length; tries++) {
    const idx = rr++ % urls.length;
    if (isHealthy(idx)) return urls[idx];
  }

  // if all are penalized, just pick next anyway (best effort)
  return urls[rr++ % urls.length];
}

/**
 * Compatibility export (for routes that expect this name).
 */
export const pickSolanaRpcUrl = pickRpcUrl;

/**
 * Get current health status of all upstreams
 */
export function getUpstreamHealth(): Array<{
  url: string;
  healthy: boolean;
  failures: number;
  recoversIn: number;
}> {
  const ups = parseUpstreamsFromEnv();
  const urls = expandByWeight(ups);
  initStates(urls.length);

  // Dedupe to unique URLs
  const seen = new Set<string>();
  const results: Array<{
    url: string;
    healthy: boolean;
    failures: number;
    recoversIn: number;
  }> = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (seen.has(url)) continue;
    seen.add(url);

    const state = STATES[i];
    const healthy = isHealthy(i);
    const recoversIn = healthy ? 0 : Math.max(0, state.failUntil - now());

    results.push({
      url,
      healthy,
      failures: state.failures,
      recoversIn,
    });
  }

  return results;
}

/**
 * Fetch RPC with retry + penalty on 429/5xx/errors.
 * Expects JSON-RPC POST bodies.
 */
export async function fetchRpcBalanced(
  inputBody: unknown,
  init?: RequestInit
): Promise<Response> {
  const ups = parseUpstreamsFromEnv();
  if (!ups.length) throw new Error('Missing SOLANA_RPC_URL or SOLANA_RPC_URLS in env');

  const urls = expandByWeight(ups);
  initStates(urls.length);

  const attempts = Math.min(3, urls.length);
  let lastErr: unknown = null;

  for (let a = 0; a < attempts; a++) {
    // pick a healthy endpoint (or next best)
    let pickedIdx = rr++ % urls.length;
    for (let t = 0; t < urls.length; t++) {
      const idx = (pickedIdx + t) % urls.length;
      if (isHealthy(idx)) {
        pickedIdx = idx;
        break;
      }
    }

    const url = urls[pickedIdx];

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
        body: JSON.stringify(inputBody),
        ...init,
      });

      // Treat 429/5xx as upstream problems worth retrying
      if (res.status === 429 || res.status >= 500) {
        markFailure(pickedIdx);
        lastErr = new Error(`Upstream RPC ${res.status} from ${url}`);
        continue;
      }

      markSuccess(pickedIdx);
      return res;
    } catch (e) {
      markFailure(pickedIdx);
      lastErr = e;
    }
  }

  throw lastErr ?? new Error('RPC upstream failed');
}

// JSON-RPC response types
interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * JSON-RPC helper for Solana
 */
export async function rpcRequest<T = unknown>(
  method: string,
  params: unknown[] = [],
  init?: RequestInit
): Promise<T> {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  };

  const res = await fetchRpcBalanced(body, init);
  const json = (await res.json()) as JsonRpcResponse;

  if (json.error) {
    throw new Error(`RPC Error: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json.result as T;
}

/**
 * Batch JSON-RPC requests
 */
export async function rpcBatchRequest<T = unknown[]>(
  requests: Array<{ method: string; params: unknown[] }>,
  init?: RequestInit
): Promise<T> {
  const body = requests.map((req, i) => ({
    jsonrpc: '2.0',
    id: i + 1,
    method: req.method,
    params: req.params,
  }));

  const res = await fetchRpcBalanced(body, init);
  const json = (await res.json()) as JsonRpcResponse[];

  // Handle batch response
  if (Array.isArray(json)) {
    const results = json.map((item) => {
      if (item.error) {
        throw new Error(`RPC Error: ${item.error.message || JSON.stringify(item.error)}`);
      }
      return item.result;
    });
    return results as T;
  }

  throw new Error('Unexpected batch response format');
}

// =============================================================================
// RESET FUNCTION (for testing)
// =============================================================================

export function resetLoadBalancerState(): void {
  STATES.length = 0;
  rr = 0;
}
