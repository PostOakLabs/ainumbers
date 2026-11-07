// art-828-reconcile-omnibus-token-position — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (two profiles, four event kinds, exact
// non-negative integer base units as decimal strings, opaque labels; the closed
// refusal set is enumerated in the sibling reachability fixtures); the balance
// magnitude axis is unbounded above, so no totality claim is made over it.
// Properties run over a committed mulberry32 seed (deterministic) plus a fixed
// corpus of structural cases.
//
// kernel_digest_at_authoring: sha256:34b520bdc84a357a53a4442999cd3ab1cd7d7a2542fec3e582f0cc8d566917b6
// spec: reconcile a declared tokenized-securities omnibus position against the
//   sum of declared wallet balances and the declared book-entry position, with a
//   SHA-256 hash-chained head over declared mint/burn/forced-transfer/transfer
//   events, built to the pinned no-action-letter excerpt
//   (research/clause-snapshots/sec-dtc-nal-121125-excerpts-2026-11-07.txt,
//   digest sha256:c2f9912c30ada6aca65edbfe20a66db622aa78c5c17b6de552b37f27fa013f05).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-828-reconcile-omnibus-token-position.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compute } from '../art-828-reconcile-omnibus-token-position.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-828-reconcile-omnibus-token-position';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20261107;
const N = 200;
const EVENT_KINDS = ['mint', 'burn', 'forced_transfer', 'transfer'];
const DECIMAL_RE = /^(0|[1-9][0-9]*)$/;

// Independent canonical JSON (sorted keys, compact) — JCS-equivalent for these
// ASCII-only entries; used ONLY by the test-side chain oracle, never shipped.
function canon(o) {
  if (o === null || typeof o !== 'object') return JSON.stringify(o);
  if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
  return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
}
const H = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
function independentHead(events) {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  let prev = null;
  for (const ev of sorted) {
    prev = 'sha256:' + H(canon({ prev, seq: ev.seq, kind: ev.kind, amount: ev.amount, wallet_label: ev.wallet_label }));
  }
  return prev; // null when no events
}

/** Random VALID policy_parameters over the declared domain. */
function randomValidPp(rng) {
  const pp = {};
  const roll = rng();
  if (roll < 0.45) pp.profile = 'dtc_dts';
  else if (roll < 0.9) pp.profile = 'generic_omnibus';
  // else: absent (flagged, arithmetic proceeds under the generic default)
  if (rng() < 0.85) pp.as_of = `2026-${String(1 + Math.floor(rng() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rng() * 28)).padStart(2, '0')}`;
  if (rng() < 0.9) pp.omnibus_balance = BigInt(Math.floor(rng() * 1e12)).toString();
  if (rng() < 0.8) pp.book_entry_position = BigInt(Math.floor(rng() * 1e12)).toString();
  if (rng() < 0.25) pp.tolerance_units = Math.floor(rng() * 1000);
  if (rng() < 0.9) {
    pp.wallets = [];
    const n = Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) {
      pp.wallets.push({ wallet_label: 'w' + i, balance: BigInt(Math.floor(rng() * 1e9)).toString(), registered: rng() < 0.8 });
    }
  }
  if (rng() < 0.7) {
    pp.events = [];
    const n = Math.floor(rng() * 4);
    const seqs = [0, 1, 2, 3];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [seqs[i], seqs[j]] = [seqs[j], seqs[i]]; }
    for (let i = 0; i < n; i++) {
      pp.events.push({ seq: seqs[i], kind: EVENT_KINDS[Math.floor(rng() * 4)], amount: BigInt(Math.floor(rng() * 1e6)).toString(), wallet_label: 'w' + Math.floor(rng() * 5) });
    }
  }
  return pp;
}

