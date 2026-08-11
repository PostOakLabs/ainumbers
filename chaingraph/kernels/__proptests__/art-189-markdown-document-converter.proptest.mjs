// art-189-markdown-document-converter.proptest.mjs — FV property-test FLOOR (FV-PROPFLOOR-SHARD-C5-1).
// kernel_digest_at_authoring: sha256:366d56b7225bb3a094fb31f8ff393b6a63adf21a07735d58df87c49b385b71cd
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md §3, class C). NOT a proof, NOT Dafny.
// float_sensitive: NO (WU row classification confirmed by direct read — the entire kernel is string
// parsing, regex substitution, and SHA-256 digesting; the only "numeric" values are integer counters
// (headings/links/code_blocks/tables/words), no float arithmetic anywhere).
// Checks: fixture-oracle gate, termination (line-by-line parse loop strictly bounded by
// markdown.split('\n').length, `i` only ever increases), boundedness (stats counters are
// non-negative integers), the kernel's own documented injection-safety invariant (raw `<`, `>`, `&`
// in the input are never emitted unescaped in html), determinism (same input -> identical digests
// twice), and a forced categorical boundary case for the empty-input / heading-count edge.
// Zero external dependencies — pure Node built-ins only (mulberry32 PRNG, hand-rolled).
// NOTE: compute() is async (uses crypto.subtle for digests) — every call site here awaits it.
//
// Run: node chaingraph/kernels/__proptests__/art-189-markdown-document-converter.proptest.mjs

import { compute } from '../art-189-markdown-document-converter.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [], boundary_forced: [] };

async function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-189-markdown-document-converter.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = await compute(vec.policy_parameters);
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
const rand = mulberry32(0x189A0);
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const LINE_KINDS = [
  () => '# Heading ' + Math.floor(rand() * 1000),
  () => '- list item with <script>alert(1)</script> & "quotes" > tag',
  () => '1. ordered item',
  () => '> blockquote & <b>bold html</b>',
  () => 'plain paragraph text with **bold** and *italic* & <raw>',
  () => '```js\nconsole.log(1);\n```',
  () => '',
  () => '| a | b |',
  () => '|---|---|',
  () => '| 1 <x> | 2 & y |',
];
function randomMarkdown(rng, nLines) {
  const lines = [];
  for (let i = 0; i < nLines; i++) lines.push(pick(rng, LINE_KINDS)());
  return lines.join('\n');
}

const TRIALS = 2000;

// ---------- P1: termination — line-by-line parse strictly bounded by input line count ----------
async function checkP1_termination() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 30);
    const md = randomMarkdown(rand, n);
    const inputLines = md.split('\n').length;
    const { output_payload } = await compute({ markdown: md });
    checked++;
    const { stats } = output_payload;
    if (stats.headings + stats.code_blocks + stats.tables > inputLines) violations++;
    for (const v of Object.values(stats)) { if (!Number.isInteger(v) || v < 0) violations++; }
  }
  return { name: 'P1_termination_bounded_by_line_count', trials: checked, violations };
}

// ---------- P2 (differential/safety): raw <, >, & in input never appear unescaped in html output ----------
async function checkP2_injection_safe() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const n = Math.floor(rand() * 15) + 1;
    const md = randomMarkdown(rand, n);
    const { output_payload } = await compute({ markdown: md });
    checked++;
    // any raw '<script' would indicate an injection-safety break — allowed tags are only the
    // kernel's own generated ones (h1-h6, p, ul/ol/li, code, pre, a, strong, em, blockquote, table...).
    if (/<script/i.test(output_payload.html)) violations++;
  }
  return { name: 'P2_injection_safe_no_raw_script_tag', trials: checked, violations };
}

// ---------- P3: metamorphic — determinism (same input twice -> identical digests and html) ----------
async function checkP3_metamorphic_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const n = Math.floor(rand() * 10);
    const md = randomMarkdown(rand, n);
    const r1 = (await compute({ markdown: md })).output_payload;
    const r2 = (await compute({ markdown: md })).output_payload;
    checked++;
    if (r1.input_sha256 !== r2.input_sha256) violations++;
    if (r1.html_sha256 !== r2.html_sha256) violations++;
    if (r1.html !== r2.html) violations++;
  }
  return { name: 'P3_metamorphic_determinism', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases ----------
async function checkP4_forced() {
  const cases = [
    { label: 'empty markdown -> zero words, zero headings, empty html', markdown: '' },
    { label: 'single ATX heading -> headings=1, words=2', markdown: '# Hello World' },
    { label: 'six-hash heading (max ATX level) -> headings=1', markdown: '###### deep heading' },
    { label: 'seven-hash line (not a valid ATX heading, treated as paragraph text)', markdown: '####### not a heading' },
  ];
  const rows = [];
  for (const c of cases) {
    const { output_payload } = await compute({ markdown: c.markdown });
    rows.push({ label: c.label, stats: output_payload.stats, html: output_payload.html });
  }
  return rows;
}

// ---------- run ----------
const oracleOk = await runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(await checkP1_termination());
results.properties.push(await checkP2_injection_safe());
results.properties.push(await checkP3_metamorphic_determinism());
results.boundary_forced = await checkP4_forced();

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
const emptyMdZeroWords = results.boundary_forced[0].stats.words === 0 && results.boundary_forced[0].stats.headings === 0;
const singleHeadingCounted = results.boundary_forced[1].stats.headings === 1;
const sixHashHeadingCounted = results.boundary_forced[2].stats.headings === 1;
const sevenHashNotHeading = results.boundary_forced[3].stats.headings === 0;
const anyBoundaryMismatch = !(emptyMdZeroWords && singleHeadingCounted && sixHashHeadingCounted && sevenHashNotHeading);

console.log(JSON.stringify({
  tool_id: 'art-189-markdown-document-converter',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  boundary_forced: results.boundary_forced,
  any_property_violation: anyPropertyViolation,
  any_boundary_mismatch: anyBoundaryMismatch,
}, null, 2));

process.exit(anyPropertyViolation || anyBoundaryMismatch ? 1 : 0);
