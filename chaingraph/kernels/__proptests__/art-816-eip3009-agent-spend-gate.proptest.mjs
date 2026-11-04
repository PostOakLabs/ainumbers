// art-816-eip3009-agent-spend-gate property-test floor (EIP3009-SPEND-GATE-NODE-1).
// kernel_digest_at_authoring: sha256:ffcda802603d4bca4b657463b8b6f1139eff7d93497b99048abce7a5839abbaf
// spec: research/EIP3009-AGENT-SPEND-GATE-BUILD-SPEC-2026-11.md (workspace-root research dir), section 10
// human_sign_off: PENDING
//
// Properties over the thirteen-rule pre-sign spend gate:
//   P1 headroom re-derivation + one-unit boundary flips (per-transaction cap and window sums)
//   P2 ledger order independence: identical output across permutations; execution_hash equal over the
//      canonically sorted ledger, and DIFFERENT over raw permutations (the hash binds array order)
//   P3 ruled counting classes: canceled entries leave the window/duplicate sums but rule 5 still
//      matches them; a one-status flip moves OVER_LIMIT back to SPEND
//   P4 output shape, determinism, and structural refusals
//   P5 DENY outranks OVER_LIMIT with both reasons listed
//   NC negative control: a mutated payload is detectably different
// Fixed rng seed for reproducibility. ZERO external dependencies beyond the in-repo helpers.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-816-eip3009-agent-spend-gate.proptest.mjs

import { compute } from '../art-816-eip3009-agent-spend-gate.kernel.mjs';
import { executionHash } from '../_hash.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual, findShapeViolations } from './_pbt-common.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KERNEL_ID = 'art-816-eip3009-agent-spend-gate';

// ---------- shared constants (synthetic; same family as the golden fixtures) ----------
const AGENT = '0x1111111111111111111111111111111111111111';
const PAYEE = '0x2222222222222222222222222222222222222222';
const STRANGER = '0x9999999999999999999999999999999999999999';
const TOKEN = '0x31c8eacbff8e47cfbefd98d63ab04cbaff51c9cc';
const CHAIN = '84532';
const NONCE_A = '0x' + 'ab'.repeat(32);
const NONCE_B = '0x' + 'cd'.repeat(32);
const nonceOf = (b) => '0x' + b.repeat(32);
// sequence of distinct, correctly shaped 32-byte nonces ('0e…' , '1e…', …)
const nonceSeq = (i) => '0x' + ((i < 16 ? '0' : '') + i.toString(16)).repeat(32);
const NOW = 1700000100;

function auth(over = {}) {
  return Object.assign({
    variant: 'transfer', from: AGENT, to: PAYEE, value: '500',
    validAfter: '1700000000', validBefore: '1700003600', nonce: NONCE_A,
  }, over);
}
function domain(over = {}) {
  return Object.assign({ name: 'USD Coin', version: '2', chain_id: CHAIN, verifying_contract: TOKEN }, over);
}
function policy(over = {}) {
  const base = {
    agent_address: AGENT, allowed_chain_ids: [CHAIN], allowed_tokens: [TOKEN],
    payee_allowlist: [PAYEE], payee_denylist: ['0x4444444444444444444444444444444444444444'],
    per_tx_cap: '1000', window_caps: [{ window_seconds: 3600, cap: '2000' }],
    velocity: [{ window_seconds: 600, max_count: 3 }],
    max_validity_seconds: 7200, max_future_start_seconds: 300, duplicate_window_seconds: 1800,
    require_receive_for: [],
  };
  const p = Object.assign({}, base);
  for (const k of Object.keys(over)) { if (over[k] === undefined) delete p[k]; else p[k] = over[k]; }
  return p;
}
function entry(over = {}) {
  return Object.assign({
    from: AGENT, token: TOKEN, chain_id: CHAIN, nonce: NONCE_B, to: PAYEE,
    value: '500', validBefore: '1700007200', signed_at: 1700000100, status: 'settled',
  }, over);
}
function pp(authorization, domainIn, policyIn, ledger, now) {
  return { authorization, domain: domainIn, policy: policyIn, ledger, now_unix: now };
}
// the all-clear baseline: every declared rule evaluates and none fails
function happy(extraLedger, overAuth, overPolicy) {
  return pp(auth(overAuth || {}), domain(), policy(overPolicy || {}), extraLedger || [], NOW);
}

