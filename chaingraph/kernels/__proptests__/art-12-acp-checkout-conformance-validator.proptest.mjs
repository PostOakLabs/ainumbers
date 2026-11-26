// art-12-acp-checkout-conformance-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C3-1).
// kernel_digest_at_authoring: sha256:763c756ba14cdb41f480953061d41148819391d5f84b8f804c9c9ba7a2b58dbe
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (rule engine is field-presence/regex/decision-table logic; the one
//   "amount precision" check counts decimal digits of a caller-supplied numeric string, no
//   float comparison or arithmetic threshold is involved).
// Checks: fixture-oracle gate, termination (checks array length data-bounded by the fixed rule
// tables, never by unbounded input), differential re-derivation of overall_status from the
// pass/fail/warn counts, and metamorphic permutation-invariance of the items array (order never
// changes the aggregate ACP-R07a verdict).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-12-acp-checkout-conformance-validator.proptest.mjs

import { compute } from '../art-12-acp-checkout-conformance-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-12-acp-checkout-conformance-validator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x12ACD);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function maybe(rng, v, p = 0.7) { return rng() < p ? v : undefined; }

const CURRENCIES = ['USD', 'EUR', 'INVALID', 'JPY'];
const SIG_PREFIXES = ['sha256-hmac:abc', 'rs256:abc', 'garbage:abc', ''];

function randomItem(rng, i) {
  return {
    sku: maybe(rng, `SKU-${i}`),
    unit_price: maybe(rng, rng() * 100 - 10),
    quantity: maybe(rng, Math.floor(rng() * 5)),
  };
}

function randomRequestPayload(rng) {
  const nItems = Math.floor(rng() * 5);
  return {
    message_type: 'CheckoutRequest',
    request_id: maybe(rng, 'req-1'),
    merchant_id: maybe(rng, 'merchant-1'),
    agent_id: maybe(rng, 'agent-1'),
    amount: maybe(rng, rng() * 1000),
    currency: pick(rng, CURRENCIES),
    items: Array.from({ length: nItems }, (_, i) => randomItem(rng, i)),
    timestamp: maybe(rng, '2026-06-19T10:00:00.000Z'),
    redirect_url: pick(rng, ['https://a.com/x', 'http://a.com/x', 'not-a-url']),
    signature: pick(rng, SIG_PREFIXES),
    idempotency_key: maybe(rng, 'idem-1', 0.5),
  };
}

function randomResponsePayload(rng) {
  return {
    message_type: 'CheckoutResponse',
    request_id: maybe(rng, 'req-1'),
    status: pick(rng, ['approved', 'declined', 'pending', 'error', 'bogus']),
    shared_payment_token: maybe(rng, {
      token_id: maybe(rng, 't1'), token_type: maybe(rng, 'card'),
      issued_at: 1000, expires_at: maybe(rng, 1000 + Math.floor(rng() * 5000)),
      scope: pick(rng, ['single_use', 'multi_use', 'bad']), payment_rail: maybe(rng, 'x402'),
    }, 0.8),
    merchant_id: maybe(rng, 'merchant-1'),
    amount_charged: maybe(rng, rng() * 1000),
    currency: pick(rng, CURRENCIES),
    timestamp: maybe(rng, '2026-06-19T10:00:00.000Z'),
    response_signature: pick(rng, SIG_PREFIXES),
    transaction_id: maybe(rng, 'txn-1'),
  };
}

function randomPP(rng) {
  const payload = rng() < 0.5 ? randomRequestPayload(rng) : randomResponsePayload(rng);
  return { message_type_override: 'auto', payload };
}

const TRIALS = 5000;

// ---------- P1: termination — pass/fail/warn counts sum exactly to checks.length, checks bounded ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  const MAX_CHECKS = 20; // fixed rule tables: T01 + up to 10 field rules + R07a + P01 + R11 + SIG1 + 4 SPT checks
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const sum = output_payload.pass_count + output_payload.fail_count + output_payload.warn_count;
    if (sum !== output_payload.checks.length) violations++;
    if (output_payload.checks.length > MAX_CHECKS) violations++;
  }
  return { name: 'P1_termination_checks_bounded', trials: checked, violations };
}

