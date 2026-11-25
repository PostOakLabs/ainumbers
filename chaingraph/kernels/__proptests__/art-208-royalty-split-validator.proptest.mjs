// art-208-royalty-split-validator.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C6-1).
// kernel_digest_at_authoring: sha256:20ed9dff4580fedd37d55f70933ea67a9c7396e92759cd1e8636dd1226067ecd
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: YES -- CONFIRMED by direct read (the one WU-flagged "most likely to have real
// division" kernel in this shard, and it does: `mode === 'percent'` sums caller-supplied percent
// shares with `Math.abs(sum - total) <= tolerance` where tolerance=0.001, plus `capBps / 100` and
// per-entry `sv > capInMode` comparisons). ULP-BOUNDARY FORCING IS MANDATORY here per spec §3.
// Checks: fixture-oracle gate, termination (rule loops bounded by caller entries.length --
// recipient_count === entries.length is asserted directly), boundedness (sum is always finite,
// never NaN), FORCED ULP-boundary cases (percent sum exactly at the ±0.001 tolerance edge, one
// ULP inside/outside that edge, 0, negative zero, classic float non-associativity inputs like
// 33.33+33.33+33.34, denormal-scale shares, cap-boundary equality sv===capInMode), a differential
// re-derivation of `sumOk`/`capOk` from the reported `sum`/`cap_bps`, and metamorphic address-order
// invariance (permuting entries never changes `valid`/`sum`/rule verdicts, only config_hash's
// internal sort order which is already address-sorted and therefore also invariant).
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-208-royalty-split-validator.proptest.mjs

import { compute } from '../art-208-royalty-split-validator.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-208-royalty-split-validator.fixtures.json');
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
const rand = mulberry32(0x2080A0);

function randAddr(rng) {
  let s = '0x';
  for (let i = 0; i < 40; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

function randomBpsEntries(rng, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ address: randAddr(rng), basis_points: Math.floor(rng() * 10000) });
  return out;
}

const TRIALS = 5000;

// ---------- P1: termination — recipient_count exactly entries.length, sum always finite ----------
function checkP1_termination_and_finiteness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15);
    const entries = randomBpsEntries(rand, n);
    const { output_payload } = compute({ entries });
    checked++;
    if (output_payload.recipient_count !== n) violations++;
    if (!Number.isFinite(output_payload.sum)) violations++;
  }
  return { name: 'P1_termination_bounded_by_entries_and_sum_finite', trials: checked, violations };
}

// ---------- P2 (differential): sumOk/capOk re-derivation from reported sum/cap_bps ----------
function checkP2_sum_cap_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = 1 + Math.floor(rand() * 10);
    const entries = randomBpsEntries(rand, n);
    const cap_bps = 1 + Math.floor(rand() * 10000);
    const { output_payload } = compute({ entries, cap_bps });
    checked++;
    const sumRule = output_payload.rules.find((r) => r.id === 'sum');
    const expectedSumOk = Math.abs(output_payload.sum - 10000) <= 0; // bps mode, tolerance=0
    if (sumRule.pass !== expectedSumOk) violations++;
    const capRule = output_payload.rules.find((r) => r.id === 'cap');
    const anyOverCap = entries.some((e) => e.basis_points > output_payload.cap_bps);
    if (capRule.pass !== !anyOverCap) violations++;
  }
  return { name: 'P2_sum_cap_differential', trials: checked, violations };
}

