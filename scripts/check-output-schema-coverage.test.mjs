#!/usr/bin/env node
/**
 * scripts/check-output-schema-coverage.test.mjs — GATE-SELFTEST-META-1 pair for
 * scripts/check-output-schema-coverage.mjs (OUTPUTSCHEMA-GAP-1).
 *
 * In-memory + temp-dir fixtures only — no scan of the real chaingraph.json/manifests/ —
 * proving the checker's functions can go RED, not just that today's estate happens to
 * read green. Wired into scripts/preflight.mjs as its own GATES entry alongside the
 * gate itself (pairing form (a) in check-gate-selftest-pairing.mjs's header).
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { coverageGap, deriveSchema, validateSubset } from './check-output-schema-coverage.mjs';

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.error(`  FAIL ${label}`); failures++; }
}

// ── coverageGap: RED (gap listed) / GREEN (covered not listed) / scoping ──
const cg = {
  nodes: [
    { status: 'live', mcp_name: 'tool_a', tool_id: 'gap-node' },
    { status: 'live', mcp_name: 'tool_b', tool_id: 'covered-node' },
    { status: 'draft', mcp_name: 'tool_c', tool_id: 'draft-node' },      // not live → out of scope
    { status: 'live', mcp_name: null, tool_id: 'noname-node' },           // no mcp_name → out of scope
    { status: 'live', mcp_name: 'tool_e', tool_id: 'unmanifested-node' }, // no manifest → NODE-COMPLETENESS's debt
  ],
};
const manifests = {
  'gap-node.manifest.json': { tool_id: 'gap-node' },
  'covered-node.manifest.json': { tool_id: 'covered-node', output_schema: { type: 'object' } },
  'draft-node.manifest.json': { tool_id: 'draft-node' },
  // NB: deliberately NO manifest file for 'unmanifested-node' — absence is the case under test.
};
const d = mkdtempSync(join(tmpdir(), 'osc-selftest-'));
for (const [f, v] of Object.entries(manifests)) writeFileSync(join(d, f), JSON.stringify(v));
const gap = coverageGap(cg, { manDir: d });
rmSync(d, { recursive: true, force: true });

check('coverageGap: missing output_schema live node -> listed (RED proof)', gap.includes('gap-node'));
check('coverageGap: covered node -> not listed', !gap.includes('covered-node'));
check('coverageGap: draft node -> not listed (status predicate)', !gap.includes('draft-node'));
check("coverageGap: manifest-less live node -> not this gate's debt", !gap.includes('unmanifested-node'));
check('coverageGap: no silent extra ids', gap.length === 1);

// ── validateSubset: RED on each failure mode the gate polices ──
const errs = [];
validateSubset(
  { type: 'object', properties: { a: { type: 'string' } }, required: ['a', 'b'], additionalProperties: false },
  { a: 1, c: true }, 'o', errs,
);
check('validateSubset: type mismatch -> RED', errs.some((e) => e.startsWith('o.a: expected type')));
check("validateSubset: missing required -> RED", errs.some((e) => e.includes("o: missing required property 'b'")));
check('validateSubset: additionalProperties -> RED', errs.some((e) => e.includes("o: additional property 'c' not allowed")));
check('validateSubset: enum violation -> RED', (() => {
  const e2 = [];
  validateSubset({ type: 'string', enum: ['x', 'y'] }, 'z', 'v', e2);
  return e2.length === 1 && e2[0].includes('not in enum');
})());
check('validateSubset: conforming instance -> GREEN', (() => {
  const e3 = [];
  validateSubset(
    { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false },
    { a: 'ok' }, 'o', e3,
  );
  return e3.length === 0;
})());
check('validateSubset: null member of a union type stays legal', (() => {
  const e4 = [];
  validateSubset({ type: ['string', 'null'] }, null, 'v', e4);
  return e4.length === 0;
})());

// ── deriveSchema: §3.10 rules + the no-fixture-accident constraints ──
const fixtures = { vectors: [
  { output_payload: { verdict: 'PASS', score: 20, note: 'a long free-text sentence that varies', venue: 'kalshi', flag: true, citations: ['r1'] } },
  { output_payload: { verdict: 'FAIL', score: 17, note: 'another even longer free-text sentence variant', venue: 'polymarket', flag: false, citations: [] } },
] };
const derived = deriveSchema(fixtures);
check('derive: always an object with additionalProperties:false', derived.type === 'object' && derived.additionalProperties === false);
check('derive: required = keys present in EVERY fixture', JSON.stringify([...derived.required].sort()) === JSON.stringify(['citations', 'flag', 'note', 'score', 'venue', 'verdict']));
check('derive: closed short vocabulary -> enum', JSON.stringify(derived.properties.venue.enum) === JSON.stringify(['kalshi', 'polymarket']));
check('derive: numeric output NEVER enumerated (fixture-constant score)', derived.properties.score.type === 'number' && !derived.properties.score.enum);
check('derive: long free text NEVER enumerated', derived.properties.note.type === 'string' && !derived.properties.note.enum);
check('derive: boolean with both members observed -> enum [false,true]', JSON.stringify(derived.properties.flag.enum) === '[false,true]');
check('derive: array field carries items schema', derived.properties.citations.type === 'array' && derived.properties.citations.items.type === 'string');
check('derive: SWORN-member citations required', derived.required.includes('citations'));

// every derived schema must accept the fixtures it came from (self-consistency, SO #34)
const selfErrs = [];
fixtures.vectors.forEach((v, i) => validateSubset(derived, v.output_payload, `p${i}`, selfErrs));
check('derive: derived schema validates its own fixtures (GREEN)', selfErrs.length === 0);

if (failures) {
  console.error(`\n✗ output-schema coverage self-test: ${failures} control(s) failed`);
  process.exit(1);
}
console.log('\n✓ output-schema coverage self-test: all controls green (RED proofs + GREEN proofs).');
