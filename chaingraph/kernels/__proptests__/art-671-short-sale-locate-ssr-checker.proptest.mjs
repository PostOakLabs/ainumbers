// art-671-short-sale-locate-ssr-checker — class-K property-test floor.
// kernel_digest_at_authoring: sha256:a4568b1c4d2387b3040c0dd0ba7236def99524e05a0fb0b8fd763da431fb0e4e
// spec: SHORTSALE-LOCATE-BUILD-SPEC.md (SHORTSALE-LOCATE-BUILD-1) — worked example is the parity pin.
// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-671-short-sale-locate-ssr-checker.proptest.mjs

import { compute } from '../art-671-short-sale-locate-ssr-checker.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-671-short-sale-locate-ssr-checker';

const rand = mulberry32(0x671);

const SOURCES = ['easy_to_borrow_list', 'hard_to_borrow_list', 'agreed_borrow', 'proprietary_inventory'];

/** Random VALID policy_parameters: sell_short order, declared source, ISO date, boolean flags. */
function mkValidPP(rng, overrides = {}) {
  const day = 1 + Math.floor(rng() * 28);
  const month = String(1 + Math.floor(rng() * 12)).padStart(2, '0');
  return {
    order: {
      side: 'sell_short',
      qty: 1 + Math.floor(rng() * 1000000),
      symbol: 'SYN-' + String.fromCharCode(65 + Math.floor(rng() * 26)) + Math.floor(rng() * 10),
    },
    locate: {
      source: pick(rng, SOURCES),
      list_date: `2026-${month}-${String(day).padStart(2, '0')}`,
      on_list: rng() < 0.7,
    },
    ssr_active: rng() < 0.3,
    ...overrides,
  };
}

// ---------- P1: determinism — compute() is a pure function of pp ----------
function checkP1_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 5000; i++) {
    const pp = mkValidPP(rand);
    const r1 = JSON.stringify(compute(pp).output_payload);
    const r2 = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))).output_payload);
    checked++;
    if (r1 !== r2) violations++;
  }
  return { name: 'P1_determinism_same_pp_same_output', checked, violations };
}

// ---------- P2: classification invariants — ssr_restriction is a verbatim pass-through; locate_satisfied follows on_list ----------
function checkP2_passThrough() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 8000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    if (op.ssr_restriction !== pp.ssr_active) violations++;
    if (op.locate_satisfied !== pp.locate.on_list) violations++;
    if (op.locate_satisfied && !op.ssr_restriction && op.overall !== 'LOCATE_DOCUMENTED') violations++;
    if (op.locate_satisfied && op.ssr_restriction && op.overall !== 'SSR_RESTRICTED') violations++;
    if (!op.locate_satisfied && op.overall !== 'LOCATE_MISSING') violations++;
  }
  return { name: 'P2_flags_pass_through_and_overall_precedence', checked, violations };
}

// ---------- P3: domain rejection — invalid input is always refused, never silently classified ----------
function checkP3_domainRejection() {
  let violations = 0, checked = 0;
  const spoils = [
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.order.side = 'buy'; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.order.side = 'SELL_SHORT'; return q; }, // case-normalized: still valid
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); delete q.order.side; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.order.qty = 0; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.order.qty = 100.5; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.order.symbol = '   '; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.order.symbol = 42; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.locate.source = 'my_buddies_book'; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.locate.source = undefined; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.locate.list_date = '09/03/2026'; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.locate.list_date = '2026-9-3'; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.locate.on_list = 'yes'; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); delete q.locate.on_list; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); q.ssr_active = 1; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); delete q.ssr_active; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); delete q.order; return q; },
    (pp) => { const q = JSON.parse(JSON.stringify(pp)); delete q.locate; return q; },
    () => ({}),
  ];
  for (let i = 0; i < 8000; i++) {
    const base = mkValidPP(rand);
    const q = pick(rand, spoils)(base);
    const { output_payload: op, compliance_flags } = compute(q);
    checked++;
    // The one case-normalization probe is a VALID input; every other spoil must refuse.
    const isValid = q.order && q.order.side === 'SELL_SHORT' && q.order.qty > 0 && q.locate && q.locate.source && q.locate.list_date && typeof q.locate.on_list === 'boolean' && typeof q.ssr_active === 'boolean';
    if (isValid) {
      if (op.domain_errors) violations++;
      continue;
    }
    if (!Array.isArray(op.domain_errors) || op.domain_errors.length === 0) { violations++; continue; }
    if (!compliance_flags.includes('DOMAIN_ERROR')) violations++;
    if (op.locate_satisfied !== null || op.ssr_restriction !== null || op.overall !== null) violations++;
    if (typeof op.note !== 'string' || !op.note.startsWith('fail-closed:')) violations++;
  }
  return { name: 'P3_invalid_input_always_fail_closed_never_classified', checked, violations };
}

