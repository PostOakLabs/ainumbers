// art-830-eip3009-spend-exposure-reconciler — property-test FLOOR. Scaffolded by scripts/new-kernel.mjs
// (KERNEL-SCAFFOLD-1), authored under board row EIP3009-SPEND-EXPOSURE-RECONCILER-1 (K-FULL).
// kernel_digest_at_authoring: sha256:3e2ec8bec31a50147e7bd65a4ebc6f614b7b2dc9cbe1a4acd213570cfe4e683a
// spec: EIP3009-SPEND-EXPOSURE-RECONCILER-1 (board/claimed) — reconciles a caller-pasted
// authorization ledger against caller-pasted AuthorizationUsed / AuthorizationCanceled
// event rows on a caller clock; clause digests pinned from erc-3009 snapshot 2026-11-03.
// human_sign_off: PENDING
//
// float_sensitive: NO — integer-only kernel (uint256 as decimal strings, string-int helpers).
//
// Checks: fixture-oracle gate, order independence (ledger and both event lists permuted ->
// byte-identical payload), used-event precedence (an unambiguous used event forces settled
// regardless of ledger status or clock, and settled entries never enter the exposure total),
// exposure additivity (inserting or removing one outstanding entry shifts the total by exactly
// that value), closed-set conformance (classes, discrepancy codes, not-evaluated aspects),
// seed-determinism (same input twice -> byte-identical output), refusal shape for malformed
// inputs, and negative control (expired signed entry is expired_unspent, never outstanding).
// Zero external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-830-eip3009-spend-exposure-reconciler.proptest.mjs

import { compute } from '../art-830-eip3009-spend-exposure-reconciler.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-830-eip3009-spend-exposure-reconciler';

// decimal-string compare for uint256-shaped values (length, then lexicographic)
function cmpDec(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x83a7e);

const AGENTS = ['0x1111111111111111111111111111111111111111', '0x4444444444444444444444444444444444444444'];
const TOKENS = ['0x31c8eacbff8e47cfbefd98d63ab04cbaff51c9cc', '0x9999999999999999999999999999999999999999'];
const CHAINS = ['84532', '1'];
const STATUSES = ['signed', 'settled', 'canceled'];
const BASE_NOW = 1700001000;

const hex32 = (n) => '0x' + n.toString(16).padStart(64, '0');

// random scenario: 1-6 ledger entries (occasionally colliding nonce+token+chain identities),
// event lists that mostly reference existing entries (some unknown, some duplicated),
// clock sometimes present, event lists sometimes absent
function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 6);
  const ledger = [];
  for (let i = 0; i < n; i++) {
    ledger.push({
      from: AGENTS[Math.floor(rng() * AGENTS.length)],
      token: TOKENS[Math.floor(rng() * TOKENS.length)],
      chain_id: CHAINS[Math.floor(rng() * CHAINS.length)],
      nonce: hex32(rng() < 0.15 ? 0xabab : 1 + Math.floor(rng() * 0xffffff)),
      to: '0x2222222222222222222222222222222222222222',
      value: String(Math.floor(rng() * 100000)),
      validBefore: String(BASE_NOW + Math.floor(rng() * 10000) - 5000),
      signed_at: BASE_NOW - 1000 - Math.floor(rng() * 5000),
      status: STATUSES[Math.floor(rng() * STATUSES.length)],
    });
  }
  const pp = { ledger };
  const mkEv = () => {
    const src = ledger[Math.floor(rng() * ledger.length)];
    const ev = { authorizer: src.from, nonce: src.nonce };
    if (rng() < 0.3) ev.token = src.token;
    if (rng() < 0.3) ev.chain_id = src.chain_id;
    return ev;
  };
  if (rng() < 0.85) {
    pp.used_events = [];
    const u = Math.floor(rng() * 3);
    for (let i = 0; i < u; i++) {
      pp.used_events.push(rng() < 0.1 ? { authorizer: AGENTS[0], nonce: hex32(0xeeee0000) } : mkEv());
    }
  }
  if (rng() < 0.85) {
    pp.canceled_events = [];
    const c = Math.floor(rng() * 3);
    for (let i = 0; i < c; i++) {
      pp.canceled_events.push(rng() < 0.1 ? { authorizer: AGENTS[1], nonce: hex32(0xdddd0000) } : mkEv());
    }
  }
  if (rng() < 0.85) pp.now_unix = BASE_NOW;
  return pp;
}