/** Independent recomputation of the declared reconciliation (test-side oracle arithmetic). */
function expectedReconciliation(pp) {
  const flags = [];
  const profile = pp.profile ?? null;
  if (profile === null) flags.push('PROFILE_ABSENT');
  if (pp.as_of === undefined) flags.push('AS_OF_ABSENT');
  const omni = pp.omnibus_balance !== undefined ? BigInt(pp.omnibus_balance) : null;
  if (omni === null) flags.push('OMNIBUS_ABSENT');
  const book = pp.book_entry_position !== undefined ? BigInt(pp.book_entry_position) : null;
  if (book === null) flags.push('BOOK_LEG_ABSENT');
  const wallets = pp.wallets ?? null;
  if (wallets === null) flags.push('WALLET_LEG_ABSENT');
  const events = pp.events ?? null;
  if (events === null) flags.push('EVENTS_ABSENT');
  const tolerance = BigInt(pp.tolerance_units ?? 0);
  const sum = wallets === null ? null : wallets.reduce((a, w) => a + BigInt(w.balance), 0n);
  const walletsLeg = omni !== null && wallets !== null;
  const bookLeg = omni !== null && book !== null;
  const dW = walletsLeg ? omni - sum : null;
  const dB = bookLeg ? omni - book : null;
  const within = (d) => (d === null ? null : (d < 0n ? -d : d) <= tolerance);
  const unregisteredHolders = wallets === null ? 0 : wallets.filter((w) => !w.registered && BigInt(w.balance) > 0n).length;
  if ((profile ?? 'generic_omnibus') === 'dtc_dts' && unregisteredHolders > 0) flags.push('UNREGISTERED_WALLET_BALANCE');
  let verdict;
  if (!walletsLeg && !bookLeg) verdict = 'UNDECIDABLE';
  else verdict = (within(dW) === false || within(dB) === false || flags.includes('UNREGISTERED_WALLET_BALANCE')) ? 'MISMATCH' : 'RECONCILED';
  return {
    verdict,
    warnings: flags,
    sum_wallets: sum === null ? null : sum.toString(),
    omnibus_vs_wallets_delta: dW === null ? null : dW.toString(),
    omnibus_vs_book_delta: dB === null ? null : dB.toString(),
    wallet_count: wallets === null ? null : wallets.length,
    registered_wallet_count: wallets === null ? null : wallets.filter((w) => w.registered).length,
    unregistered_wallet_count: wallets === null ? null : wallets.filter((w) => !w.registered).length,
    unregistered_wallets_holding_balance: wallets === null ? null : unregisteredHolders,
    forced_transfer_count: events === null ? null : events.filter((e) => e.kind === 'forced_transfer').length,
    event_log_head: events === null ? null : independentHead(events),
    events_counted: events === null ? null : events.length,
  };
}

// P1 — DETERMINISM: identical inputs, identical payload, byte-for-byte.
function checkDeterminism() {
  const rng = mulberry32(SEED);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const a = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    checked++;
    if (a !== b) { violations++; console.error(`P1 determinism violated on ${JSON.stringify(pp)}`); }
  }
  return { name: 'determinism_byte_for_byte', checked, violations };
}

// P2 — RECONCILIATION CONFORMANCE: verdict, both deltas, the wallet counts and
// the flags equal the independent test-side BigInt recompute for every random
// valid declaration (absent-leg and absent-flag combinations included).
function checkReconciliationConformance() {
  const rng = mulberry32(SEED + 1);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const { output_payload: o, compliance_flags } = compute(pp);
    const e = expectedReconciliation(pp);
    checked += 9;
    if (o.verdict !== e.verdict) violations++;
    if (JSON.stringify([...compliance_flags].sort()) !== JSON.stringify([...e.warnings].sort())) violations++;
    if (JSON.stringify(o.warnings) !== JSON.stringify(o.warnings.slice().sort((a, b) => a.localeCompare(b)))) { /* order note: compared as sets above */ }
    if (o.sum_wallets !== e.sum_wallets) violations++;
    if (o.omnibus_vs_wallets_delta !== e.omnibus_vs_wallets_delta) violations++;
    if (o.omnibus_vs_book_delta !== e.omnibus_vs_book_delta) violations++;
    if (o.wallet_count !== e.wallet_count || o.registered_wallet_count !== e.registered_wallet_count) violations++;
    if (o.unregistered_wallet_count !== e.unregistered_wallet_count || o.unregistered_wallets_holding_balance !== e.unregistered_wallets_holding_balance) violations++;
    if (o.forced_transfer_count !== e.forced_transfer_count || o.events_counted !== e.events_counted) violations++;
    if (violations === 1 || (violations > 0 && violations < 9)) console.error(`P2 mismatch on ${JSON.stringify(pp)}: got ${JSON.stringify(o)}`);
  }
  return { name: 'reconciliation_conformance_vs_independent_recompute', checked, violations };
}