// ---------- P4: success payload shape — exactly the four canonical keys, no caveat carrier ----------
function checkP4_successShape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 4000; i++) {
    const pp = mkValidPP(rand);
    const { output_payload: op, compliance_flags } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    const keys = Object.keys(op).sort().join(',');
    if (keys !== 'locate_satisfied,note,overall,ssr_restriction') violations++;
    if (compliance_flags.length !== 0) violations++; // no unconditional emissions: success raises no flag
    if (typeof op.note !== 'string' || op.note.length === 0) violations++;
    if (op.note.startsWith('fail-closed:')) violations++;
  }
  return { name: 'P4_success_payload_is_exactly_the_canonical_four_keys', checked, violations };
}

// ---------- P5: T372 pointer — LOCATE_MISSING names the buy-in pointer in the note ----------
function checkP5_t372Pointer() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 3000; i++) {
    const pp = mkValidPP(rand, { locate: { source: pick(rand, SOURCES), list_date: '2026-09-03', on_list: false }, ssr_active: false });
    const { output_payload: op } = compute(pp);
    checked++;
    if (op.domain_errors) continue;
    if (op.overall !== 'LOCATE_MISSING') violations++;
    if (!op.note.includes('T372')) violations++;
  }
  return { name: 'P5_locate_missing_note_carries_t372_buy_in_pointer', checked, violations };
}

// ---------- P6 (mandatory): pinned parity + boundary forcing ----------
const PINNED_WORKED_EXAMPLE = {
  pp: { order: { side: 'sell_short', qty: 5000, symbol: 'SYN-B' }, locate: { source: 'easy_to_borrow_list', list_date: '2026-09-03', on_list: true }, ssr_active: false },
  out: {
    locate_satisfied: true,
    ssr_restriction: false,
    note: 'locate recorded pre-order per declared source dated 2026-09-03',
    overall: 'LOCATE_DOCUMENTED',
  },
};

/** @type {[string, () => boolean][]} */
const BOUNDARY_CASES = [
  ['pinned worked example byte-identical (spec parity pin 09d0abb4...72d37)', () => {
    const { output_payload } = compute(PINNED_WORKED_EXAMPLE.pp);
    return deepEqual(output_payload, PINNED_WORKED_EXAMPLE.out);
  }],
  ['opposite verdict: identical inputs with ssr_active true flip overall to SSR_RESTRICTED', () => {
    const pp = { ...PINNED_WORKED_EXAMPLE.pp, ssr_active: true };
    const { output_payload } = compute(pp);
    return output_payload.overall === 'SSR_RESTRICTED' && output_payload.ssr_restriction === true && output_payload.locate_satisfied === true;
  }],
  ['side is case-normalized: SELL_SHORT is accepted, not refused', () => {
    const pp = JSON.parse(JSON.stringify(PINNED_WORKED_EXAMPLE.pp));
    pp.order.side = 'SELL_SHORT';
    const { output_payload } = compute(pp);
    return !output_payload.domain_errors && output_payload.overall === 'LOCATE_DOCUMENTED';
  }],
  ['qty of exactly 1 share is valid', () => {
    const pp = mkValidPP(rand, { order: { side: 'sell_short', qty: 1, symbol: 'SYN-1' } });
    const { output_payload } = compute(pp);
    return !output_payload.domain_errors;
  }],
  ['leap-day date 2024-02-29 is well-formed and accepted', () => {
    const pp = mkValidPP(rand, { locate: { source: 'easy_to_borrow_list', list_date: '2024-02-29', on_list: true } });
    const { output_payload } = compute(pp);
    return !output_payload.domain_errors;
  }],
  ['on_list true with ssr_active false but undeclared source must fail closed, never classify', () => {
    const pp = mkValidPP(rand, { locate: { source: undefined, list_date: '2026-09-03', on_list: true } });
    const { output_payload } = compute(pp);
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.includes('INVALID_LOCATE_SOURCE');
  }],
  ['empty input {} — fail closed naming every required field, never throws', () => {
    const { output_payload, compliance_flags } = compute({});
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.length >= 7
      && compliance_flags.includes('DOMAIN_ERROR');
  }],
  ['non-object order/locate containers must fail closed, never throw', () => {
    const { output_payload } = compute({ order: 'sell 5000', locate: ['easy_to_borrow_list'], ssr_active: false });
    return Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.length >= 2;
  }],
];

function checkP6_forced() {
  const rows = [];
  for (const [label, fn] of BOUNDARY_CASES) {
    let pass = false;
    try { pass = fn(); } catch (e) { pass = false; }
    rows.push({ label, pass });
  }
  return rows;
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_determinism(),
  checkP2_passThrough(),
  checkP3_domainRejection(),
  checkP4_successShape(),
  checkP5_t372Pointer(),
];
const boundaryForced = checkP6_forced();
const ok = summarize(KERNEL_ID, oracle, properties) && boundaryForced.every((b) => b.pass);
if (boundaryForced.some((b) => !b.pass)) {
  console.log('BOUNDARY-FORCED FAILURES:');
  for (const b of boundaryForced.filter((b) => !b.pass)) console.log('  ✗ ' + b.label);
}
process.exit(ok ? 0 : 1);