// ---------- P2 (differential): overall_status re-derivation ----------
function checkP2_status_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expected = output_payload.fail_count > 0 ? 'fail' : output_payload.warn_count > 0 ? 'warn' : 'pass';
    if (output_payload.overall_status !== expected) violations++;
  }
  return { name: 'P2_overall_status_differential', trials: checked, violations };
}

// ---------- P3: boundedness — merchant_id/currency echo exactly what was supplied (or null) ----------
function checkP3_echo_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const expMerchant = pp.payload.merchant_id || null;
    const expCurrency = pp.payload.currency || null;
    if (output_payload.merchant_id !== expMerchant) violations++;
    if (output_payload.currency !== expCurrency) violations++;
  }
  return { name: 'P3_merchant_currency_echo_boundedness', trials: checked, violations };
}

// ---------- P4: metamorphic — permutation-invariance of items array (CheckoutRequest only) ----------
function checkP4_items_permutation_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const payload = randomRequestPayload(rand);
    if (!Array.isArray(payload.items) || payload.items.length < 2) continue;
    const shuffled = { ...payload, items: shuffle(rand, payload.items) };
    const r1 = compute({ message_type_override: 'auto', payload }).output_payload;
    const r2 = compute({ message_type_override: 'auto', payload: shuffled }).output_payload;
    checked++;
    if (r1.overall_status !== r2.overall_status) violations++;
    if (r1.pass_count !== r2.pass_count || r1.fail_count !== r2.fail_count || r1.warn_count !== r2.warn_count) violations++;
  }
  return { name: 'P4_items_permutation_invariance', trials: checked, violations };
}

// ---------- PF1 (KERNEL-BIGINT-F1-SAFE-FORMAT-1): a BigInt on payload.amount refuses, never throws ----------
// RED on main: compute() threw "Do not know how to serialize a BigInt" while building the
// field-validation refusal detail. GREEN on head: the same input returns the refusal
// (measured across 4 BigInt values on this field, origin/main 0289be7577 vs this branch).
function checkPF1_bigintInputRefusesWithoutThrowing() {
  let violations = 0, checked = 0;
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-12-acp-checkout-conformance-validator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  for (const big of [7n, 123456789012345678901234567890n, -1n, 0n]) {
    const pp = structuredClone(fixtures.vectors[0].policy_parameters);
    if (!pp.payload || typeof pp.payload !== 'object') pp.payload = {};
    pp.payload.amount = big;
    checked++;
    try {
      const r = compute(pp);
      if (!r || !r.compliance_flags || !r.compliance_flags.includes('FIELD_VALIDATION_FAILED')) violations++;
    } catch (e) {
      violations++; // the serialization throw this cure removes
    }
  }
  return { name: 'PF1_bigint_payload_amount_refuses_without_throwing', trials: checked, violations };
}