const TRIALS = 60;

function permute(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- P1: order independence — permuted ledger/events -> byte-identical payload ----------
function checkP1_order_independence() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const shuffled = {
      ledger: permute(pp.ledger, rand),
      used_events: pp.used_events ? permute(pp.used_events, rand) : undefined,
      canceled_events: pp.canceled_events ? permute(pp.canceled_events, rand) : undefined,
      now_unix: pp.now_unix,
    };
    // undefined keys must not appear as explicit undefined members
    for (const k of ['used_events', 'canceled_events']) {
      if (shuffled[k] === undefined) delete shuffled[k];
    }
    checked++;
    if (JSON.stringify(compute(pp).output_payload) !== JSON.stringify(compute(shuffled).output_payload)) violations++;
  }
  return { name: 'P1_order_independence_permuted_inputs_same_payload', trials: checked, violations };
}

// ---------- P2: used-event precedence — unambiguous used event forces settled, outside total ----------
function checkP2_used_event_forces_settled() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    // single-entry ledger with a UNIQUE identity: the event cannot be ambiguous or conflicted
    const pp = {
      ledger: [{
        from: AGENTS[0], token: TOKENS[0], chain_id: CHAINS[0], nonce: hex32(1 + i),
        to: '0x2222222222222222222222222222222222222222',
        value: String(1 + i), validBefore: String(BASE_NOW + 7200), signed_at: BASE_NOW - 100,
        status: STATUSES[i % 3],
      }],
      used_events: [{ authorizer: AGENTS[0], nonce: hex32(1 + i) }],
      canceled_events: [],
      now_unix: BASE_NOW,
    };
    const out = compute(pp).output_payload;
    checked++;
    if (out.entries[0].class !== 'settled') violations++;
    if (cmpDec(out.exposure.total_outstanding, '0') !== 0) violations++;
    if (out.exposure.entries_in_total !== 0) violations++;
  }
  return { name: 'P2_used_event_forces_settled_never_in_total', trials: checked, violations };
}

// ---------- P3: exposure additivity — removing one outstanding entry drops the total by exactly its value ----------
function checkP3_exposure_additivity() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const mk = (k) => ({
      from: AGENTS[0], token: TOKENS[0], chain_id: CHAINS[0], nonce: hex32(k),
      to: '0x2222222222222222222222222222222222222222',
      value: String(1000 + k), validBefore: String(BASE_NOW + 7200), signed_at: BASE_NOW - 100, status: 'signed',
    });
    const full = compute({ ledger: [mk(1), mk(2), mk(3)], used_events: [], canceled_events: [], now_unix: BASE_NOW }).output_payload;
    const dropped = compute({ ledger: [mk(1), mk(3)], used_events: [], canceled_events: [], now_unix: BASE_NOW }).output_payload;
    checked++;
    // full = dropped + value(mk(2)) = dropped + '1002'
    const want = addStrings(dropped.exposure.total_outstanding, '1002');
    if (cmpDec(full.exposure.total_outstanding, want) !== 0) violations++;
    if (full.exposure.entries_in_total !== dropped.exposure.entries_in_total + 1) violations++;
  }
  return { name: 'P3_exposure_additive_unit_flip', trials: checked, violations };
}

// tiny decimal-string add (values are bounded 6-digit here; schoolbook is exact)
function addStrings(a, b) {
  const A = a.split('').reverse(), B = b.split('').reverse();
  const out = [];
  let carry = 0;
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const s = (A[i] ? +A[i] : 0) + (B[i] ? +B[i] : 0) + carry;
    out.push(String(s % 10));
    carry = s >= 10 ? 1 : 0;
  }
  if (carry) out.push('1');
  return out.reverse().join('');
}

