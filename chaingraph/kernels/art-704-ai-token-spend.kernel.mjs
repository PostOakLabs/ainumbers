import { executionHash } from './_hash.mjs';

// art-704-ai-token-spend — monthly AI token spend estimator and cross-model
// comparator. The kernel takes a usage profile (requests per month, input,
// cached-input share, cache writes with a TTL, output, batch share, long-context
// share), a dated price_table input, and an as_of date, and prices every compared
// model: per-model monthly cost in integer USD micros, the cost per request, the
// four-component breakdown, and a ranking cheapest-first with ties broken by the
// model string.
//
// PRICES ARE AN INPUT, NEVER KERNEL CONSTANTS: the kernel does pure integer
// arithmetic over the caller's price_table. A price entry applies at as_of when
// effective_from <= as_of <= effective_through (nulls are open); two applicable
// entries for the same compared model are an AMBIGUOUS_PRICE refusal, never a
// silent pick, and zero applicable entries is NO_PRICE_FOR_DATE. A missing price
// for a requested component is NO_PRICE_FOR_COMPONENT naming the model and the
// component; a token slice needing a combined batch+long-context block the entry
// does not list is NO_PRICE_FOR_COMBINATION.
//
// TOKEN SPLIT: the cached-input share splits input tokens into an uncached part
// floor(T*(10000-share)/10000) and the remainder; the batch and long-context
// shares split EVERY component's tokens into three disjoint slices — batch
// floor(T*batch_bp/10000), long-context floor(T*long_bp/10000), plain remainder —
// priced from the matching block (batch block, long-context block, or base
// block). Shares above 10000 bp in sum are refused; each share alone is capped at
// 10000 bp.
//
// OVERFLOW-SAFE COST: cost(T tokens at P micros per million tokens) =
// floor(T/1e6)*P + floor((T mod 1e6)*P/1e6). With the validated caps (component
// tokens per month <= 1e12, prices <= 1e9) every intermediate stays below 2^53.
// Monthly tokens per component above 1e12 are refused (REFUSED_OVERFLOW_CAP).
// Totals are summed in micros; cents appear only in page display, never here.
//
// DATES: as_of and the date fields are 'YYYY-MM-DD' strings compared
// lexicographically; snapshot_age_days is a pure-integer civil-days difference.
// No Date, no clock, no randomness, no text encoding: a pure function of the
// declared input domain.

const TOOL_ID = 'art-704-ai-token-spend';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'estimate_ai_token_spend',
  mandate_type: 'compliance_control', gpu: false,
};

const MONTHLY_TOKEN_CAP = 1e12; // per component, per month
const MAX_PRICE_MICROS = 1e9; // per-million-token price bound keeping intermediates under 2^53
const TTL_KEYS = { '5m': 'cache_write_5m', '1h': 'cache_write_1h' };
const STALE_SNAPSHOT_DAYS = 30;
const COMPONENT_ORDER = ['input', 'cached_input', 'cache_write', 'output'];
const SCOPE_NOTE =
  'No taxes or regional uplift; no image, audio or video tokens; no tool-use surcharges; ' +
  'no tiered volume discounts; and no subscription or committed-spend deals. Prices come ' +
  'from the dated price_table input — the default snapshot is a capture of the official ' +
  'provider price pages verified on its own snapshot_verified_on date, never a live quote.';

// ---------- refusal plumbing ----------