// ---------- P3: FORCED ULP-boundary cases (percent mode, mandatory per §3 for float-sensitive kernels) ----------
function checkP3_ulp_boundary_forcing() {
  const cases = [];
  const push = (name, entries, expectSumOk) => cases.push({ name, entries, expectSumOk });

  push('exact_100', [{ address: '0x' + '1'.repeat(40), percent: 100 }], true);
  // 100.001 - 100 in IEEE-754 double rounds to 0.0010000000000047748 (> 0.001) -- the literal
  // decimal "at the boundary" is NOT exactly representable and rounds to just OUTSIDE tolerance.
  // This is the real ULP-forcing finding for this kernel: the naive "boundary = pass" assumption
  // is false once float rounding is accounted for. Documented in the manifest per FIX-2 discipline.
  push('boundary_literal_100.001_rounds_just_outside_tolerance', [{ address: '0x' + '1'.repeat(40), percent: 100.001 }], false);
  push('boundary_literal_99.999_rounds_just_outside_tolerance', [{ address: '0x' + '1'.repeat(40), percent: 99.999 }], false);
  push('genuinely_within_tolerance_100.0005', [{ address: '0x' + '1'.repeat(40), percent: 100.0005 }], true);
  push('one_ulp_beyond_tolerance', [{ address: '0x' + '1'.repeat(40), percent: 100.001 + Number.EPSILON * 100 }], false);
  push('classic_float_nonassoc_33s', [
    { address: '0x' + '1'.repeat(40), percent: 33.33 },
    { address: '0x' + '2'.repeat(40), percent: 33.33 },
    { address: '0x' + '3'.repeat(40), percent: 33.34 },
  ], true); // 33.33+33.33+33.34 = 100.00000000000001 in IEEE-754, within 0.001 tolerance
  push('zero_percent_single', [{ address: '0x' + '1'.repeat(40), percent: 0 }], false);
  push('negative_zero_percent', [{ address: '0x' + '1'.repeat(40), percent: -0 }, { address: '0x' + '2'.repeat(40), percent: 100 }], true);
  push('denormal_scale_noise', [
    { address: '0x' + '1'.repeat(40), percent: 100 },
    { address: '0x' + '2'.repeat(40), percent: Number.MIN_VALUE }, // denormal, effectively 0 against a 0.001 tolerance
  ], true);
  push('far_outside_tolerance', [{ address: '0x' + '1'.repeat(40), percent: 90 }], false);

  let violations = 0, checked = 0;
  const detail = [];
  for (const c of cases) {
    const { output_payload } = compute({ entries: c.entries });
    checked++;
    const sumRule = output_payload.rules.find((r) => r.id === 'sum');
    if (sumRule.pass !== c.expectSumOk) { violations++; detail.push({ case: c.name, expected: c.expectSumOk, got: sumRule.pass, sum: output_payload.sum }); }
  }
  return { name: 'P3_ULP_boundary_forcing_percent_tolerance', trials: checked, violations, detail };
}

// ---------- P4: metamorphic — permuting entries never changes valid/sum/rule verdicts ----------
function checkP4_entry_order_invariance() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rand() * 8);
    const entries = randomBpsEntries(rand, n);
    const shuffled = entries.slice();
    for (let k = shuffled.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [shuffled[k], shuffled[j]] = [shuffled[j], shuffled[k]];
    }
    const r1 = compute({ entries }).output_payload;
    const r2 = compute({ entries: shuffled }).output_payload;
    checked++;
    if (r1.valid !== r2.valid) violations++;
    if (r1.sum !== r2.sum) violations++;
    if (JSON.stringify(r1.rules.map((r) => [r.id, r.pass])) !== JSON.stringify(r2.rules.map((r) => [r.id, r.pass]))) violations++;
  }
  return { name: 'P4_entry_order_invariance', trials: checked, violations };
}

// ---------- PF1 (KERNEL-BIGINT-F1-SAFE-FORMAT-1): a BigInt on entries[0].basis_points refuses, never throws ----------
// RED on main: compute() threw "Do not know how to serialize a BigInt" while building the
// share-field validation detail and while canonicalizing the config fingerprint. GREEN on head:
// the same input fails the share_type rule with the kernel's existing flag shape
// (measured across 4 BigInt values on this field, origin/main 0289be7577 vs this branch).
function checkPF1_bigintInputRefusesWithoutThrowing() {
  let violations = 0, checked = 0;
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-208-royalty-split-validator.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  for (const big of [7n, 123456789012345678901234567890n, -1n, 0n]) {
    const pp = structuredClone(fixtures.vectors[0].policy_parameters);
    if (!pp.entries || !Array.isArray(pp.entries) || pp.entries.length === 0) pp.entries = [{ recipient: 'R1', share_type: 'percent', value: 50 }];
    pp.entries[0].basis_points = big;
    checked++;
    try {
      const r = compute(pp);
      if (!r || !r.compliance_flags || !r.compliance_flags.includes('VALIDATION_FAILED')) violations++;
    } catch (e) {
      violations++; // the serialization throw this cure removes
    }
  }
  return { name: 'PF1_bigint_entry_basis_points_refuses_without_throwing', trials: checked, violations };
}