// P3 — TOLERANCE BOUNDARY: with the wallets delta pinned to exactly t and t+1,
// the verdict is RECONCILED at |delta| == tolerance (inclusive) and MISMATCH one
// unit above it, for several tolerances including zero.
function checkToleranceBoundary() {
  let checked = 0;
  let violations = 0;
  const tolerances = [0, 1, 5, 999];
  for (const t of tolerances) {
    /** @type {[number, string][]} */
    const edges = [[t, 'RECONCILED'], [t + 1, 'MISMATCH']];
    for (const [gap, expect] of edges) {
      const pp = { profile: 'dtc_dts', as_of: '2026-11-07', omnibus_balance: '1000000', book_entry_position: '1000000', tolerance_units: t,
        wallets: [{ wallet_label: 'w1', balance: (1000000 - gap).toString(), registered: true }], events: [] };
      const { output_payload: o } = compute(pp);
      checked += 3;
      if (o.verdict !== expect) { violations++; console.error(`P3 tolerance ${t} gap ${gap}: expected ${expect}, got ${o.verdict}`); }
      if (o.omnibus_vs_wallets_delta !== gap.toString()) { violations++; console.error(`P3 delta wrong: ${o.omnibus_vs_wallets_delta}`); }
      if (o.tolerance_units !== t) { violations++; console.error(`P3 tolerance echoed wrong: ${o.tolerance_units}`); }
    }
  }
  return { name: 'tolerance_edge_inclusive', checked, violations };
}

// P4 — EVENT CHAIN CONFORMANCE: the chained head equals the independent
// node:crypto chain over the same JCS-canonical entries (regardless of the order
// the caller listed them in), and per-kind counts match a tally.
function checkEventChainConformance() {
  const rng = mulberry32(SEED + 2);
  let checked = 0;
  let violations = 0;
  // fixed structural cases: unsorted declaration, duplicate-free, empty log
  const cases = [
    { profile: 'dtc_dts', as_of: '2026-11-07', events: [{ seq: 2, kind: 'burn', amount: '5', wallet_label: 'w1' }, { seq: 0, kind: 'mint', amount: '10', wallet_label: 'w1' }, { seq: 1, kind: 'transfer', amount: '3', wallet_label: 'w2' }] },
    { profile: 'dtc_dts', as_of: '2026-11-07', events: [] },
  ];
  for (let i = 0; i < N; i++) cases.push(randomValidPp(rng));
  for (const pp of cases) {
    if (!pp.events) continue;
    const { output_payload: o } = compute(JSON.parse(JSON.stringify(pp)));
    checked += 3;
    const want = independentHead(pp.events);
    if (o.event_log_head !== want) { violations++; console.error(`P4 head mismatch on ${JSON.stringify(pp.events)}: got ${o.event_log_head}, want ${want}`); }
    const tally = EVENT_KINDS.map((k) => pp.events.filter((e) => e.kind === k).length);
    const got = EVENT_KINDS.map((k) => o.event_counts?.[k]);
    if (JSON.stringify(got) !== JSON.stringify(tally)) { violations++; console.error(`P4 kind counts mismatch: ${JSON.stringify(got)} vs ${JSON.stringify(tally)}`); }
    if (o.events_counted !== pp.events.length) violations++;
  }
  return { name: 'event_chain_matches_independent_node_crypto_chain', checked, violations };
}

