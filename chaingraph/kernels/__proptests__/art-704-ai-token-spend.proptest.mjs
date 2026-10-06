// art-704-ai-token-spend.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the build spec at
// research/hackathon-builds/ART704-AI-SPEND-BUILD-SPEC-2026-10-01.md.
// kernel_digest_at_authoring: sha256:1c2518f6e01085420d06609b2ae4d1354d5832d04729e000d4cf0bfba9460b15
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO — every price and token count is an integer gated through
// Number.isInteger checks, the cost formula is two integer floor divisions
// (floor(T/1e6)*P + floor((T mod 1e6)*P/1e6) under the validated 1e12/1e9 caps so
// every intermediate stays under 2^53), shares are integer basis-point floors,
// snapshot_age_days is a pure-integer civil-days difference, and compute() touches
// no Date, no float accumulation and no Math.random.
//
// Checks: fixture-oracle gate (F1..F10, two-sided pairs for F3 and F6); P1 raising
// any price of the applicable entry never lowers the monthly total; P2 a 100%
// cached share prices every input token at the cached rate (input component 0,
// cached component exactly the spec cost formula at the cached price); P3 the
// ranking is invariant to the order of the price table (byte-identical payload
// under a Fisher-Yates shuffle); P4 invalid-domain inputs are refused with named
// reasons, never a throw; P5 determinism (two runs agree byte-for-byte) and output
// shape (no undefined/NaN/non-finite anywhere).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-704-ai-token-spend.proptest.mjs

import { compute } from '../art-704-ai-token-spend.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-704-ai-token-spend';
const MAX_PRICE = 1e9;

// ---------- shared random domain (declared-domain inputs only) ----------

function randomEntry(rng, over = {}) {
  const p = () => 100000 * (1 + Math.floor(rng() * 40)); // 1e5 .. 4.05e6, well under the 1e9 bound
  return {
    provider: 'acme', model: 'model-a', tier: 'standard',
    effective_from: null, effective_through: null,
    input: p(), cached_input: p(), cache_write_5m: p(), cache_write_1h: p(),
    output: p(),
    long_context: { input: p(), cached_input: p(), cache_write_5m: p(), output: p() },
    batch: { input: p(), output: p(), long_context: { input: p(), output: p() } },
    source_sha256: 'ab'.repeat(32),
    ...over,
  };
}

function baseInputs(rng, over = {}) {
  const usage = {
    requests_per_month: 1 + Math.floor(rng() * 100000),
    input_tokens_per_request: 1 + Math.floor(rng() * 20000),
    cached_input_share_bp: Math.floor(rng() * 10001),
    cache_write_tokens_per_request: Math.floor(rng() * 5000),
    cache_write_ttl: rng() < 0.5 ? '5m' : '1h',
    output_tokens_per_request: 1 + Math.floor(rng() * 8000),
    batch_share_bp: Math.floor(rng() * 5001),
    long_context_share_bp: Math.floor(rng() * 5001),
    ...(over.usage || {}),
  };
  // Declared-domain discipline: a batch block lists input/output only (no cached
  // or write prices — the provider pages list none), and a long-context block has
  // no 1h write price. A draw with a batch share therefore requests no cached or
  // write components, and a draw with both a long share and writes pins the 5m TTL.
  if (usage.batch_share_bp > 0) {
    usage.cached_input_share_bp = 0;
    usage.cache_write_tokens_per_request = 0;
  }
  if (usage.long_context_share_bp > 0 && usage.cache_write_tokens_per_request > 0) {
    usage.cache_write_ttl = '5m';
  }
  return {
    as_of: '2026-10-01',
    usage,
    price_table: {
      snapshot_verified_on: '2026-10-01',
      currency: 'USD',
      unit: 'usd_micros_per_million_tokens',
      models: over.models || [randomEntry(rng)],
    },
    compare: over.compare || ['model-a'],
  };
}

// keep usage valid: batch + long shares never exceed 10000 together
function clampShares(usage) {
  usage.batch_share_bp = Math.min(usage.batch_share_bp, 5000);
  usage.long_context_share_bp = Math.min(usage.long_context_share_bp, 10000 - usage.batch_share_bp);
  return usage;
}

/** the spec's overflow-safe cost formula, restated here independently */
function costOf(tokens, price) {
  return Math.floor(tokens / 1e6) * price + Math.floor(((tokens % 1e6) * price) / 1e6);
}

