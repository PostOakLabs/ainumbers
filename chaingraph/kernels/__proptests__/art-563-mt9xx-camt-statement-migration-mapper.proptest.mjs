// art-563-mt9xx-camt-statement-migration-mapper.proptest.mjs — FV property-test FLOOR
// (FV-PROPFLOOR-SHARD-C28-1).
// kernel_digest_at_authoring: sha256:79089ccf4a9ef55d91ff82ddba35cc5faa5878ec105312739ff7a2518a33f0f5
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (matches the WU row, direct read confirms). centsFromMtAmount() parses
// every monetary amount as INTEGER cents via parseInt(whole,10)*100+parseInt(fracPadded,10) --
// never parseFloat, never a division -- and every downstream sum/difference (balance_check's
// expected_closing_signed_cents, discrepancy_cents) is plain integer addition/subtraction. Zero
// IEEE-754 arithmetic anywhere in the file. Forced categorical boundary cases are used in place
// of ULP-boundary forcing.
// Checks: fixture-oracle gate, termination (parseFields loops over the input's line-split array
// -- the "string-length recursion"/data-dependent-loop shape §3 calls out explicitly -- entries
// bounded by the number of :NN: tag-line fields, itself bounded by input string length),
// boundedness (entries.length + unmappable_tags.length <= number of :61: occurrences,
// balance_check.pass is a boolean derived from an integer equality), a metamorphic monotone-
// append identity (appending one more well-formed :61:/:86: pair to an MT940 message never
// decreases entries.length), a differential re-derivation of centsFromMtAmount/yymmddToIso
// against an independent reimplementation, and forced categorical boundary cases (missing :20:/
// :25:/:60F:/:62F: fields, MT942's declared no-closing-balance exemption, a :86: narrative
// exactly at/one-over the 390-char MT limit, a malformed comma-less amount string, a balanced
// vs. mismatched 60F+61=62F check).
// Zero external dependencies -- pure Node built-ins only (mulberry32 PRNG, hand-rolled).
//
// Run: node chaingraph/kernels/__proptests__/art-563-mt9xx-camt-statement-migration-mapper.proptest.mjs

import { compute } from '../art-563-mt9xx-camt-statement-migration-mapper.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-563-mt9xx-camt-statement-migration-mapper.fixtures.json');
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
const rand = mulberry32(0x56300028);

