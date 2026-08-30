#!/usr/bin/env node
/**
 * scripts/check-citation-drift.test.mjs — CITATION-DRIFT-GATE-1's own pair
 * (GATE-SELFTEST-META-1: a new blocking gate must ship a paired mutation
 * self-test proving it CAN go red, not just that it currently reads green).
 *
 * Pure in-memory fixtures via computeFindings() — never touches the real
 * chaingraph/graph/nodes/*.json, the real registry, or the real
 * research/clause-snapshots/ directory, so this stays valid regardless of
 * what today's estate looks like.
 *
 * Usage: node scripts/check-citation-drift.test.mjs
 */
import { computeFindings, valueSearchVariants } from './check-citation-drift.mjs';

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log(`✗ ${msg}`); }
  else console.log(`✓ ${msg}`);
}

const DIGEST_A = 'sha256:aaaa';
const DIGEST_B = 'sha256:bbbb';

const node = {
  tool_id: 'scratch-test-node',
  cited_clause_digest: [
    { digest: DIGEST_A, clause_path: '(a)(1)', retrieved_at: '2026-08-01' },
  ],
};
const registry = new Map([[DIGEST_A, { digest: DIGEST_A }]]);
const declared = [
  { tool_id: 'scratch-test-node', field: 'output_payload.rate_pct', value: 5, unit: 'pct', digest: DIGEST_A, clause_path: '(a)(1)' },
];

// ── 1. VALUE_NOT_IN_CITED_TEXT — RED then GREEN ──────────────────────────
const redText = new Map([[DIGEST_A, 'this excerpt says nothing about the rate']]);
const red = computeFindings({ registry, nodes: [node], declared, snapshotText: redText, localMode: true });
assert(red.some((f) => f.kind === 'VALUE_NOT_IN_CITED_TEXT'), 'RED: declared value absent from its cited excerpt is flagged VALUE_NOT_IN_CITED_TEXT');
console.log(`  [quotable] RED  — ${red.find((f) => f.kind === 'VALUE_NOT_IN_CITED_TEXT')?.message}`);

const greenText = new Map([[DIGEST_A, 'the applicable rate is 5 percent of the retained interest']]);
const green = computeFindings({ registry, nodes: [node], declared, snapshotText: greenText, localMode: true });
assert(!green.some((f) => f.kind === 'VALUE_NOT_IN_CITED_TEXT'), 'GREEN: declared value present in its cited excerpt (as "5 percent") clears the finding');

// ── 2. MUTATION CONTROL — a coincidental match elsewhere must not launder a
//    real absence: the excerpt must be the ONE the value is DECLARED against. ──
const wrongDigestText = new Map([[DIGEST_B, 'an unrelated excerpt mentioning 5 percent in a different context']]);
const stillRed = computeFindings({ registry, nodes: [node], declared, snapshotText: wrongDigestText, localMode: true });
assert(stillRed.some((f) => f.kind === 'SNAPSHOT_MISSING_LOCALLY'), 'MUTATION CONTROL: text present only under a DIFFERENT digest does not clear the declared entry (SNAPSHOT_MISSING_LOCALLY, not a pass)');

// ── 3. SKIPPED-NO-SNAPSHOT in CI shape — never counted as a pass (SO #34c) ──
const ci = computeFindings({ registry, nodes: [node], declared, snapshotText: new Map(), localMode: false });
assert(ci.some((f) => f.kind === 'SKIPPED_NO_SNAPSHOT'), 'CI shape: value-match reports SKIPPED_NO_SNAPSHOT, a distinct state from pass');
assert(!ci.some((f) => f.kind === 'VALUE_NOT_IN_CITED_TEXT'), 'CI shape: never fabricates a value-match verdict with no snapshot to check');

// ── 4. UNRESOLVED_DIGEST — a citation whose digest is not in the registry ──
const badNode = { tool_id: 'scratch-bad-digest', cited_clause_digest: [{ digest: 'sha256:unknown', clause_path: '(z)', retrieved_at: '2026-08-01' }] };
const unresolved = computeFindings({ registry, nodes: [badNode], declared: [], snapshotText: new Map(), localMode: true });
assert(unresolved.some((f) => f.kind === 'UNRESOLVED_DIGEST'), 'RED: a cited digest absent from the registry is flagged UNRESOLVED_DIGEST');
const resolvedNode = { tool_id: 'scratch-bad-digest', cited_clause_digest: [{ digest: DIGEST_A, clause_path: '(z)', retrieved_at: '2026-08-01' }] };
const resolved = computeFindings({ registry, nodes: [resolvedNode], declared: [], snapshotText: new Map(), localMode: true });
assert(!resolved.some((f) => f.kind === 'UNRESOLVED_DIGEST'), 'GREEN: same node with a digest that IS in the registry clears UNRESOLVED_DIGEST');

// ── 5. MISSING_RETRIEVED_AT — CI-checkable structural completeness ────────
const noDate = { tool_id: 'scratch-no-date', cited_clause_digest: [{ digest: DIGEST_A, clause_path: '(a)(1)' }] };
const noDateFindings = computeFindings({ registry, nodes: [noDate], declared: [], snapshotText: new Map(), localMode: false });
assert(noDateFindings.some((f) => f.kind === 'MISSING_RETRIEVED_AT'), 'RED: a cited_clause_digest entry with no retrieved_at is flagged, and this check needs no snapshot (CI-checkable)');

// ── 6. valueSearchVariants — unit-shape sanity ────────────────────────────
assert(valueSearchVariants(5, 'pct').includes('5%'), 'valueSearchVariants: pct unit includes the bare "%" form');
assert(valueSearchVariants(1.5, 'pp').includes('1.5pp'), 'valueSearchVariants: pp unit includes the bare "pp" form');

if (failures) {
  console.error(`\ncheck-citation-drift.test.mjs: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\ncheck-citation-drift.test.mjs: all assertions passed.');
