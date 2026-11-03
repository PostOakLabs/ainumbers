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
import { computeFindings, valueSearchVariants, findRegistryDuplicates, parseSha256Sums, computeSha256SumsFindings } from './check-citation-drift.mjs';

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

// ── 7. DUPLICATE_REGISTRY_ENTRY — (id, digest) uniqueness (CLAUSE-REGISTRY-DEDUPE-1) ──
// Fixture: the same (id, digest) pair twice = the append-twice merge accident. Must RED.
const dupFixture = [
  { id: '12 CFR 1026.52', digest: 'sha256:deadbeef', clause_path: '(a)', retrieved_at: '2026-09-03' },
  { id: '12 CFR 1026.52', digest: 'sha256:deadbeef', clause_path: '(a)', retrieved_at: '2026-09-03' },
];
const dupFindings = findRegistryDuplicates(dupFixture);
assert(dupFindings.length === 1 && dupFindings[0].kind === 'DUPLICATE_REGISTRY_ENTRY', 'RED: a fixture with one duplicated (id, digest) pair yields exactly one DUPLICATE_REGISTRY_ENTRY finding');
console.log(`  [quotable] RED  — ${dupFindings[0]?.message}`);
assert(findRegistryDuplicates(dupFixture.slice(0, 1)).length === 0, 'GREEN: the same fixture with the duplicate removed yields no findings');

// Same id + DIFFERENT digest = legitimate re-retrieval. Must never be flagged.
const reRetrieval = [
  { id: '12 CFR 1026.52', digest: 'sha256:aaaa' },
  { id: '12 CFR 1026.52', digest: 'sha256:bbbb' },
];
assert(findRegistryDuplicates(reRetrieval).length === 0, 'GREEN: same id with two DIFFERENT digests (legitimate re-retrieval) is never flagged');

// Triple repeat flags each repeat after the first, and order/first-occurrence semantics hold.
const triple = [
  { id: 'X', digest: 'sha256:1' },
  { id: 'X', digest: 'sha256:1' },
  { id: 'X', digest: 'sha256:1' },
];
const tripleFindings = findRegistryDuplicates(triple);
assert(tripleFindings.length === 2, 'RED: a tripled pair flags both repeats after the first');
assert(tripleFindings.every((f) => f.message.includes('first seen at entry 0')), 'first occurrence (entry 0) is the survivor in every message');

// ── 8. SOURCE_SNAPSHOT_ABSENT_LOCALLY — CITATION-DRIFT-FOLLOWUP-ITEM4-1 check 3 ──
// A REGISTERED cited digest with no local snapshot bytes must be flagged locally...
const driftRed = computeFindings({ registry: new Map([[DIGEST_B, { digest: DIGEST_B }]]), nodes: [
  { tool_id: 'scratch-drift-node', cited_clause_digest: [{ digest: DIGEST_B, clause_path: '(b)', retrieved_at: '2026-10-01' }] },
], declared: [], snapshotText: new Map(), localMode: true });
assert(driftRed.some((f) => f.kind === 'SOURCE_SNAPSHOT_ABSENT_LOCALLY'), 'RED: a registered cited digest with no local snapshot file is flagged SOURCE_SNAPSHOT_ABSENT_LOCALLY');
console.log(`  [quotable] RED  — ${driftRed.find((f) => f.kind === 'SOURCE_SNAPSHOT_ABSENT_LOCALLY')?.message}`);
// ...and clears once the bytes exist locally...
const driftGreen = computeFindings({ registry: new Map([[DIGEST_B, { digest: DIGEST_B }]]), nodes: [
  { tool_id: 'scratch-drift-node', cited_clause_digest: [{ digest: DIGEST_B, clause_path: '(b)', retrieved_at: '2026-10-01' }] },
], declared: [], snapshotText: new Map([[DIGEST_B, 'excerpt bytes exist']]), localMode: true });
assert(!driftGreen.some((f) => f.kind === 'SOURCE_SNAPSHOT_ABSENT_LOCALLY'), 'GREEN: the same digest with local bytes present clears SOURCE_SNAPSHOT_ABSENT_LOCALLY');
// ...in CI shape it is SKIPPED_NO_SNAPSHOT, never a silent pass (SO #34c)...
const driftCi = computeFindings({ registry: new Map([[DIGEST_B, { digest: DIGEST_B }]]), nodes: [
  { tool_id: 'scratch-drift-node', cited_clause_digest: [{ digest: DIGEST_B, clause_path: '(b)', retrieved_at: '2026-10-01' }] },
], declared: [], snapshotText: new Map(), localMode: false });
assert(driftCi.some((f) => f.kind === 'SKIPPED_NO_SNAPSHOT' && f.key === 'scratch-drift-node::local-snapshot-verify'), 'CI shape: local byte-match reports SKIPPED_NO_SNAPSHOT per node, never a pass');
// ...and mutation control: an UNREGISTERED digest stays UNRESOLVED_DIGEST, not the new kind.
const driftMut = computeFindings({ registry: new Map(), nodes: [
  { tool_id: 'scratch-drift-node', cited_clause_digest: [{ digest: 'sha256:unknown', clause_path: '(b)', retrieved_at: '2026-10-01' }] },
], declared: [], snapshotText: new Map(), localMode: true });
assert(driftMut.some((f) => f.kind === 'UNRESOLVED_DIGEST') && !driftMut.some((f) => f.kind === 'SOURCE_SNAPSHOT_ABSENT_LOCALLY'), 'MUTATION CONTROL: an unregistered digest is UNRESOLVED_DIGEST (check 1), never double-reported as locally-absent');