// ---------- P4: closed-set conformance — classes, codes, aspects come from closed sets ----------
const CLASSES = new Set(['settled', 'canceled', 'expired_unspent', 'outstanding', 'not_evaluated']);
const DISC_CODES = new Set([
  'LEDGER_SAYS_SIGNED_EVENTS_SETTLED', 'LEDGER_SAYS_SIGNED_EVENTS_CANCELED',
  'LEDGER_SAYS_SETTLED_EVENTS_CANCELED', 'LEDGER_SAYS_CANCELED_EVENTS_SETTLED',
  'EVENT_CONFLICT', 'EVENT_WITHOUT_LEDGER_ENTRY', 'AMBIGUOUS_EVENT_SCOPE', 'DUPLICATE_EVENT_ROW',
]);
const ASPECTS = new Set(['used_events', 'canceled_events', 'now_unix']);
function checkP4_closed_sets() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const out = compute(randomPP(rand)).output_payload;
    checked++;
    for (const e of out.entries) if (!CLASSES.has(e.class)) violations++;
    for (const d of out.discrepancies) if (!DISC_CODES.has(d.code)) violations++;
    for (const n of out.not_evaluated) if (!ASPECTS.has(n.aspect)) violations++;
    const sum = Object.values(out.class_counts).reduce((a, b) => a + b, 0);
    if (sum !== out.entries.length) violations++;
  }
  return { name: 'P4_closed_set_conformance_class_code_aspect', trials: checked, violations };
}

// ---------- P5: determinism — same input twice -> byte-identical full envelope ----------
function checkP5_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rand);
    checked++;
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(pp))) violations++;
  }
  return { name: 'P5_determinism_same_input_twice', trials: checked, violations };
}

// ---------- P6: refusal shape — malformed inputs refuse with empty entries and flag ----------
function checkP6_refusal_shape() {
  const malformed = [
    { ledger: [{ from: '0xzz' }], now_unix: BASE_NOW },
    { ledger: [{ nonce: '0x12' }], now_unix: BASE_NOW },
    { ledger: 'not-an-array', now_unix: BASE_NOW },
    { ledger: [], used_events: [{ authorizer: '0x1' }], now_unix: BASE_NOW },
    { ledger: [], now_unix: 'soon' },
    { ledger: [], extra: 1, now_unix: BASE_NOW },
  ];
  let violations = 0, checked = 0;
  for (const pp of malformed) {
    const res = compute(pp);
    checked++;
    if (!res.compliance_flags.includes('INPUT_REFUSED')) violations++;
    if (res.output_payload.refusals.length === 0) violations++;
    if (res.output_payload.entries.length !== 0) violations++;
  }
  return { name: 'P6_refusal_shape_malformed_inputs', trials: checked, violations };
}

// ---------- P7: negative control — expired signed entry is expired_unspent, never outstanding ----------
function checkP7_negative_control_expired() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = {
      ledger: [{
        from: AGENTS[0], token: TOKENS[0], chain_id: CHAINS[0], nonce: hex32(0x77 + i),
        to: '0x2222222222222222222222222222222222222222',
        value: String(7 + i), validBefore: String(BASE_NOW - 1 - i), signed_at: BASE_NOW - 1000, status: 'signed',
      }],
      used_events: [], canceled_events: [], now_unix: BASE_NOW,
    };
    const out = compute(pp).output_payload;
    checked++;
    if (out.entries[0].class !== 'expired_unspent') violations++;
    if (cmpDec(out.exposure.total_outstanding, '0') !== 0) violations++;
  }
  return { name: 'P7_negative_control_expired_never_outstanding', trials: checked, violations };
}

// ---------- P8: flag-mirror — warnings is exactly the non-INPUT_REFUSED flag list ----------
function checkP8_flag_mirror() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const res = compute(randomPP(rand));
    const flags = res.compliance_flags.filter((f) => f !== 'INPUT_REFUSED');
    checked++;
    if (JSON.stringify(res.output_payload.warnings) !== JSON.stringify(flags)) violations++;
    if (res.output_payload.warnings.length > 0 && !flags.length) violations++;
    if (flags.length > 0 && res.output_payload.warnings.length === 0) violations++;
  }
  return { name: 'P8_warnings_mirror_conditional_flags', trials: checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(fixtures readable)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_order_independence(),
  checkP2_used_event_forces_settled(),
  checkP3_exposure_additivity(),
  checkP4_closed_sets(),
  checkP5_determinism(),
  checkP6_refusal_shape(),
  checkP7_negative_control_expired(),
  checkP8_flag_mirror(),
];
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