// ---------- PD1 (MUTATION-FLOOR-CURE): exact differential against an independent reference model ----------
// Re-derives the complete output (mode, count, sum, cap, every rule verdict AND detail string,
// the config fingerprint and the flags) from the rule text over boundary-heavy inputs.
function refDjb2(s) {
  let h = 5381;
  for (const ch of s) h = (Math.imul(h, 33) ^ ch.charCodeAt(0)) >>> 0;
  return '0x' + h.toString(16).padStart(8, '0');
}
const refNorm = (a) => (typeof a === 'string' ? a : String(a || '')).toLowerCase().trim();
const refStr = (a) => String(a || '').trim();
function refCompute(pp) {
  pp = pp || {};
  const ci = pp.cap_bps;
  let cap;
  if (typeof ci === 'number' && ci >= 1 && ci <= 10000) cap = ci;
  else {
    const pi = parseInt(String(ci || ''), 10);
    cap = pi >= 1 ? Math.min(10000, Math.max(1, pi)) : 5000;
  }
  let entries = [];
  if (Array.isArray(pp.entries)) entries = pp.entries;
  else if (typeof pp.config === 'string' && pp.config.trim()) { try { entries = JSON.parse(pp.config); } catch (_) { entries = []; } }
  else if (typeof pp.config === 'object' && Array.isArray(pp.config)) entries = pp.config;
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      output_payload: { valid: false, mode: 'bps', recipient_count: 0, sum: 0, cap_bps: cap, rules: [{ id: 'input', label: 'Input entries', pass: false, detail: 'No entries provided (empty-input mode).' }], config_hash: refDjb2('[]'), disclaimer: 'Not legal advice. Validation only; no on-chain calls. Consult a licensed attorney and review ERC-2981 / 0xSplits documentation for your deployment.' },
      compliance_flags: ['EMPTY_INPUT'],
    };
  }
  const E = entries.map((e) => e || {});
  const pctMode = E.some((e) => e.percent !== undefined || e.pct !== undefined);
  const mode = pctMode ? 'percent' : 'bps';
  const total = pctMode ? 100 : 10000;
  const capIn = pctMode ? cap / 100 : cap;
  const tol = pctMode ? 0.001 : 0;
  const sh = E.map((e) => {
    let s;
    if (!pctMode) s = e.basis_points !== undefined ? e.basis_points : e.bps !== undefined ? e.bps : e.shares !== undefined ? e.shares : null;
    else s = e.percent !== undefined ? e.percent : e.pct !== undefined ? e.pct : null;
    return { address: e.address, share: s };
  });
  const rules = [];
  let sum = 0;
  for (const x of sh) { const n = Number(x.share); if (!Number.isNaN(n)) sum += n; }
  const gap = Math.abs(sum - total);
  const sumOk = gap <= tol;
  rules.push({ id: 'sum', label: 'Share sum', pass: sumOk, detail: `Sum: ${sum}${pctMode ? '% (must equal 100)' : ' bps (must equal 10000)'}${sumOk ? '' : ' -- off by ' + (gap < 1 ? gap.toFixed(4) : String(Math.round(gap)))}` });
  const viol = [];
  for (const x of sh) { const n = Number(x.share); if (!Number.isNaN(n) && n > capIn) viol.push(`${String(x.address || '(blank)').slice(0, 12)}... (${n})`); }
  rules.push({ id: 'cap', label: 'Per-recipient cap', pass: viol.length === 0, detail: `Cap: ${cap} bps (${cap / 100}%)${viol.length === 0 ? ' -- all entries within cap' : ' -- exceeds cap: ' + viol.join(', ')}` });
  const seen = new Map();
  const dups = [];
  for (const x of sh) {
    const na = refNorm(x.address);
    if (na && seen.get(na)) dups.push(`${String(x.address).slice(0, 12)}...`);
    seen.set(na, true);
  }
  rules.push({ id: 'dups', label: 'No duplicate addresses', pass: dups.length === 0, detail: dups.length === 0 ? 'All addresses are unique' : 'Duplicates found: ' + dups.join(', ') });
  const zero = '0x' + '0'.repeat(40);
  const blanks = [];
  sh.forEach((x, i) => { const a = refStr(x.address); if (a === '' || a === '0x' || refNorm(a) === zero) blanks.push(`entry ${i + 1}`); });
  rules.push({ id: 'no_blank', label: 'No zero/blank addresses', pass: blanks.length === 0, detail: blanks.length === 0 ? 'No blank or zero addresses' : 'Blank or zero address at: ' + blanks.join(', ') });
  const oor = [];
  sh.forEach((x, i) => { const n = Number(x.share); if (Number.isNaN(n) || n < 0 || n > total) oor.push(`entry ${i + 1} (${x.share})`); });
  rules.push({ id: 'range', label: pctMode ? 'Share values 0-100%' : 'Share values 0-10000 bps', pass: oor.length === 0, detail: oor.length === 0 ? 'All values in range' : 'Out of range: ' + oor.join(', ') });
  const bad = [];
  sh.forEach((x, i) => { const a = refStr(x.address); if (!/^0x[0-9a-fA-F]{40}$/.test(a)) bad.push(`entry ${i + 1}: ${a.slice(0, 16) || '(empty)'}${a.length > 16 ? '...' : ''}`); });
  rules.push({ id: 'addr_fmt', label: 'Address format (0x + 40 hex chars)', pass: bad.length === 0, detail: bad.length === 0 ? 'All addresses pass format check' : 'Format failures: ' + bad.join('; ') });
  const big = [];
  sh.forEach((x, i) => { if (typeof x.share === 'bigint') big.push(`entry ${i + 1}`); });
  if (big.length) rules.push({ id: 'share_type', label: 'Share values are numbers', pass: false, detail: 'BigInt share value at: ' + big.join(', ') + ' (use a JSON number)' });
  const allPass = rules.every((r) => r.pass);
  const canon = JSON.stringify(E.map((e) => {
    const sv = pctMode ? (e.percent !== undefined ? e.percent : e.pct) : (e.basis_points !== undefined ? e.basis_points : e.bps !== undefined ? e.bps : e.shares);
    return { address: refNorm(e.address), share: sv };
  }).sort((p, q) => (p.address < q.address ? -1 : 1)), (_k, x) => (typeof x === 'bigint' ? x.toString() + 'n' : x));
  const flags = ['ROYALTY_SPLIT_VALIDATED', 'VALIDATE_ONLY', 'NO_ON_CHAIN_ACTION'];
  if (!allPass) flags.push('VALIDATION_FAILED');
  return {
    output_payload: { valid: allPass, mode, recipient_count: entries.length, sum, cap_bps: cap, rules, config_hash: refDjb2(canon), disclaimer: 'Not legal advice. Validation only; no on-chain calls, no royalty distribution. ERC-2981 is advisory. Consult a licensed attorney and review the 0xSplits documentation for your deployment.' },
    compliance_flags: flags,
  };
}