// ── 9. SHA256SUMS manifest (Placard pattern) — CITATION-DRIFT-FOLLOWUP-ITEM4-1 check 4 ──
const sumsText = '11f16f3eb36254fb45159d1c9f09f0264e851bd2f2c65a97191ea8b838170bb6  12-CFR-1024.17-ecfr-2026-10-05.txt\n615767da5476ffbc8bc8aedb3e44207fbdef6cb7da4c87f0c2de64c7512a1265  12-CFR-1024.35-1024.36-ecfr-2026-10-05.txt\n';
const parsed = parseSha256Sums(sumsText);
assert(parsed.length === 2 && parsed[0].name === '12-CFR-1024.17-ecfr-2026-10-05.txt' && parsed[0].sha256 === '11f16f3eb36254fb45159d1c9f09f0264e851bd2f2c65a97191ea8b838170bb6', 'parseSha256Sums: sha256sum two-space format parses to (sha256, name) pairs');
assert(parseSha256Sums('not a manifest line').length === 0, 'parseSha256Sums: non-manifest lines are ignored');

const filesOk = new Map([['12-CFR-1024.17-ecfr-2026-10-05.txt', '11f16f3eb36254fb45159d1c9f09f0264e851bd2f2c65a97191ea8b838170bb6'], ['12-CFR-1024.35-1024.36-ecfr-2026-10-05.txt', '615767da5476ffbc8bc8aedb3e44207fbdef6cb7da4c87f0c2de64c7512a1265']]);
assert(computeSha256SumsFindings({ manifest: parsed, filesByName: filesOk, localMode: true }).length === 0, 'GREEN: a manifest whose files all hash to their pinned sha256 yields no findings');
const filesDrift = new Map([['12-CFR-1024.17-ecfr-2026-10-05.txt', 'deadbeef'.padEnd(64, '0')], ['12-CFR-1024.35-1024.36-ecfr-2026-10-05.txt', '615767da5476ffbc8bc8aedb3e44207fbdef6cb7da4c87f0c2de64c7512a1265']]);
const manifestRed = computeSha256SumsFindings({ manifest: parsed, filesByName: filesDrift, localMode: true });
assert(manifestRed.length === 1 && manifestRed[0].kind === 'SOURCE_DRIFT_MANIFEST' && manifestRed[0].key === '12-CFR-1024.17-ecfr-2026-10-05.txt::manifest-drift', 'RED: a file that no longer hashes to its pinned sha256 is flagged SOURCE_DRIFT_MANIFEST');
console.log(`  [quotable] RED  — ${manifestRed[0]?.message}`);
const filesMissing = new Map([['12-CFR-1024.35-1024.36-ecfr-2026-10-05.txt', '615767da5476ffbc8bc8aedb3e44207fbdef6cb7da4c87f0c2de64c7512a1265']]);
const missingRed = computeSha256SumsFindings({ manifest: parsed, filesByName: filesMissing, localMode: true });
assert(missingRed.length === 1 && missingRed[0].kind === 'MANIFEST_FILE_MISSING', 'RED: a manifest-named file absent from disk is flagged MANIFEST_FILE_MISSING');
const sumsCi = computeSha256SumsFindings({ manifest: parsed, filesByName: new Map(), localMode: false });
assert(sumsCi.length === 1 && sumsCi[0].kind === 'SKIPPED_NO_SNAPSHOT', 'CI shape: manifest verification reports one SKIPPED_NO_SNAPSHOT, never a pass (SO #34c)');

if (failures) {
  console.error(`\ncheck-citation-drift.test.mjs: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\ncheck-citation-drift.test.mjs: all assertions passed.');