// ---------- properties ----------

// P1: raising any price of the applicable entry never lowers the monthly total.
// One numeric field of exactly the entry as_of selects is raised by a positive
// delta (staying under the 1e9 bound); applicability, null-ness and shares are
// untouched, so the same slices are priced at weakly higher prices.
function checkPriceMonotonicity() {
  const rng = mulberry32(704001);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 80; i++) {
    const models = [randomEntry(rng, { model: 'model-a' }), randomEntry(rng, { model: 'model-b' })];
    const pp = baseInputs(rng, { models, compare: ['model-a'] });
    pp.usage = clampShares(pp.usage);
    const before = compute(pp);
    if (before.output_payload.results.length !== 1) { violations++; continue; }
    const entry = pp.price_table.models[0];
    const fields = [];
    for (const k of ['input', 'cached_input', 'cache_write_5m', 'cache_write_1h', 'output']) {
      if (typeof entry[k] === 'number') fields.push([entry, k]);
    }
    for (const blk of [entry.long_context, entry.batch, entry.batch && entry.batch.long_context]) {
      if (!blk) continue;
      for (const k of Object.keys(blk)) {
        if (typeof blk[k] === 'number') fields.push([blk, k]);
      }
    }
    const [obj, key] = fields[Math.floor(rng() * fields.length)];
    obj[key] += 1 + Math.floor(rng() * 1000);
    const after = compute(pp);
    checked++;
    const b = before.output_payload.results[0].monthly_micros;
    const a = after.output_payload.results[0] && after.output_payload.results[0].monthly_micros;
    if (a === undefined) violations++;
    else if (a < b) violations++;
  }
  return { name: 'P1 raising any applicable price never lowers the monthly total', checked, violations };
}

// P2: a 100% cached share prices every input token at the cached rate — the input
// component is zero and the cached_input component equals the spec cost formula
// applied to all input tokens at the entry's cached price.
function checkFullCacheShare() {
  const rng = mulberry32(704002);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 60; i++) {
    const pp = baseInputs(rng);
    pp.usage = clampShares({ ...pp.usage, cached_input_share_bp: 10000, batch_share_bp: 0, long_context_share_bp: 0 });
    const entry = pp.price_table.models[0];
    if (entry.cached_input === null) continue;
    const { output_payload } = compute(pp);
    if (output_payload.results.length !== 1) { violations++; continue; }
    const r = output_payload.results[0];
    checked += 2;
    if (r.components.input !== 0) violations++;
    const want = costOf(pp.usage.input_tokens_per_request * pp.usage.requests_per_month, entry.cached_input);
    if (r.components.cached_input !== want) violations++;
    checked++;
    if (r.monthly_micros !== want + r.components.cache_write + r.components.output) violations++;
  }
  return { name: 'P2 a 100% cached share prices every input token at the cached rate', checked, violations };
}

// P3: the ranking is invariant to the order of the price table — shuffling
// price_table.models leaves the whole output_payload byte-identical.
function checkRankingOrderInvariant() {
  const rng = mulberry32(704003);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 40; i++) {
    const models = ['model-a', 'model-b', 'model-c', 'model-d'].map((m) => randomEntry(rng, { model: m }));
    const compare = ['model-d', 'model-a', 'model-c', 'model-b'].slice(0, 1 + Math.floor(rng() * 4));
    const pp = baseInputs(rng, { models, compare });
    pp.usage = clampShares(pp.usage);
    const first = compute(pp);
    if (first.output_payload.results.length === 0) { violations++; continue; }
    for (let s = 0; s < 3; s++) {
      const shuffled = models.slice();
      for (let k = shuffled.length - 1; k > 0; k--) {
        const j = Math.floor(rng() * (k + 1));
        const tmp = shuffled[k];
        shuffled[k] = shuffled[j];
        shuffled[j] = tmp;
      }
      const again = compute({ ...pp, price_table: { ...pp.price_table, models: shuffled } });
      checked++;
      if (JSON.stringify(again.output_payload) !== JSON.stringify(first.output_payload)) violations++;
    }
  }
  return { name: 'P3 the ranking is invariant to the order of the price table', checked, violations };
}