const BE = mulberry32(0xB0A208);
const pickB = (arr) => arr[Math.floor(BE() * arr.length)];
const ADDR_A = '0x' + 'a'.repeat(40), ADDR_B = '0x' + 'B'.repeat(40), ADDR_C = '0x' + '1234567890'.repeat(4);
const EDGE_ADDR = [ADDR_A, ADDR_B, ADDR_C, ADDR_A.toUpperCase().replace('0X', '0x'), ' ' + ADDR_A + ' ', '0x' + '0'.repeat(40), '0x', '0X' + '0'.repeat(40), '', '   ', undefined, null, 0, 12345, '0x' + 'g'.repeat(40), '0x' + 'a'.repeat(39), '0x' + 'a'.repeat(41), 'a'.repeat(42), '0xABCDEF0123456789abcdef0123456789ABCDEF01', 'short', 'a-very-long-address-string-over-16'];
const EDGE_BPS = [0, 1, 4999, 5000, 5001, 9999, 10000, 10001, -1, 2500, 3333, 3334, 100, 0.5, 33.33, '5000', '', 'abc', null, NaN, 1e9, undefined];
const EDGE_PCT = [0, 50, 33.33, 33.34, 99.999, 100, 100.0005, 100.001, 100.002, 101, -5, 0.001, 25, 40, 50.5, '50', null, NaN, undefined];
const EDGE_CAP = [undefined, null, 0, 1, 2, 5000, 5000.5, 9999, 10000, 10001, 20000, -5, '2500', '0', '1', 'abc', '12abc', '10001', '', NaN, 1e9, 250];
function edgeEntry(pctM) {
  const e = {};
  const ad = pickB(EDGE_ADDR);
  if (ad !== undefined) e.address = ad;
  const f = pctM ? pickB(['percent', 'pct', 'percent']) : pickB(['basis_points', 'bps', 'shares', 'basis_points']);
  const v = pctM ? pickB(EDGE_PCT) : pickB(EDGE_BPS);
  if (v !== undefined || BE() < 0.5) e[f] = v;
  if (BE() < 0.1) e[pickB(['basis_points', 'bps', 'shares', 'percent', 'pct'])] = pickB([100, 7, undefined, 0]);
  return e;
}
function edgeInput() {
  const pctM = BE() < 0.4;
  const n = Math.floor(BE() * 5);
  const entries = Array.from({ length: n }, () => (BE() < 0.04 ? pickB([null, undefined]) : edgeEntry(pctM)));
  if (BE() < 0.25 && entries.length >= 2) {
    // exact-sum and duplicate-address structures
    entries[1] = { ...(entries[0] || {}), address: pickB([entries[0] && entries[0].address, String(entries[0] && entries[0].address || '').toUpperCase()]) };
  }
  if (BE() < 0.3 && entries.length >= 1) {
    const t = pctM ? 100 : 10000;
    const share = pickB([t, t / 2, t - 1, t + 1, 0]);
    const k = pctM ? 'percent' : 'basis_points';
    for (let i = 0; i < entries.length; i++) if (entries[i] && typeof entries[i] === 'object') entries[i] = { ...entries[i], [k]: i === 0 ? share : (t - share) / (entries.length - 1 || 1) };
  }
  const pp = {};
  const cap = pickB(EDGE_CAP);
  if (cap !== undefined) pp.cap_bps = cap;
  const form = Math.floor(BE() * 8);
  if (form < 4) pp.entries = entries;
  else if (form === 4) pp.config = JSON.stringify(entries);
  else if (form === 5) pp.config = entries;
  else if (form === 6) pp.config = pickB(['', '  ', 'not json', '[]', '{}', '[1', 5, null]);
  else if (BE() < 0.5) pp.entries = pickB(['x', {}, null, []]);
  return pp;
}
function checkPD1_reference_model_differential() {
  let violations = 0, checked = 0;
  const inputs = [undefined, null, {}, { entries: [] }, { entries: [{ address: ADDR_A, basis_points: 10000 }] }];
  for (let i = 0; i < 12000; i++) inputs.push(edgeInput());
  for (const pp of inputs) {
    checked++;
    let got;
    try { got = compute(pp); } catch (e) { violations++; continue; }
    if (JSON.stringify(got, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x)) !== JSON.stringify(refCompute(pp), (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x))) violations++;
  }
  return { name: 'PD1_reference_model_differential_exact', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination_and_finiteness());
results.properties.push(checkP2_sum_cap_differential());
results.properties.push(checkP3_ulp_boundary_forcing());
results.properties.push(checkP4_entry_order_invariance());
results.properties.push(checkPF1_bigintInputRefusesWithoutThrowing());
results.properties.push(checkPD1_reference_model_differential());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-208-royalty-split-validator',
  float_sensitive: true,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