const rng = mulberry32(816);
function randInt(lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function fisherYates(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
  return out;
}

// ---------- P1: headroom re-derivation + one-unit boundary flips ----------
function checkP1HeadroomAndUnitFlips() {
  let checked = 0, violations = 0;
  for (let k = 0; k < 64; k++) {
    const v = randInt(1, 500);
    const deltas = [-1, 0, 1, 50];
    const c = v + deltas[randInt(0, deltas.length - 1)];
    const nEntries = randInt(2, 5);
    const ledger = [];
    let sum = 0;
    for (let i = 0; i < nEntries; i++) {
      const ev = randInt(1, 100);
      sum += ev;
      ledger.push(entry({
        nonce: nonceSeq(i + 1), value: String(ev),
        signed_at: NOW - 2000, status: 'settled', // inside the 3600 window, outside the 1800 duplicate window
      }));
    }
    const { output_payload } = compute(happy(ledger, { value: String(v) }, { per_tx_cap: String(c) }));
    checked++;
    const problems = [];
    // per-transaction cap: remaining is cap - value while at or under cap, null once over
    const expectSpend = v <= c;
    if (output_payload.decision !== (expectSpend ? 'SPEND' : 'OVER_LIMIT')) problems.push('decision ' + output_payload.decision);
    const primaryCode = output_payload.primary_reason ? output_payload.primary_reason.code : null;
    if (primaryCode !== (expectSpend ? null : 'OVER_PER_TX_CAP')) problems.push('primary ' + String(primaryCode));
    const ptx = output_payload.headroom.per_tx;
    const expectRemaining = expectSpend ? String(c - v) : null;
    if (ptx.remaining !== expectRemaining) problems.push('per_tx.remaining ' + String(ptx.remaining) + ' != ' + expectRemaining);
    if (ptx.cap !== String(c) || ptx.value !== String(v)) problems.push('per_tx cap/value echo');
    // window sum re-derived from the ruled counting classes (settled, signed_at in window)
    const w0 = output_payload.headroom.window_caps[0];
    if (!w0 || w0.used !== String(sum)) problems.push('window used ' + String(w0 && w0.used) + ' != ' + String(sum));
    if (!w0 || w0.remaining !== String(2000 - sum)) problems.push('window remaining ' + String(w0 && w0.remaining));
    // velocity: every entry sits outside the 600s window, so the count must be zero
    const vel0 = output_payload.headroom.velocity[0];
    if (!vel0 || vel0.count !== 0) problems.push('velocity count ' + String(vel0 && vel0.count));
    // full policy declared: nothing left NOT_EVALUATED
    if (output_payload.receipt.rules_not_evaluated !== 0 || output_payload.receipt.rules_evaluated !== 13) problems.push('receipt rules ' + JSON.stringify(output_payload.receipt));
    if (problems.length) { violations++; console.error('P1 case ' + k + ' (v=' + v + ' cap=' + c + ' sum=' + sum + '): ' + problems.join(' | ')); }
  }
  return { name: 'P1_headroom_rederivation_and_unit_flips', checked, violations };
}

// ---------- P2: ledger order independence ----------
function canonSortLedger(list) {
  const out = list.slice();
  out.sort((x, y) => {
    if (x.nonce !== y.nonce) return x.nonce < y.nonce ? -1 : 1;
    if (x.to !== y.to) return x.to < y.to ? -1 : 1;
    if (x.value !== y.value) return Number(x.value) - Number(y.value);
    if (x.signed_at !== y.signed_at) return x.signed_at - y.signed_at;
    if (x.status !== y.status) return x.status < y.status ? -1 : 1;
    return String(x.intent_ref || '') < String(y.intent_ref || '') ? -1 : 1;
  });
  return out;
}
async function checkP2LedgerOrderIndependence() {
  let checked = 0, violations = 0;
  for (let k = 0; k < 24; k++) {
    const nEntries = randInt(3, 8);
    const ledger = [];
    for (let i = 0; i < nEntries; i++) {
      ledger.push(entry({
        nonce: nonceSeq(i + 20),
        value: String(randInt(1, 400)),
        signed_at: NOW - randInt(50, 3500),
        validBefore: String(1700003600 + randInt(0, 3600)),
        status: rng() < 0.5 ? 'settled' : (rng() < 0.5 ? 'signed' : 'canceled'),
      }));
    }
    const base = pp(auth(), domain(), policy(), ledger, NOW);
    const baseOut = compute(base).output_payload;
    const perms = [fisherYates(ledger), fisherYates(ledger), fisherYates(ledger), ledger.slice().reverse()];
    checked++;
    const problems = [];
    // every permutation yields a byte-identical output_payload (observations are canonically sorted)
    for (let pi = 0; pi < perms.length; pi++) {
      const out = compute(pp(auth(), domain(), policy(), perms[pi], NOW)).output_payload;
      if (!deepEqual(out, baseOut)) problems.push('permutation ' + pi + ' changed output_payload');
    }
    // execution_hash over the canonically sorted ledger is permutation invariant
    const baseHash = await executionHash(Object.assign({}, base, { ledger: canonSortLedger(ledger) }), baseOut);
    for (let pi = 0; pi < perms.length; pi++) {
      const sorted = Object.assign({}, base, { ledger: canonSortLedger(perms[pi]) });
      const h = await executionHash(sorted, baseOut);
      if (h !== baseHash) problems.push('permutation ' + pi + ' changed the sorted-ledger execution_hash');
    }
    // negative control: the hash MUST bind raw array order (different JSON in, different hash out)
    const shuffledRaw = perms[0];
    if (JSON.stringify(shuffledRaw) !== JSON.stringify(ledger)) {
      const rawHash = await executionHash(Object.assign({}, base, { ledger: shuffledRaw }), baseOut);
      if (rawHash === baseHash) problems.push('execution_hash did not bind raw ledger array order');
    }
    if (problems.length) { violations++; console.error('P2 case ' + k + ': ' + problems.join(' | ')); }
  }
  return { name: 'P2_ledger_order_independence', checked, violations };
}

// ---------- P3: canceled exclusion, rule 5 matches any status ----------
function checkP3CanceledExclusion() {
  let checked = 0, violations = 0;
  for (let k = 0; k < 12; k++) {
    const v = randInt(1, 800);
    const problems = [];
    checked++;
    // baseline: a settled same-economics entry inside the duplicate window -> OVER_LIMIT
    const dupEntry = entry({ value: String(v), signed_at: NOW - 10 });
    const overRun = compute(happy([dupEntry], { value: String(v) })).output_payload;
    if (overRun.decision !== 'OVER_LIMIT' || !overRun.primary_reason || overRun.primary_reason.code !== 'DUPLICATE_INTENT') {
      problems.push('baseline ' + overRun.decision + '/' + String(overRun.primary_reason && overRun.primary_reason.code));
    }
    // the same entry canceled: leaves rule 13 AND the exposure/window sums
    const canceled = compute(happy([Object.assign({}, dupEntry, { status: 'canceled' })], { value: String(v) })).output_payload;
    if (canceled.decision !== 'SPEND') problems.push('canceled decision ' + canceled.decision);
    const codes = canceled.reasons.map((r) => r.code);
    if (codes.indexOf('DUPLICATE_INTENT') >= 0) problems.push('canceled still dup-flagged');
    if (canceled.exposure.settled_in_window !== '0') problems.push('canceled exposure ' + String(canceled.exposure.settled_in_window));
    if (overRun.exposure.settled_in_window !== String(v)) problems.push('baseline exposure ' + String(overRun.exposure.settled_in_window));
    // the dup entry is the only ledger entry and sits inside the 3600s window while settled:
    // canceling it must drop the window sum from v to 0 (canceled entries leave the sums)
    if (overRun.headroom.window_caps[0].used !== String(v)) problems.push('baseline window sum ' + String(overRun.headroom.window_caps[0].used));
    if (canceled.headroom.window_caps[0].used !== '0') problems.push('canceled window sum ' + String(canceled.headroom.window_caps[0].used));
    // rule 5 matches ANY status, including canceled, when the nonce is the authorization's
    const replay = compute(happy([Object.assign({}, entry({ nonce: NONCE_A, value: String(v), signed_at: NOW - 100, validBefore: '1700003600', status: 'canceled' }))], { value: String(v) })).output_payload;
    if (replay.decision !== 'DENY') problems.push('canceled replay decision ' + replay.decision);
    const r5 = replay.reasons.find((r) => r.code === 'NONCE_REUSED');
    if (!r5 || r5.sub_code !== 'NONCE_REUSED_IDENTICAL') problems.push('canceled replay sub_code ' + String(r5 && r5.sub_code));
    if (problems.length) { violations++; console.error('P3 case ' + k + ' (v=' + v + '): ' + problems.join(' | ')); }
  }
  return { name: 'P3_canceled_exclusion_rule5_any_status', checked, violations };
}

// ---------- P4: shape, determinism, refusals ----------
function checkP4ShapeDeterminismRefusals() {
  let checked = 0, violations = 0;
  const fixtures = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', 'art-816-eip3009-agent-spend-gate.fixtures.json'), 'utf8'));
  const problems = [];
  // shape: no NaN/undefined/function ever reaches the payload, across fixtures and randoms
  const inputs = fixtures.vectors.map((v) => v.policy_parameters);
  for (let i = 0; i < 16; i++) {
    const ledger = [];
    for (let j = 0; j < randInt(0, 6); j++) {
      ledger.push(entry({ nonce: nonceSeq(j + 40), value: String(randInt(1, 900)), signed_at: NOW - randInt(5, 4000), status: j % 3 === 0 ? 'signed' : 'settled' }));
    }
    inputs.push(happy(ledger, { value: String(randInt(1, 1500)) }));
  }
  for (const input of inputs) {
    checked++;
    const out = compute(input).output_payload;
    const shapes = findShapeViolations(out);
    if (shapes.length > 0) problems.push('shape ' + JSON.stringify(shapes.slice(0, 3)));
    const again = compute(input).output_payload;
    if (!deepEqual(out, again)) problems.push('nondeterministic payload');
  }
  // structural refusals: wrong shapes are INPUT_REFUSED, decision INDETERMINATE, primary null
  const badInputs = [
    pp(undefined, domain(), policy(), [], NOW),                                    // authorization missing
    pp('nope', domain(), policy(), [], NOW),                                       // authorization not an object
    pp(auth(), domain(), policy(), 'not-an-array', NOW),                           // ledger not an array
    pp(auth(), domain(), policy([Object.assign({})]), [{}, entry()], NOW),         // hmm keep simple below
    pp(auth(), domain(), policy(), [entry({ status: 'returned' })], NOW),          // bad ledger status
    pp(auth(), domain(), policy({ per_tx_cap: 'abc' }), [], NOW),                  // bad cap format
    pp(auth(), domain(), policy(), [], 1.5),                                       // non-integer clock
    Object.assign({}, happy([], {}, {}), { surprise: true }),                      // unknown top-level field
  ];
  // replace the placeholder fourth case with a plain over-bound array
  badInputs[3] = pp(auth(), domain(), policy(), [], -1); // negative clock
  for (const bad of badInputs) {
    checked++;
    const r = compute(bad);
    if (r.output_payload.refusals.length === 0) problems.push('no refusal for ' + JSON.stringify(bad).slice(0, 60));
    if (r.compliance_flags.indexOf('INPUT_REFUSED') < 0) problems.push('missing INPUT_REFUSED flag');
    if (r.output_payload.decision !== 'INDETERMINATE' || r.output_payload.primary_reason !== null) problems.push('refusal decision not INDETERMINATE/null');
  }
  if (problems.length) {
    violations = problems.length;
    for (const p of problems) console.error('P4: ' + p);
  }
  return { name: 'P4_shape_determinism_refusals', checked, violations };
}

// ---------- P5: DENY outranks OVER_LIMIT, both reasons listed ----------
function checkP5Precedence() {
  let checked = 0, violations = 0;
  const denyCauses = [
    { label: 'signer', authOver: { from: STRANGER }, expectCode: 'SIGNER_MISMATCH' },
    { label: 'expired', authOver: { validAfter: '1699999900', validBefore: '1700000050' }, expectCode: 'EXPIRED' },
    { label: 'chain', domainOver: { chain_id: '1' }, expectCode: 'DOMAIN_NOT_ALLOWED' },
    { label: 'payee', authOver: { to: '0x4444444444444444444444444444444444444444' }, expectCode: 'PAYEE_DENIED' },
  ];
  for (let k = 0; k < 12; k++) {
    const cause = denyCauses[k % denyCauses.length];
    const v = randInt(1001, 9000); // strictly over the 1000 per-tx cap
    const overAuth = Object.assign({ value: String(v) }, cause.authOver || {});
    const run = compute(pp(auth(overAuth), domain(cause.domainOver || {}), policy(), [], NOW));
    checked++;
    const problems = [];
    if (run.output_payload.decision !== 'DENY') problems.push('decision ' + run.output_payload.decision);
    const codes = run.output_payload.reasons.map((r) => r.code);
    if (codes.indexOf(cause.expectCode) < 0) problems.push('missing deny code ' + cause.expectCode);
    if (codes.indexOf('OVER_PER_TX_CAP') < 0) problems.push('over-cap reason not co-listed');
    if (!run.output_payload.primary_reason || run.output_payload.primary_reason.code !== cause.expectCode) problems.push('primary is not the DENY code');
    if (run.output_payload.primary_reason && run.output_payload.primary_reason.rule >= 10) problems.push('primary rule index not below the over-limit rule');
    if (problems.length) { violations++; console.error('P5 case ' + k + ' (' + cause.label + '): ' + problems.join(' | ')); }
  }
  return { name: 'P5_deny_outranks_over_limit', checked, violations };
}

// ---------- NC: negative control over the fixture oracle itself ----------
function checkNegativeControl() {
  const fixtures = JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', 'art-816-eip3009-agent-spend-gate.fixtures.json'), 'utf8'));
  const vec = fixtures.vectors.find((v) => v.name === 'F5_rule5_replay_identical');
  const fresh = compute(vec.policy_parameters).output_payload;
  const mutated = Object.assign({}, fresh, { decision: fresh.decision === 'DENY' ? 'SPEND' : 'DENY' });
  const caught = !deepEqual(fresh, mutated);
  return { name: 'NC_mutated_payload_detectable', checked: 1, violations: caught ? 0 : 1 };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1HeadroomAndUnitFlips(),
  await checkP2LedgerOrderIndependence(),
  checkP3CanceledExclusion(),
  checkP4ShapeDeterminismRefusals(),
  checkP5Precedence(),
  checkNegativeControl(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — 13-rule spend gate.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