// P4: invalid-domain inputs are refused with a named reason and the input flag,
// never a throw.
function checkRefusals() {
  let checked = 0;
  let violations = 0;
  const rng = mulberry32(704004);
  const good = baseInputs(mulberry32(704014));
  const bad = /** @type {{ key: string, value: unknown }[]} */ ([
    { key: 'as_of', value: 'not-a-date' }, { key: 'as_of', value: '2026-13-01' }, { key: 'as_of', value: '2026-02-30' },
    { key: 'as_of', value: '2026-10-1' }, { key: 'as_of', value: 20261001 }, { key: 'as_of', value: '2026-00-10' },
    { key: 'usage', value: null }, { key: 'usage', value: 'x' },
    { key: 'usage', value: { ...good.usage, requests_per_month: -1 } },
    { key: 'usage', value: { ...good.usage, requests_per_month: 1.5 } },
    { key: 'usage', value: { ...good.usage, input_tokens_per_request: -5 } },
    { key: 'usage', value: { ...good.usage, cached_input_share_bp: 10001 } },
    { key: 'usage', value: { ...good.usage, cached_input_share_bp: -1 } },
    { key: 'usage', value: { ...good.usage, cached_input_share_bp: 0.5 } },
    { key: 'usage', value: { ...good.usage, batch_share_bp: 6000, long_context_share_bp: 5000 } },
    { key: 'usage', value: { ...good.usage, cache_write_ttl: '24h' } },
    { key: 'usage', value: { ...good.usage, cache_write_ttl: null } },
    { key: 'usage', value: { ...good.usage, output_tokens_per_request: 2.5 } },
    { key: 'price_table', value: null },
    { key: 'price_table', value: { ...good.price_table, currency: 'EUR' } },
    { key: 'price_table', value: { ...good.price_table, unit: 'usd_micros_per_token' } },
    { key: 'price_table', value: { ...good.price_table, snapshot_verified_on: '2026-02-30' } },
    { key: 'price_table', value: { ...good.price_table, models: [] } },
    { key: 'price_table', value: { ...good.price_table, models: 'x' } },
    { key: 'price_table', value: { ...good.price_table, models: [{ ...good.price_table.models[0], input: 1.5 }] } },
    { key: 'price_table', value: { ...good.price_table, models: [{ ...good.price_table.models[0], input: -1 }] } },
    { key: 'price_table', value: { ...good.price_table, models: [{ ...good.price_table.models[0], input: MAX_PRICE + 1 }] } },
    { key: 'price_table', value: { ...good.price_table, models: [{ ...good.price_table.models[0], model: '' }] } },
    { key: 'price_table', value: { ...good.price_table, models: [{ ...good.price_table.models[0], effective_from: '2026-13-01' }] } },
    { key: 'price_table', value: { ...good.price_table, models: [{ ...good.price_table.models[0], source_sha256: 7 }] } },
    { key: 'compare', value: [] }, { key: 'compare', value: 'model-a' },
    { key: 'compare', value: ['model-a', ''] }, { key: 'compare', value: [42] },
  ]);
  for (const { key, value } of bad) {
    const r = compute({ ...good, [key]: value });
    checked++;
    if (r.compliance_flags[0] !== 'ART704_INPUT_REFUSED') violations++;
    if (!r.output_payload.refusal_reason || !String(r.output_payload.refusal_reason).startsWith('REFUSED_')) violations++;
    if (r.output_payload.results.length !== 0) violations++;
  }
  void rng;
  return { name: 'P4 invalid-domain inputs refused with named reasons, never a throw', checked, violations };
}

// P5: compute() is deterministic (two runs agree byte-for-byte) and every payload —
// success and refusal — is free of undefined/NaN/non-finite values.
function checkDeterminismAndShape() {
  const rng = mulberry32(704005);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 25; i++) {
    const pp = baseInputs(rng);
    pp.usage = clampShares(pp.usage);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
    checked++;
    if (findShapeViolations(r1.output_payload).length > 0) violations++;
    const refusedRun = compute({ ...pp, as_of: '2026-02-30' });
    checked++;
    if (findShapeViolations(refusedRun.output_payload).length > 0) violations++;
  }
  return { name: 'P5 determinism and output shape: no undefined/NaN/non-finite anywhere', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkPriceMonotonicity(),
  checkFullCacheShare(),
  checkRankingOrderInvariant(),
  checkRefusals(),
  checkDeterminismAndShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — F1..F10 fixture oracle + P1..P5.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