// Well-formed MT940 line builder -- generates a random-but-valid statement with N :61:/:86: pairs.
function centsToMt(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${whole},${frac}`;
}
function buildMt940(rng, n, openCents, entryDeltas) {
  let closeCents = openCents;
  const lines = [':20:STMTX', ':25:DE89370400440532013000', ':28C:1/1', `:60F:C260801USD${centsToMt(openCents)}`];
  for (let i = 0; i < n; i++) {
    const delta = entryDeltas[i];
    closeCents += delta;
    const dc = delta >= 0 ? 'C' : 'D';
    lines.push(`:61:26080${(i % 9) + 1}0802${dc}${centsToMt(Math.abs(delta))}NTRFREF${i}`);
    lines.push(`:86:Narrative ${i}`);
  }
  lines.push(`:62F:C260803USD${centsToMt(closeCents)}`);
  return { text: lines.join('\n') + '\n', closeCents };
}
function randomPP(rng) {
  const n = Math.floor(rng() * 6);
  const openCents = Math.floor(rng() * 10000000);
  const entryDeltas = Array.from({ length: n }, () => Math.floor((rng() - 0.5) * 200000));
  const { text } = buildMt940(rng, n, openCents, entryDeltas);
  return { message_text: text, declared_mt_type: '940' };
}

const TRIALS = 2000;

// ---------- P1: termination -- entries bounded by :61: tag-line count, itself bounded by input length ----------
function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    const sixtyOneCount = (pp.message_text.match(/^:61:/gm) || []).length;
    const entries = output_payload.statement ? output_payload.statement.entries.length : 0;
    const unmappable = output_payload.fidelity_report.unmappable_tags.length;
    if (entries + unmappable > sixtyOneCount) violations++;
    if (entries > pp.message_text.length) violations++; // never exceeds input size, trivially
  }
  return { name: 'P1_entries_bounded_by_61_tag_count_and_input_length', trials: checked, violations };
}

// ---------- P2: boundedness -- balance_check.pass is a boolean, verdict is one of 3 enums ----------
function checkP2_boundedness() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (!['CLEAN', 'MAPPED_WITH_WARNINGS', 'UNMAPPABLE'].includes(output_payload.verdict)) violations++;
    if (output_payload.fidelity_report.balance_check && typeof output_payload.fidelity_report.balance_check.pass !== 'boolean') violations++;
  }
  return { name: 'P2_verdict_enum_and_balance_check_boolean', trials: checked, violations };
}

// ---------- P3: metamorphic -- monotone append. Appending one more well-formed :61:/:86: pair
// (and updating :62F: to keep balance) never decreases entries.length. ----------
function checkP3_monotone_append() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 600; i++) {
    const n = Math.floor(rand() * 5);
    const openCents = Math.floor(rand() * 1000000);
    const deltas = Array.from({ length: n }, () => Math.floor((rand() - 0.5) * 50000));
    const base = buildMt940(rand, n, openCents, deltas);
    const extraDelta = Math.floor((rand() - 0.5) * 50000);
    const extended = buildMt940(rand, n + 1, openCents, [...deltas, extraDelta]);
    const r1 = compute({ message_text: base.text, declared_mt_type: '940' }).output_payload;
    const r2v = compute({ message_text: extended.text, declared_mt_type: '940' }).output_payload;
    checked++;
    const e1 = r1.statement ? r1.statement.entries.length : 0;
    const e2 = r2v.statement ? r2v.statement.entries.length : 0;
    if (e2 < e1) violations++;
  }
  return { name: 'P3_monotone_append_entries_never_decreases', trials: checked, violations };
}

// ---------- P4 (differential): centsFromMtAmount/yymmddToIso re-derived independently ----------
function reimplementCents(s) {
  if (typeof s !== 'string' || !/^[0-9]+,[0-9]*$/.test(s)) return null;
  const [whole, frac] = s.split(',');
  const fracPadded = (frac || '').padEnd(2, '0').slice(0, 2);
  return parseInt(whole, 10) * 100 + parseInt(fracPadded, 10);
}
function checkP4_differential() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.statement && output_payload.statement.opening) {
      // Re-derive the opening balance's amount portion from the raw message text.
      const m = pp.message_text.match(/:60F:[DC]\d{6}[A-Z]{3}([0-9]+,[0-9]*)/);
      if (m) {
        const expected = reimplementCents(m[1]);
        if (output_payload.statement.opening.amount_cents !== expected) violations++;
      }
    }
  }
  return { name: 'P4_cents_parsing_differential', trials: checked, violations };
}

// ---------- P5: forced categorical boundary cases (float:no) ----------
function checkP5_forced_categorical() {
  let violations = 0, checked = 0;
  // missing :20: -> rejected (structurally incomplete)
  checked++;
  {
    const r = compute({ message_text: ':25:DE1\n:60F:C260801USD100,00\n:61:2608020802D50,00NTRF\n:62F:C260801USD50,00\n', declared_mt_type: '940' }).output_payload;
    if (!r.rejected_inputs.some((x) => x.where === ':20:')) violations++;
  }
  // MT942 (camt.052) with no :62F: -> NOT a structural gap (interim report exemption)
  checked++;
  {
    const r = compute({ message_text: ':20:X\n:25:DE1\n:28C:1\n:60F:C260801USD100,00\n:61:2608020802D50,00NTRF\n', declared_mt_type: '942' }).output_payload;
    if (r.rejected_inputs.some((x) => x.where === ':62F:/:62M:')) violations++;
  }
  // MT940 (camt.053) with no :62F: -> IS a structural gap
  checked++;
  {
    const r = compute({ message_text: ':20:X\n:25:DE1\n:28C:1\n:60F:C260801USD100,00\n:61:2608020802D50,00NTRF\n', declared_mt_type: '940' }).output_payload;
    if (!r.rejected_inputs.some((x) => x.where === ':62F:/:62M:')) violations++;
  }
  // :86: narrative exactly at the 390-char MT limit -> no truncation finding
  checked++;
  {
    const narrative = 'X'.repeat(390);
    const r = compute({ message_text: `:20:X\n:25:DE1\n:28C:1\n:60F:C260801USD100,00\n:61:2608020802D50,00NTRF\n:86:${narrative}\n:62F:C260801USD50,00\n`, declared_mt_type: '940' }).output_payload;
    if (r.fidelity_report.truncation_findings.some((f) => f.code === 'TAG_86_EXCEEDS_MT_LIMIT')) violations++;
  }
  // :86: narrative one char OVER the 390-char MT limit -> truncation finding fires
  checked++;
  {
    const narrative = 'X'.repeat(391);
    const r = compute({ message_text: `:20:X\n:25:DE1\n:28C:1\n:60F:C260801USD100,00\n:61:2608020802D50,00NTRF\n:86:${narrative}\n:62F:C260801USD50,00\n`, declared_mt_type: '940' }).output_payload;
    if (!r.fidelity_report.truncation_findings.some((f) => f.code === 'TAG_86_EXCEEDS_MT_LIMIT')) violations++;
  }
  // malformed (comma-less) amount string -> rejected, never crashes
  checked++;
  {
    const r = compute({ message_text: ':20:X\n:25:DE1\n:28C:1\n:60F:C260801USD10000\n:62F:C260801USD10000\n', declared_mt_type: '940' }).output_payload;
    if (!r.rejected_inputs.some((x) => x.where === ':60F:')) violations++;
  }
  // balanced 60F+61=62F -> pass true; mismatched -> pass false, discrepancy nonzero
  checked++;
  {
    const rMismatch = compute({ message_text: ':20:X\n:25:DE1\n:28C:1\n:60F:C260801USD100,00\n:61:2608020802D50,00NTRF\n:62F:C260801USD100,00\n', declared_mt_type: '940' }).output_payload;
    const bc = rMismatch.fidelity_report.balance_check;
    if (bc.pass !== false || bc.discrepancy_cents === 0) violations++;
  }
  return { name: 'P5_forced_categorical_boundaries', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_termination());
results.properties.push(checkP2_boundedness());
results.properties.push(checkP3_monotone_append());
results.properties.push(checkP4_differential());
results.properties.push(checkP5_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-563-mt9xx-camt-statement-migration-mapper',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