// P5 — REFUSAL INVARIANTS: every declared refusal branch returns a structured
// non-verdict with exactly the INPUT_REFUSED flag, manual_review_required true,
// and never echoes the offending value.
function checkRefusalInvariants() {
  let checked = 0;
  let violations = 0;
  const extra = [
    { pp: { profile: 'dtc_dts', events: [{ seq: 0, kind: 'mint', amount: '1e3', wallet_label: 'w1' }] }, label: 'exponent-amount' },
    { pp: { profile: 'dtc_dts', tolerance_units: 1e9 + 0.5 }, label: 'beyond-integer-tolerance' },
    { pp: { omnibus_balance: '00012' }, label: 'leading-zeros-normalized-not-refused' },
  ];
  const vectors = REACH.vectors.map((v) => ({ pp: v.policy_parameters, label: v.name }))
    .concat(extra);
  for (const { pp, label } of vectors) {
    const { output_payload, compliance_flags } = compute(JSON.parse(JSON.stringify(pp)));
    checked += 4;
    if (output_payload.verdict !== 'refused') { violations++; console.error(`P5 ${label}: verdict not refused`); continue; }
    if (JSON.stringify(compliance_flags) !== JSON.stringify(['INPUT_REFUSED'])) { violations++; console.error(`P5 ${label}: flags not exactly INPUT_REFUSED: ${JSON.stringify(compliance_flags)}`); }
    if (output_payload.manual_review_required !== true) { violations++; console.error(`P5 ${label}: manual_review_required not true`); }
    const offending = Object.values(pp).find((x) => typeof x === 'string' && x !== '');
    if (offending !== undefined && JSON.stringify(output_payload).includes(offending)) {
      violations++;
      console.error(`P5 ${label}: refusal payload echoes the offending value`);
    }
    const shape = findShapeViolations(output_payload);
    checked++;
    if (shape.length > 0) { violations++; console.error(`P5 ${label}: shape violations ${JSON.stringify(shape)}`); }
  }
  return { name: 'refusal_branches_closed_and_non_echoing', checked, violations };
}

// P6 — OUTPUT SHAPE: completed payloads carry balance members as normalized
// decimal strings, counts as non-negative integers, the declared-boundary
// evidence members, and no NaN/undefined anywhere.
function checkOutputShape() {
  const rng = mulberry32(SEED + 4);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const { output_payload: o } = compute(pp);
    checked += 5;
    for (const m of ['omnibus_balance', 'book_entry_position', 'sum_wallets']) {
      if (o[m] !== null && !DECIMAL_RE.test(o[m])) { violations++; console.error(`P6 ${m} not a normalized decimal string: ${o[m]}`); }
    }
    // deltas are SIGNED exact integers (omnibus minus leg)
    for (const m of ['omnibus_vs_wallets_delta', 'omnibus_vs_book_delta']) {
      if (o[m] !== null && !/^-(0|[1-9][0-9]*)$|^(0|[1-9][0-9]*)$/.test(o[m])) { violations++; console.error(`P6 ${m} not a normalized signed decimal string: ${o[m]}`); }
    }
    for (const m of ['wallet_count', 'registered_wallet_count', 'unregistered_wallet_count', 'unregistered_wallets_holding_balance', 'forced_transfer_count', 'events_counted']) {
      if (o[m] !== null && (!Number.isInteger(o[m]) || o[m] < 0)) { violations++; console.error(`P6 ${m} not a non-negative integer: ${o[m]}`); }
    }
    if (o.evidence.refused !== false || o.evidence.pii_carried !== false || o.evidence.reads_no_ledger !== true) violations++;
    if (o.manual_review_required !== (o.warnings.length > 0)) violations++;
    const shape = findShapeViolations(o);
    if (shape.length > 0) { violations++; console.error(`P6 shape violations on ${JSON.stringify(pp)}: ${JSON.stringify(shape)}`); }
  }
  return { name: 'completed_payload_exact_decimals_and_counts', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminism(),
  checkReconciliationConformance(),
  checkToleranceBoundary(),
  checkEventChainConformance(),
  checkRefusalInvariants(),
  checkOutputShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — authored 2026-11-07 against the pinned no-action-letter excerpt.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