/** @type {(reason: string, text: string) => { output_payload: object, compliance_flags: string[] }} */
function refused(reason, text) {
  const domain_errors = [{ code: reason, text }];
  const flags = [];
  if (domain_errors.length > 0) flags.push('ART704_INPUT_REFUSED');
  return {
    output_payload: {
      as_of: null,
      snapshot_verified_on: null,
      snapshot_age_days: null,
      results: [],
      ranking: [],
      cheapest: null,
      refusals: [],
      refusal_reason: reason,
      domain_errors,
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags,
  };
}

// ---------- integer date helpers (no Date object anywhere) ----------

/** days from 1970-01-01 for a civil date; only called on format-validated strings */
function daysFromIso(iso) {
  let y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function isIsoDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const y = Number(v.slice(0, 4));
  const m = Number(v.slice(5, 7));
  const d = Number(v.slice(8, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dim;
}

// ---------- validation ----------

/** @type {(v: unknown, max: number) => boolean} non-negative integer within the safe range */
function isCount(v, max) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
}

/** @type {(v: unknown) => boolean} null or a non-negative integer price within the 2^53-safe bound */
function isPriceField(v) {
  return v === null || isCount(v, MAX_PRICE_MICROS);
}

/** @type {(v: unknown) => boolean} a price entry, structurally */
function isPriceEntry(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const e = /** @type {Record<string, unknown>} */ (v);
  if (typeof e.provider !== 'string' || !e.provider) return false;
  if (typeof e.model !== 'string' || !e.model) return false;
  if (typeof e.tier !== 'string' || !e.tier) return false;
  if (!(e.effective_from === null || isIsoDate(/** @type {string} */ (e.effective_from)))) return false;
  if (!(e.effective_through === null || isIsoDate(/** @type {string} */ (e.effective_through)))) return false;
  for (const k of ['input', 'cached_input', 'cache_write_5m', 'cache_write_1h', 'output']) {
    if (!isPriceField(e[k])) return false;
  }
  if (e.long_context !== null && e.long_context !== undefined) {
    const lc = /** @type {Record<string, unknown>} */ (e.long_context);
    if (!lc || typeof lc !== 'object' || Array.isArray(lc)) return false;
    for (const k of ['input', 'cached_input', 'cache_write_5m', 'output']) {
      if (!isPriceField(lc[k])) return false;
    }
  }
  if (e.batch !== null && e.batch !== undefined) {
    const b = /** @type {Record<string, unknown>} */ (e.batch);
    if (!b || typeof b !== 'object' || Array.isArray(b)) return false;
    if (!isPriceField(b.input) || !isPriceField(b.output)) return false;
    if (b.long_context !== null && b.long_context !== undefined) {
      const blc = /** @type {Record<string, unknown>} */ (b.long_context);
      if (!blc || typeof blc !== 'object' || Array.isArray(blc)) return false;
      if (!isPriceField(blc.input) || !isPriceField(blc.output)) return false;
    }
  }
  if (typeof e.source_sha256 !== 'string') return false;
  return true;
}

/** @type {(pp: object) => { output_payload: object, compliance_flags: string[] } | null} */
function validate(pp) {
  if (!isIsoDate(pp.as_of)) {
    return refused('REFUSED_BAD_AS_OF', 'as_of must be a real calendar date as a YYYY-MM-DD string; the node never reads a clock');
  }
  const usage = pp.usage;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    return refused('REFUSED_BAD_USAGE', 'usage must be an object with the monthly usage profile fields');
  }
  if (!isCount(usage.requests_per_month, MONTHLY_TOKEN_CAP)) {
    return refused('REFUSED_BAD_USAGE', 'usage.requests_per_month must be a non-negative integer');
  }
  for (const k of ['input_tokens_per_request', 'cache_write_tokens_per_request', 'output_tokens_per_request']) {
    if (!isCount(usage[k], MONTHLY_TOKEN_CAP)) {
      return refused('REFUSED_BAD_USAGE', 'usage.' + k + ' must be a non-negative integer token count');
    }
  }
  for (const k of ['cached_input_share_bp', 'batch_share_bp', 'long_context_share_bp']) {
    if (typeof usage[k] !== 'number' || !Number.isInteger(usage[k]) || usage[k] < 0 || usage[k] > 10000) {
      return refused('REFUSED_BAD_SHARE', 'usage.' + k + ' must be an integer basis-point share between 0 and 10000');
    }
  }
  if (usage.batch_share_bp + usage.long_context_share_bp > 10000) {
    return refused('REFUSED_SHARES_OVER_10000', 'usage.batch_share_bp plus usage.long_context_share_bp must not exceed 10000');
  }
  if (usage.cache_write_ttl !== '5m' && usage.cache_write_ttl !== '1h') {
    return refused('REFUSED_BAD_TTL', "usage.cache_write_ttl must be '5m' or '1h'");
  }
  const r = usage.requests_per_month;
  if (usage.input_tokens_per_request * r > MONTHLY_TOKEN_CAP
    || usage.cache_write_tokens_per_request * r > MONTHLY_TOKEN_CAP
    || usage.output_tokens_per_request * r > MONTHLY_TOKEN_CAP) {
    return refused('REFUSED_OVERFLOW_CAP', 'monthly tokens for a component would exceed the 1e12 per-component cap');
  }
  const table = pp.price_table;
  if (!table || typeof table !== 'object' || Array.isArray(table)) {
    return refused('REFUSED_BAD_PRICE_TABLE', 'price_table must be an object with snapshot_verified_on, currency, unit and models');
  }
  if (!isIsoDate(table.snapshot_verified_on)) {
    return refused('REFUSED_BAD_PRICE_TABLE', 'price_table.snapshot_verified_on must be a real calendar date as a YYYY-MM-DD string');
  }
  if (table.currency !== 'USD' || table.unit !== 'usd_micros_per_million_tokens') {
    return refused('REFUSED_BAD_PRICE_TABLE', "price_table.currency must be 'USD' and price_table.unit must be 'usd_micros_per_million_tokens'");
  }
  if (!Array.isArray(table.models) || table.models.length === 0) {
    return refused('REFUSED_BAD_PRICE_TABLE', 'price_table.models must be a non-empty array of price entries');
  }
  for (const entry of table.models) {
    if (!isPriceEntry(entry)) {
      return refused('REFUSED_BAD_PRICE_ENTRY', 'every price_table.models entry must carry provider, model, tier, null-or-date effective bounds, null-or-integer prices within the 1e9 bound, and a source_sha256 string');
    }
  }
  const compare = pp.compare;
  if (!Array.isArray(compare) || compare.length === 0 || compare.some((m) => typeof m !== 'string' || !m)) {
    return refused('REFUSED_BAD_COMPARE', 'compare must be a non-empty array of model strings to price and rank');
  }
  return null;
}

// ---------- pricing ----------

/** overflow-safe integer cost of T tokens at P micros per million tokens */
function costOf(tokens, price) {
  const whole = Math.floor(tokens / 1e6);
  const rest = tokens % 1e6;
  return whole * price + Math.floor((rest * price) / 1e6);
}

/** one component's token split into plain / batch-only / long-only / both slices */
function splitTokens(tokens, batchBp, longBp) {
  const batch = Math.floor((tokens * batchBp) / 10000);
  const long = Math.floor((tokens * longBp) / 10000);
  const both = Math.min(batch, long);
  return {
    plain: tokens - batch - long,
    batchOnly: batch - both,
    longOnly: long - both,
    both,
  };
}

/**
 * Resolve the price field for one slice of one component.
 * Returns { price } or { refusal: { code, text } }.
 */
function priceForSlice(entry, slice, component, ttlKey, model) {
  let block;
  if (slice === 'plain') block = entry;
  else if (slice === 'batchOnly') block = entry.batch;
  else if (slice === 'longOnly') block = entry.long_context;
  else {
    // both: needs the combined batch+long-context block the provider may list
    const blc = entry.batch && entry.batch.long_context;
    if (!blc) {
      return { refusal: { code: 'NO_PRICE_FOR_COMBINATION', text: model + ' lists no combined batch and long-context block to price a ' + component + ' slice that is both batch and long-context' } };
    }
    block = blc;
  }
  if (!block) {
    const kind = slice === 'batchOnly' ? 'batch' : 'long-context';
    return { refusal: { code: 'NO_PRICE_FOR_COMPONENT', text: model + ' lists no ' + kind + ' price for the requested component ' + component } };
  }
  const price = block[component === 'cache_write' ? ttlKey : component];
  if (price === null || price === undefined) {
    return { refusal: { code: 'NO_PRICE_FOR_COMPONENT', text: model + ' lists no price for the requested component ' + component + ' (' + slice + ' slice)' } };
  }
  return { price };
}

/** price one compared model at as_of; returns { result } or { refusal } */
function priceModel(entry, usage, asOf) {
  const model = entry.model;
  const ttlKey = TTL_KEYS[usage.cache_write_ttl];
  const inputTotal = usage.input_tokens_per_request;
  const uncached = Math.floor((inputTotal * (10000 - usage.cached_input_share_bp)) / 10000);
  const cached = inputTotal - uncached;
  const tokensByComponent = {
    input: uncached,
    cached_input: cached,
    cache_write: usage.cache_write_tokens_per_request,
    output: usage.output_tokens_per_request,
  };
  const components = {};
  let monthly = 0;
  let perRequest = 0;
  for (const component of COMPONENT_ORDER) {
    const tokens = tokensByComponent[component];
    if (tokens === 0) {
      components[component] = 0;
      continue;
    }
    const slices = splitTokens(tokens, usage.batch_share_bp, usage.long_context_share_bp);
    let componentMonthly = 0;
    let componentPerRequest = 0;
    for (const slice of ['plain', 'batchOnly', 'longOnly', 'both']) {
      const sliceTokens = slices[slice];
      if (sliceTokens === 0) continue;
      const resolved = priceForSlice(entry, slice, component, ttlKey, model);
      if (resolved.refusal) return { refusal: resolved.refusal };
      componentMonthly += costOf(sliceTokens * usage.requests_per_month, resolved.price);
      componentPerRequest += costOf(sliceTokens, resolved.price);
    }
    components[component] = componentMonthly;
    monthly += componentMonthly;
    perRequest += componentPerRequest;
  }
  return {
    result: {
      provider: entry.provider,
      model,
      tier: entry.tier,
      monthly_micros: monthly,
      per_request_micros: perRequest,
      components,
      price_entry_source_sha256: entry.source_sha256,
    },
  };
}

// ---------- compute ----------

/**
 * compute(pp) — pure AI-spend estimator over the declared input domain.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const bad = validate(pp);
  if (bad) return bad;

  const usage = pp.usage;
  const table = pp.price_table;
  const asOf = pp.as_of;
  const flags = [];
  const results = [];
  const refusals = [];

  for (const name of pp.compare) {
    const entries = table.models.filter((e) => e.model === name);
    const applicable = entries.filter((e) =>
      (e.effective_from === null || e.effective_from <= asOf)
      && (e.effective_through === null || asOf <= e.effective_through));
    if (applicable.length === 0) {
      refusals.push({
        provider: entries.length ? entries[0].provider : null,
        model: name,
        code: entries.length ? 'NO_PRICE_FOR_DATE' : 'REFUSED_UNKNOWN_MODEL',
        text: entries.length
          ? name + ' has no price entry applicable at as_of ' + asOf
          : name + ' is not in the price table',
      });
      continue;
    }
    if (applicable.length > 1) {
      refusals.push({
        provider: applicable[0].provider,
        model: name,
        code: 'AMBIGUOUS_PRICE',
        text: name + ' has ' + applicable.length + ' price entries applicable at as_of ' + asOf
          + ' (tiers ' + applicable.map((e) => e.tier).join(', ') + '); refine the table, never a silent pick',
      });
      continue;
    }
    const priced = priceModel(applicable[0], usage, asOf);
    if (priced.refusal) {
      refusals.push({ provider: applicable[0].provider, model: name, code: priced.refusal.code, text: priced.refusal.text });
      continue;
    }
    results.push(priced.result);
  }

  // Cheapest-first ranking over the successfully priced models; ties break by the
  // model string ascending — a fixed declared order.
  const ranking = results.slice().sort((a, b) =>
    (a.monthly_micros - b.monthly_micros) || (a.model < b.model ? -1 : a.model > b.model ? 1 : 0));

  const age = daysFromIso(asOf) - daysFromIso(table.snapshot_verified_on);
  if (age > STALE_SNAPSHOT_DAYS) flags.push('ART704_STALE_SNAPSHOT');
  if (refusals.length > 0) flags.push('ART704_MODEL_REFUSED');

  return {
    output_payload: {
      as_of: asOf,
      snapshot_verified_on: table.snapshot_verified_on,
      snapshot_age_days: age,
      results,
      ranking: ranking.map((r) => r.model),
      cheapest: ranking.length ? ranking[0].model : null,
      refusals,
      refusal_reason: null,
      domain_errors: [],
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
