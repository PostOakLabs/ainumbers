/**
 * scripts/validate-policy-mandate.test.mjs — paired self-test and DIFFERENTIAL
 * additivity gate for the Policy Mandate v1.1 validator (MANDATE-V11-CAVEATS-1,
 * SO #34c: "a checker that cannot be shown red proves nothing").
 *
 * ── WHY THIS IS DIFFERENTIAL AND NOT A FIXTURE COMPARISON ─────────────────
 * The row's central claim is "every existing v1.0 export still validates,
 * unchanged, forever". A test that hand-wrote one document and asserted it
 * passes would prove nothing about that claim: the fixture author picks the
 * document, so the test can only ever confirm its own author's assumptions.
 *
 * So the ORACLE here is not a fixture. It is the SHIPPED `AP2Schema` object,
 * lifted out of a tracked tool page at run time by brace-matched extraction,
 * and the documents are produced by that same shipped code's own `build()`.
 * The property under test is an implication over the whole corpus:
 *
 *     shipped v1.0 validator ACCEPTS doc  ⇒  v1.1 validator ACCEPTS doc
 *
 * A counterexample is a broken row, not a failed assertion. Because the source
 * is re-read from the tree on every run, the gate cannot go stale the way a
 * committed fixture would (SO #34: recompute from the primary source).
 *
 * ── SECURITY POSTURE (SO #34's non-optional rider) ────────────────────────
 * The shipped object literal is evaluated with `vm.runInNewContext` in a
 * context with NO `require`, NO `process`, NO `fs`, NO network, and a 2s
 * timeout. The input is repo-tracked source under `tools/`, already covered by
 * the JS-syntax gate, never an untrusted artifact and never an artifact making
 * a claim about itself. `AP2Schema`'s object literal touches no host API at
 * definition time; `download()` (the only DOM-touching member) is never called.
 *
 * ── OBSERVED, NOT FIXED: the export sites are inconsistent with §3.1 ──────
 * `AP2Schema.build()` does not emit a top-level `mandate_type`, and the T01
 * export site puts `mandate_type` inside `payload` instead, so the shipped
 * `validate()` would reject T01's own mandate. That is a real defect in the
 * exporter estate and the same family as the audit's FB-03. It is OUT OF THIS
 * ROW'S FENCE (zero exporter tools edited), so this test lifts the field to
 * the top level where §3.1 puts it, and says so here rather than silently
 * papering over it.
 *
 * Run: node scripts/validate-policy-mandate.test.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { validate, carryCaveats, VERSION, CAVEATS_MEMBER } from './validate-policy-mandate.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORACLE_PAGE = 'tools/01-a2a-fee-route-optimizer.html';

let pass = 0;
let fail = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    failures.push(`${name}\n      ${e.message}`);
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log(`validate-policy-mandate.test.mjs (validator version ${VERSION})`);

// ── Extract the shipped AP2Schema object literal ──────────────────────────
// Brace-matched from the `{` that opens the literal. Every brace inside the
// literal is balanced (regex quantifiers `{8}`, `${...}` template holes), so a
// depth count is exact here; the sentinel assertion below is what would catch
// it if a future edit made that untrue.
function extractShippedSchema(html) {
  const anchor = html.indexOf('const AP2Schema = {');
  if (anchor === -1) throw new Error(`no "const AP2Schema = {" in ${ORACLE_PAGE}`);
  const open = html.indexOf('{', anchor);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) return html.slice(anchor, i + 1);
    }
  }
  throw new Error('unbalanced braces while extracting the shipped AP2Schema literal');
}

const oracleHtml = readFileSync(resolve(REPO, ORACLE_PAGE), 'utf8');
const schemaSrc = extractShippedSchema(oracleHtml);

const FIXED_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const sandbox = Object.create(null);
sandbox.crypto = { randomUUID: () => FIXED_UUID };
sandbox.console = { warn() {} };
const shipped = runInNewContext(`${schemaSrc};\nAP2Schema;`, sandbox, { timeout: 2000 });

test('ORACLE - the shipped AP2Schema extracted from the tracked page is usable', () => {
  assert(schemaSrc.includes('validate:'), 'extracted literal must contain the shipped validate()');
  assert(schemaSrc.includes('_fail(\'missing required field: mandate_type\')'),
    'sentinel: the extracted span must reach the shipped mandate_type rule (brace matching cut short?)');
  assert(typeof shipped.validate === 'function', 'shipped.validate must be a function');
  assert(typeof shipped.build === 'function', 'shipped.build must be a function');
});

const oracleAccepts = (doc) => {
  try { shipped.validate(doc); return true; } catch { return false; }
};

// ── The corpus: documents produced by the SHIPPED build(), plus variants ──
// `mandate_type` is lifted to the top level (see the header note on the T01
// export-site defect); everything else is shipped output, untouched.
const shippedBase = {
  ...shipped.build('T01', 'a2a-fee-calculator',
    { mandate_type: 'a2a_route_recommendation', best_rail: 'RTP', annual_savings: '$120,000' },
    { volume: '1000', avgTxn: '450', cardRate: '2.9' }),
  mandate_type: 'routing_policy',
};

const CAVEAT_TEXT = [
  'Estimates assume list pricing; negotiated interchange is not modelled.',
  'Scheme fee schedules are as published 2024 and are not re-verified at run time.',
];

const corpus = [
  ['shipped build() output, mandate_type lifted to top level', shippedBase],
  ['shipped output + caveats (the v1.1 shape)', { ...shippedBase, caveats: CAVEAT_TEXT }],
  ['shipped output + empty caveats array', { ...shippedBase, caveats: [] }],
  ['shipped output with a composed (non-UUID) mandate_id, the T152/T05 family shape',
    { ...shippedBase, mandate_id: '152-baas-provider-comparator-2026-08-30T00-00-00' }],
  ['shipped output with the §3.1 optional members populated',
    { ...shippedBase, jurisdiction: ['GB', 'US'], regulatory_frameworks: [], regulatory_citations: ['NACHA Operating Rules'],
      agent_instructions: ['Review before applying.'], summary: 'A2A route recommendation.',
      issued_at: '2026-08-30T00:00:00Z', valid_from: '2026-08-30',
      audit_metadata: { client_side_executed: true, zero_pii_verified: true, deterministic_run: true } }],
  ['minimal document: identity + mandate_type only', { tool_id: 'T01', mandate_type: 'compliance_control' }],
];

// ── 1. THE ADDITIVITY IMPLICATION, over the whole corpus ──────────────────
test('ADDITIVITY - every document the SHIPPED v1.0 validator accepts is accepted by v1.1', () => {
  const counterexamples = [];
  let acceptedByOracle = 0;
  for (const [label, doc] of corpus) {
    if (!oracleAccepts(doc)) continue;
    acceptedByOracle++;
    const r = validate(doc);
    if (!r.valid) counterexamples.push(`${label} -> v1.1 errors: ${r.errors.join('; ')}`);
  }
  // Anti-vacuity: an implication over an empty set is trivially true, which is
  // exactly how this gate would go silently green if extraction broke.
  assert(acceptedByOracle >= 4,
    `the oracle must accept at least 4 corpus documents or this test is vacuous, accepted ${acceptedByOracle}`);
  assert(counterexamples.length === 0,
    `v1.1 REJECTED a document the shipped v1.0 validator accepts (the row's central guarantee is broken):\n      ${counterexamples.join('\n      ')}`);
});

// ── 2. FORWARD COMPATIBILITY - v1.1 documents survive a v1.0 validator ────
// The shipped validators have no additionalProperties rule, so a document
// carrying `caveats` still passes them. This is what lets an adopting exporter
// emit v1.1 without waiting for every consumer to upgrade.
test('FORWARD-COMPAT - a v1.1 document with caveats is still accepted by the SHIPPED v1.0 validator', () => {
  assert(oracleAccepts({ ...shippedBase, caveats: CAVEAT_TEXT }),
    'the shipped v1.0 validator rejected a v1.1 document; the member is not transparently additive');
});

// ── 3. LENIENCY - absence is valid, silently ──────────────────────────────
test('LENIENCY - absent caveats is valid, with no error and no warning about caveats', () => {
  const r = validate({ tool_id: 'T01', mandate_type: 'compliance_control', issued_by: 'ainumbers.co' });
  assert(r.valid, `absent caveats must be valid, got errors: ${r.errors.join('; ')}`);
  assert(!r.errors.some((e) => e.includes(CAVEATS_MEMBER)), 'absence must never be an error');
  assert(!r.warnings.some((w) => w.includes(CAVEATS_MEMBER)), 'absence must never be a warning either');
});

test('LENIENCY - an empty caveats array is valid and carries no assertion', () => {
  const r = validate({ tool_id: 'T01', mandate_type: 'compliance_control', issued_by: 'ainumbers.co', caveats: [] });
  assert(r.valid, `empty caveats must be valid, got: ${r.errors.join('; ')}`);
});

test('LENIENCY - a non-UUID mandate_id warns, and must NOT be an error (v1.1 tightens nothing)', () => {
  const r = validate({ tool_id: 'T01', mandate_type: 'compliance_control', issued_by: 'ainumbers.co', mandate_id: 'T01-2026-08-30' });
  assert(r.valid, `a composed mandate_id must not be an error, got: ${r.errors.join('; ')}`);
  assert(r.warnings.some((w) => w.includes('mandate_id')), 'a composed mandate_id should still warn');
});

// ── 4. THE MALFORMED RULING - reject the DOCUMENT, never drop the member ──
const MALFORMED = [
  ['caveats as a string', 'not an array'],
  ['caveats as an object', { note: 'x' }],
  ['caveats as null', null],
  ['caveats array containing a number', ['ok', 42]],
  ['caveats array containing an object', ['ok', { text: 'x' }]],
  ['caveats array containing an empty string', ['ok', '   ']],
];
for (const [label, value] of MALFORMED) {
  test(`RULING - ${label} rejects the DOCUMENT`, () => {
    const r = validate({ tool_id: 'T01', mandate_type: 'compliance_control', caveats: value });
    assert(!r.valid, `malformed caveats must invalidate the document, but validate() returned valid (${label})`);
    assert(r.errors.some((e) => e.includes('caveats')), `the error must name the caveats member, got: ${r.errors.join('; ')}`);
  });
}

test('RULING - a malformed caveats member is never silently removed from the document', () => {
  const doc = { tool_id: 'T01', mandate_type: 'compliance_control', caveats: 'oops' };
  validate(doc);
  assert(doc.caveats === 'oops', 'validate() must not mutate the document it was handed');
});

// ── 5. §3.3 INTAKE ROUND-TRIP, byte-intact ────────────────────────────────
test('ROUND-TRIP - caveats survive export -> §3.3 intake -> re-export byte-intact', () => {
  const exported = { ...shippedBase, caveats: CAVEAT_TEXT };
  const wire = JSON.stringify(exported, null, 2);          // export
  const intaken = JSON.parse(wire);                         // §3.3 intake (FileReader path)
  const reExported = carryCaveats(intaken, { tool_id: 'T99', mandate_type: 'compliance_control' });
  assert(JSON.stringify(reExported.caveats) === JSON.stringify(CAVEAT_TEXT),
    `caveats must survive the round trip byte-intact, got ${JSON.stringify(reExported.caveats)}`);
  assert(validate(reExported).valid, 'the re-exported document must validate');
});

test('ROUND-TRIP - non-ASCII and quote-bearing caveat text survives byte-intact', () => {
  const tricky = ['Résultat approximatif — "as published", 90 % confiance; \\ backslash and   separator.'];
  const intaken = JSON.parse(JSON.stringify({ ...shippedBase, caveats: tricky }));
  const out = carryCaveats(intaken, { tool_id: 'T99', mandate_type: 'compliance_control' });
  assert(out.caveats[0] === tricky[0], `caveat text was altered in transit:\n      in : ${tricky[0]}\n      out: ${out.caveats[0]}`);
});

test('ROUND-TRIP - a tool appends its own caveats after the inherited ones, never replacing them', () => {
  const intaken = { ...shippedBase, caveats: CAVEAT_TEXT };
  const out = carryCaveats(intaken, { tool_id: 'T99', mandate_type: 'compliance_control' }, ['Downstream: figures not re-derived.']);
  assert(out.caveats.length === 3, `expected 2 inherited + 1 own = 3, got ${out.caveats.length}`);
  assert(out.caveats[0] === CAVEAT_TEXT[0] && out.caveats[1] === CAVEAT_TEXT[1], 'inherited caveats must keep their order and position');
  assert(out.caveats[2] === 'Downstream: figures not re-derived.', 'the tool\'s own caveat must be appended last');
});

test('ROUND-TRIP - absent stays absent: intake never synthesises an empty caveats array', () => {
  const out = carryCaveats({ tool_id: 'T01', mandate_type: 'compliance_control' }, { tool_id: 'T99', mandate_type: 'compliance_control' });
  assert(!(CAVEATS_MEMBER in out), 'carrying nothing must not add caveats:[] (see EMPTY_ARRAY_SEMANTICS)');
});

// ── 6. MUTATION CONTROLS - the gate is not vacuous ────────────────────────
// Each of these fails if the corresponding rule were gutted, which is the only
// way to know the green above means anything (SO #34: verify by mutation).
test('MUTATION - a document with no mandate_type is invalid (floor is live)', () => {
  assert(!validate({ tool_id: 'T01' }).valid, 'the v1.0 floor must still reject a missing mandate_type');
});

test('MUTATION - a non-object document is invalid, and does not throw', () => {
  for (const bad of [null, undefined, 'x', 42, []]) {
    const r = validate(bad);
    assert(!r.valid, `validate(${JSON.stringify(bad)}) must be invalid`);
  }
});

test('MUTATION - the oracle itself rejects something (a permissive oracle would make ADDITIVITY vacuous)', () => {
  assert(!oracleAccepts({ tool_id: 'T01' }), 'the shipped validator must reject a document with no mandate_type');
  assert(!oracleAccepts({ tool_id: 'T01', mandate_type: 'x', jurisdiction: 'GB' }), 'the shipped validator must reject a non-array jurisdiction');
});

console.log(`\nvalidate-policy-mandate.test.mjs: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
