#!/usr/bin/env node
/**
 * scripts/generate-node-manifest.test.mjs — self-test for
 * scripts/generate-node-manifest.mjs's output_schema derivation
 * (MANIFEST-OUTPUTSCHEMA-ALL-FIXTURES-1).
 *
 * RED/GREEN against the #2964 (art-828) / #2974 (art-829) ejection class: a
 * refusal fixture emits null, a single-sample draft declares a non-null type,
 * and OUTPUTSCHEMA-GAP-1 ejects the PR from the merge queue on the assembled
 * tree. In-memory + temp-dir fixtures only — no write to the real
 * chaingraph/ or manifests/ trees. Wired into scripts/preflight.mjs as its
 * own GATES entry alongside the generator's --all --check dry-run (the
 * check-output-schema-coverage.test.mjs pairing pattern).
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { draftManifest } from './generate-node-manifest.mjs';
import { validateSubset } from './check-output-schema-coverage.mjs';

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); }
  else { console.error(`  FAIL ${label}`); failures++; }
}

// ── art-828 shape (the 13-case reconcile fixture compressed to its discriminating
// fields): event_log_head is "sha256:…" on success and NULL on refusal — the exact
// field whose missing null ejected #2964 three times on 11-11 — while profile is
// always a string and verdict is a two-member closed vocabulary. ──
const art828Fixtures = {
  tool_id: 'art-828-reconcile-omnibus-token-position',
  vectors: [
    { output_payload: { verdict: 'RECONCILED', profile: 'dtc_dts', omnibus_balance: '1000000', event_log_head: 'sha256:e43652dc2eb1c4b9040' } },
    { output_payload: { verdict: 'MISMATCH', profile: 'dtc_dts', omnibus_balance: '1000', event_log_head: null } },
    { output_payload: { verdict: 'RECONCILED', profile: 'dtc_dts', omnibus_balance: '100', event_log_head: 'sha256:1862cf8362bfde8f91948e5642e41ff' } },
  ],
};
// ── art-829 shape (safe-tx-hash recompute, per the reservation note): the hash
// fields are strings in every case — an always-string field must stay a bare
// "string", never grow an enum or a union. ──
const art829Fixtures = {
  tool_id: 'art-829-safe-tx-hash-recompute',
  vectors: [
    { output_payload: { recompute_ok: true, safe_tx_hash: '0x9d3ab411c4f1', domain_separator: '0x1f8e77aa0042', computed_nonce: 7 } },
    { output_payload: { recompute_ok: false, safe_tx_hash: '0x4b2109de552c', domain_separator: '0x1f8e77aa0042', computed_nonce: 7 } },
  ],
};

const d = mkdtempSync(join(tmpdir(), 'gnm-selftest-'));
writeFileSync(join(d, 'art-828-reconcile-omnibus-token-position.fixtures.json'), JSON.stringify(art828Fixtures));
writeFileSync(join(d, 'art-829-safe-tx-hash-recompute.fixtures.json'), JSON.stringify(art829Fixtures));

// ── case 1 (art-828 shape): fixtures file present → schema unions EVERY payload ──
const node828 = { tool_id: 'art-828-reconcile-omnibus-token-position', status: 'live', mcp_name: 'reconcile_omnibus_token_position' };
const d828 = draftManifest(node828, { fixturesDir: d }).manifest;
const s828 = d828.output_schema;
check('art-828 shape: a fixtures file yields an output_schema at all (tier 3 no longer omits it)', Boolean(s828));
check('art-828 shape: object with additionalProperties:false (§3.10 deriver signature)',
  s828.type === 'object' && s828.additionalProperties === false);
check('art-828 shape: string-in-one-fixture / null-in-another -> ["string","null"]',
  JSON.stringify(s828.properties.event_log_head.type) === '["string","null"]');
check('art-828 shape: always-string field stays "string"', s828.properties.profile.type === 'string');
check('art-828 shape: closed two-member verdict vocabulary -> enum',
  JSON.stringify(s828.properties.verdict.enum) === '["MISMATCH","RECONCILED"]');
check('art-828 shape: every key observed in every fixture is required',
  JSON.stringify([...s828.required].sort()) === JSON.stringify(['event_log_head', 'omnibus_balance', 'profile', 'verdict']));

// RED proof: the pre-patch single-sample schema (derived from the first fixture
// alone) REJECTS the refusal payload — this is the #2964 ejection, reproduced.
const singleSampleSchema = {
  type: 'object',
  properties: {
    verdict: { type: 'string' }, profile: { type: 'string' },
    omnibus_balance: { type: 'string' }, event_log_head: { type: 'string' },
  },
};
const redErrs = [];
validateSubset(singleSampleSchema, art828Fixtures.vectors[1].output_payload, 'p1', redErrs);
check('RED proof: the single-sample schema REJECTS the null refusal fixture (the #2964 ejection)',
  redErrs.some((e) => e.includes('event_log_head')));
const greenErrs = [];
art828Fixtures.vectors.forEach((v, i) => validateSubset(s828, v.output_payload, `p${i}`, greenErrs));
check('GREEN proof: the all-fixture schema validates every fixture it derived from (SO #34c)',
  greenErrs.length === 0);
check('art-828 shape: source line names the all-fixture derivation',
  d828.source.includes('every fixture output_payload'));

// ── case 2 (art-829 shape): an always-string field stays a bare "string" ──
const node829 = { tool_id: 'art-829-safe-tx-hash-recompute', status: 'live', mcp_name: 'safe_tx_hash_recompute' };
const s829 = draftManifest(node829, { fixturesDir: d }).manifest.output_schema;
check('art-829 shape: always-string hash field stays "string" (no enum, no union)',
  s829.properties.safe_tx_hash.type === 'string' && !s829.properties.safe_tx_hash.enum);
check('art-829 shape: both boolean members observed -> enum [false,true]',
  JSON.stringify(s829.properties.recompute_ok.enum) === '[false,true]');
check('art-829 shape: numeric output NEVER enumerated (fixture-constant nonce)',
  s829.properties.computed_nonce.type === 'number' && !s829.properties.computed_nonce.enum);
const green829 = [];
art829Fixtures.vectors.forEach((v, i) => validateSubset(s829, v.output_payload, `q${i}`, green829));
check('art-829 shape: derived schema validates its own fixtures (SO #34c)', green829.length === 0);

// ── case 3: the single-sample path survives as the NO-fixtures fallback only ──
const nodeProof = {
  tool_id: 'gen-manifest-selftest-no-fixtures', status: 'live', mcp_name: 'gen_manifest_selftest',
  compute_proof: { journal: { output: { verdict: 'PASS', note: 'free text' } } },
};
const noFx = draftManifest(nodeProof, { fixturesDir: d }).manifest; // d carries no file for this id
check('fallback: no fixtures file -> single-sample schema from the proof journal',
  noFx.output_schema.properties.verdict.type === 'string' && noFx.output_schema.additionalProperties === undefined);
check('fallback: source line says single-sample (no fixtures file)',
  noFx.source.includes('single-sample typing (no fixtures file)'));
const d2 = mkdtempSync(join(tmpdir(), 'gnm-selftest-'));
writeFileSync(join(d2, 'gen-manifest-selftest-no-fixtures.fixtures.json'),
  JSON.stringify({ tool_id: 'gen-manifest-selftest-no-fixtures', vectors: [{ output_payload: { verdict: 'PASS', note: 'x' } }] }));
const withFx = draftManifest(nodeProof, { fixturesDir: d2 }).manifest; // same node, fixtures file present
check('priority: fixtures file present -> ALL-fixture schema wins even when a proof journal exists',
  withFx.output_schema.additionalProperties === false && withFx.source.includes('every fixture output_payload'));

rmSync(d, { recursive: true, force: true });
rmSync(d2, { recursive: true, force: true });

if (failures) {
  console.error(`\n✗ generate-node-manifest self-test: ${failures} control(s) failed`);
  process.exit(1);
}
console.log('\n✓ generate-node-manifest self-test: all controls green (RED proof + GREEN proofs + fallback).');