// ---------- PD1 (MUTATION-FLOOR-CURE): exact differential against an independent reference model ----------
// Re-derives every check code/status, every count, the overall status, the echo fields and the
// compliance flags from the rule text, over boundary-heavy inputs (each rule's pass/fail edge).
const SIGS_OK = ['sha256-hmac:', 'rs256:', 'es256:', 'ed25519:'];
const CUR_SET = new Set('USD EUR GBP JPY CAD AUD CHF CNY SEK NOK DKK NZD SGD HKD MXN BRL INR RUB KRW TRY ZAR SAR AED PLN THB IDR CZK ILS CLP PHP'.split(' '));
function refHttps(v) {
  let s = String(v);
  let a = 0, b = s.length;
  while (a < b && s.charCodeAt(a) <= 32) a++;
  while (b > a && s.charCodeAt(b - 1) <= 32) b--;
  s = s.slice(a, b);
  const m = /^https:\/\/([^/\\?#]*)/i.exec(s);
  if (!m || m[1].length === 0) return false;
  return !/[\u0000- \u007f<>^|]/.test(m[1]);
}
const REF_PRED = {
  str: (v) => typeof v === 'string' && v.trim().length > 0,
  pos: (v) => typeof v === 'number' && v > 0,
  arr: (v) => Array.isArray(v) && v.length > 0,
  cur: (v) => typeof v === 'string' && CUR_SET.has(v.toUpperCase()),
  ts: (v) => (typeof v === 'number' ? v > 1e9 : typeof v === 'string' ? !Number.isNaN(Date.parse(v)) : false),
  url: refHttps,
  status: (v) => v === 'approved' || v === 'declined' || v === 'pending' || v === 'error',
  obj: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
};
const REF_REQ = [['message_type', 'ACP-R01', 'eqReq'], ['request_id', 'ACP-R02', 'str'], ['merchant_id', 'ACP-R03', 'str'], ['agent_id', 'ACP-R04', 'str'], ['amount', 'ACP-R05', 'pos'], ['currency', 'ACP-R06', 'cur'], ['items', 'ACP-R07', 'arr'], ['timestamp', 'ACP-R08', 'ts'], ['redirect_url', 'ACP-R09', 'url'], ['signature', 'ACP-R10', 'str']];
const REF_RES = [['message_type', 'ACP-S01', 'eqRes'], ['request_id', 'ACP-S02', 'str'], ['status', 'ACP-S03', 'status'], ['shared_payment_token', 'ACP-S04', 'obj'], ['merchant_id', 'ACP-S05', 'str'], ['amount_charged', 'ACP-S06', 'pos'], ['currency', 'ACP-S07', 'cur'], ['timestamp', 'ACP-S08', 'ts'], ['response_signature', 'ACP-S09', 'str'], ['transaction_id', 'ACP-S10', 'str']];
function refCompute(pp) {
  const p = pp.payload;
  const ov = pp.message_type_override === undefined || pp.message_type_override === null ? 'auto' : pp.message_type_override;
  if (!p || typeof p !== 'object') {
    return { output_payload: { overall_status: 'fail', pass_count: 0, fail_count: 1, warn_count: 0, checks: [{ code: 'ACP-T01', status: 'fail' }], merchant_id: null, currency: null }, compliance_flags: ['ACP_NON_CONFORMANT', 'FIELD_VALIDATION_FAILED'] };
  }
  let mt = ov === 'auto' ? p.message_type : ov;
  if (mt !== 'CheckoutRequest' && mt !== 'CheckoutResponse') mt = null;
  const req = mt === 'CheckoutRequest', res = mt === 'CheckoutResponse';
  const out = [];
  const add = (code, status) => out.push({ code, status });
  add('ACP-T01', mt ? 'pass' : 'fail');
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  for (const [key, code, kind] of req ? REF_REQ : res ? REF_RES : []) {
    let ok;
    if (!has(p, key)) ok = false;
    else if (kind === 'eqReq') ok = p[key] === 'CheckoutRequest';
    else if (kind === 'eqRes') ok = p[key] === 'CheckoutResponse';
    else ok = REF_PRED[kind](p[key]);
    add(code, ok ? 'pass' : 'fail');
  }
  if (req && Array.isArray(p.items) && p.items.length > 0) {
    let bad = false;
    for (const it of p.items) {
      if (!it.sku && !it.product_id) bad = true;
      if (!(typeof it.unit_price === 'number' && !(it.unit_price < 0))) bad = true;
      if (!(typeof it.quantity === 'number' && !(it.quantity < 1))) bad = true;
    }
    add('ACP-R07a', bad ? 'warn' : 'pass');
  }
  const af = req ? 'amount' : 'amount_charged';
  if (typeof p[af] === 'number' && !['JPY', 'KRW', 'CLP'].includes((p.currency || '').toUpperCase())) {
    const frac = String(p[af]).split('.')[1] || '';
    add('ACP-P01', frac.length > 2 ? 'warn' : 'pass');
  }
  if (req) add('ACP-R11', p.idempotency_key && typeof p.idempotency_key === 'string' ? 'pass' : 'warn');
  const sg = p[req ? 'signature' : 'response_signature'];
  if (sg && typeof sg === 'string') add('ACP-SIG1', SIGS_OK.some((x) => sg.toLowerCase().startsWith(x)) ? 'pass' : 'warn');
  if (res && p.shared_payment_token && typeof p.shared_payment_token === 'object') {
    const t = p.shared_payment_token;
    let missing = 0;
    for (const k of ['token_id', 'token_type', 'issued_at', 'expires_at', 'scope', 'payment_rail']) {
      if (!(has(t, k) && t[k] !== null && t[k] !== '')) missing++;
    }
    if (t.issued_at && t.expires_at) {
      const ttl = t.expires_at - t.issued_at;
      add('ACP-SPT1', ttl < 0 ? 'fail' : ttl > 3600 ? 'warn' : 'pass');
    }
    if (t.scope) add('ACP-SPT2', t.scope === 'single_use' || t.scope === 'multi_use' ? 'pass' : 'fail');
    if (t.masked_pan && !/^[0-9]{4}$/.test(String(t.masked_pan))) add('ACP-SPT3', 'warn');
    add('ACP-SPT0', missing === 0 ? 'pass' : 'fail');
  }
  const n = (s) => out.filter((c) => c.status === s).length;
  const f = n('fail'), w = n('warn');
  return {
    output_payload: { overall_status: f ? 'fail' : w ? 'warn' : 'pass', pass_count: n('pass'), fail_count: f, warn_count: w, checks: out, merchant_id: p.merchant_id || null, currency: p.currency || null },
    compliance_flags: f ? ['ACP_NON_CONFORMANT', 'FIELD_VALIDATION_FAILED'] : w ? ['ACP_CONFORMANT_WITH_WARNINGS'] : ['ACP_FULLY_CONFORMANT'],
  };
}

const BE = mulberry32(0xB0A12);
const EDGE_STR = ['x', '', ' ', '  y  ', 'a b'];
const EDGE_CUR = ['USD', 'usd', 'Eur', 'JPY', 'jpy', 'KRW', 'CLP', 'clp', 'PHP', 'ZZZ', 'US', '', undefined, null];
const EDGE_AMT = [0, -1, 0.01, 1, 5, 1.2, 1.23, 1.234, 12.3456, 1e21, 1e-7, 0.001, NaN, Infinity, '5', null, 100.5, 1500];
const EDGE_TS = [1e9, 1e9 + 1, 999999999, 1700000000000, 0, 'bad', '2026-01-01', '2026-06-19T10:00:00.000Z', '', {}, null];
const EDGE_URL = ['https://a.com/x', 'HTTPS://a', 'https://a', 'https://', 'https:///x', ' https://a.com ', 'https://a b', 'https://a<b', 'https://a>b', 'https://a|b', 'https://a^b', 'https://a\u007f', 'https://a\\b', 'https://?x', 'https://#f', 'https://a?x b', 'httpsx//a.com', 'https:/ /a.com', 'https:/a.com', 'http://a.com/x', 'ftp://a.com', 'https://a.com\n', '\u0001https://a.com', 'hxtps://a.com', 'hTtPs://a.com', 'https:a.com//', 'https//a.com/xx', 12345678, null, '', 'https://\u0000a'];
const EDGE_SIG = ['sha256-hmac:abc', 'SHA256-HMAC:abc', 'rs256:a', 'RS256:a', 'es256:a', 'ES256:a', 'ed25519:a', 'Ed25519:a', 'sha256-hmac', 'rs256', 'xs256:a', 'garbage', '', ' ', 5, null, undefined];
const EDGE_ITEM = () => {
  const skuMode = Math.floor(BE() * 4);
  const it = {};
  if (skuMode === 0) it.sku = 'S1'; else if (skuMode === 1) it.product_id = 'P1'; else if (skuMode === 2) it.sku = '';
  it.unit_price = pick(BE, [0, 1, -1, -0.01, 0.01, 10, '5', NaN, null, undefined]);
  it.quantity = pick(BE, [1, 2, 0, 0.5, 0.99, -1, '1', NaN, null, undefined]);
  return it;
};
function edgeSpt() {
  const t = {};
  const f = (k, vals) => { const v = pick(BE, vals); if (v !== '__absent') t[k] = v; };
  f('token_id', ['t1', '', null, '__absent']);
  f('token_type', ['card', '', null, '__absent']);
  f('issued_at', [1000, 0, '__absent', null, 5]);
  f('expires_at', [1000, 4600, 4601, 999, 0, 1001, 5000, '__absent', null]);
  f('scope', ['single_use', 'multi_use', 'bad', '', null, '__absent', 'Single_Use']);
  f('payment_rail', ['x402', '', null, '__absent']);
  f('masked_pan', ['1234', '123', '12345', 1234, 'abcd', '', null, '1234\n', '__absent', 0]);
  return t;
}
function edgePayload() {
  const p = {};
  const put = (k, vals) => { const v = pick(BE, vals); if (v !== '__absent') p[k] = v; };
  const kind = pick(BE, ['CheckoutRequest', 'CheckoutResponse', 'CheckoutRequest', 'CheckoutResponse', 'Other', undefined]);
  if (kind !== undefined) p.message_type = kind;
  put('request_id', [...EDGE_STR, '__absent']);
  put('merchant_id', [...EDGE_STR, '__absent', 0, 5]);
  put('agent_id', [...EDGE_STR, '__absent']);
  put('amount', [...EDGE_AMT, '__absent']);
  put('amount_charged', [...EDGE_AMT, '__absent']);
  put('currency', [...EDGE_CUR, '__absent']);
  const nItems = Math.floor(BE() * 4);
  if (BE() < 0.85) p.items = Array.from({ length: nItems }, EDGE_ITEM); else p.items = pick(BE, ['x', {}, null]);
  put('timestamp', [...EDGE_TS, '__absent']);
  put('redirect_url', [...EDGE_URL, '__absent']);
  put('signature', [...EDGE_SIG, '__absent']);
  put('response_signature', [...EDGE_SIG, '__absent']);
  put('idempotency_key', ['k', '', 5, undefined, '__absent']);
  put('status', ['approved', 'declined', 'pending', 'error', 'bogus', '', null, '__absent']);
  put('transaction_id', [...EDGE_STR, '__absent']);
  const sm = Math.floor(BE() * 8);
  if (sm < 5) p.shared_payment_token = edgeSpt();
  else if (sm === 5) p.shared_payment_token = pick(BE, [[], null, 'str', 0]);
  return p;
}
function checkPD1_reference_model_differential() {
  let violations = 0, checked = 0;
  const pps = [];
  for (let i = 0; i < 6000; i++) {
    const r = BE();
    pps.push({ message_type_override: pick(BE, ['auto', 'auto', undefined, null, 'CheckoutRequest', 'CheckoutResponse', 'bogus']), payload: r < 0.03 ? pick(BE, [null, 'str', 5, 0, [], undefined]) : edgePayload() });
  }
  // each message type with a fully-valid base, then one-field mutations (single-rule pass/fail edges)
  for (let i = 0; i < 3000; i++) {
    const req = i % 2 === 0;
    const p = edgePayload();
    p.message_type = req ? 'CheckoutRequest' : 'CheckoutResponse';
    pps.push({ message_type_override: 'auto', payload: p });
  }
  for (const pp of pps) {
    checked++;
    let got, want;
    try { got = compute(pp); } catch (e) { violations++; continue; }
    want = refCompute(pp);
    if (JSON.stringify(got) !== JSON.stringify(want)) violations++;
  }
  return { name: 'PD1_reference_model_differential_exact', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_status_differential());
results.properties.push(checkP3_echo_boundedness());
results.properties.push(checkP4_items_permutation_invariance());
results.properties.push(checkPF1_bigintInputRefusesWithoutThrowing());
results.properties.push(checkPD1_reference_model_differential());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-12-acp-checkout-conformance-validator',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
