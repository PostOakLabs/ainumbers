#!/usr/bin/env node
// check-trust-signals.test.mjs — TRUST-SIGNALS-WELLKNOWN-1's paired control
// (GATE-SELFTEST-META-1: a new blocking gate must ship a mutation self-test
// proving it CAN go red, not just that it currently reads green).
//
// Drives the EXPORTED pure functions of gen-trust-signals.mjs and
// check-trust-signals.mjs over in-memory fixtures (SO #40b), plus one GREEN leg
// that validates the REAL emitted .well-known/trust-signals.json against the
// REAL schema. Runs under `node --test` or directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pickFactCommit, assembleDocument, renderDocument, BOT_COMMIT_SUBJECT, SCHEMA_ID,
  proofCoverageSignal, digestFreshnessSignal, determinismSignal,
  sigsumSignal, rekorSignal, citationDriftSignal, conformanceCorpusSignal,
} from './gen-trust-signals.mjs';
import { validateTrustSignals, decideCommitLeg } from './check-trust-signals.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// ── fixtures ──────────────────────────────────────────────────────────────────
const GOOD_PROOF = {
  type: 'ZkVmReceipt', receiptFormat: 'groth16-bn254', imageId: 'sha256:' + 'a'.repeat(64),
  seal: 'x', journal: { output: { ok: true } },
};
const CG_TWO_NODES = {
  nodes: [
    { status: 'live', gpu: false, tool_id: 'art_a', mcp_name: 'art_a', audit_signature: { compute_proof: GOOD_PROOF }, compute_images: [] },
    { status: 'live', gpu: false, tool_id: 'art_b', mcp_name: 'art_b', compute_proof_ready: 'deferred', deferred_reason: 'guest proving cost prohibitive' },
    { status: 'live', gpu: true, tool_id: 'art_c', mcp_name: 'art_c' }, // out of §18 scope
    { status: 'retired', gpu: false, tool_id: 'art_d', mcp_name: 'art_d' }, // not live
  ],
};
const SIGSUM_RECORD = {
  inclusion_proof: { leaf_index: 68569 },
  witness_cosignatures: [{ key_hash: 'k1' }, { key_hash: 'k2' }, { key_hash: 'k3' }],
};
const LOG_LINES = [
  'c' + '0'.repeat(39) + '\x012026-09-28T10:00:00+02:00\x01chore(derived): regenerate shared derived artifacts on main',
  'a' + '1'.repeat(39) + '\x012026-09-28T08:00:00Z\x01PR #2106: some merge',
  'b' + '2'.repeat(39) + '\x012026-09-27T08:00:00Z\x01an earlier commit',
].join('\n');

// ── pickFactCommit: the anchor rule ───────────────────────────────────────────
test('pickFactCommit skips the regen bot commit and anchors the newest real commit', () => {
  const { commit, generatedAt } = pickFactCommit(LOG_LINES);
  assert.equal(commit, 'a' + '1'.repeat(39));
  assert.equal(generatedAt, '2026-09-28T08:00:00Z'); // normalized to UTC, no millis
});

test('pickFactCommit throws when every commit in the window is a bot commit', () => {
  assert.throws(() => pickFactCommit(LOG_LINES.split('\n')[0]), /refusing to anchor/);
});

test('pickFactCommit throws on an unparsable line', () => {
  assert.throws(() => pickFactCommit('not-a-sha\x01nope\x01subj'), /unparsable git log/);
});

test('BOT_COMMIT_SUBJECT stays in sync with derived-artifacts-regen.yml', () => {
  const yml = readFileSync(resolve(REPO, '.github', 'workflows', 'derived-artifacts-regen.yml'), 'utf8');
  assert.ok(yml.includes(BOT_COMMIT_SUBJECT), 'the workflow bot-commit subject changed — gen-trust-signals pickFactCommit must track it');
});

// ── signal collectors: GREEN over fixtures, RED over malformed input ─────────
test('proofCoverageSignal reads the §18 gate classifier over live gpu:false nodes only', () => {
  assert.deepEqual(proofCoverageSignal(CG_TWO_NODES), { covered: 1, total: 2 });
});

test('digestFreshnessSignal publishes the gate partition', () => {
  const stale = { name: 'x', state: 'stale' };
  const fresh = { name: 'y', state: 'fresh' };
  assert.deepEqual(digestFreshnessSignal({ fresh: [fresh], stale: [stale] }), { fresh: 1, stale: 1 });
});

test('determinismSignal reads allowlist count and gate status', () => {
  assert.deepEqual(determinismSignal({ transcendentals: { files: ['a', 'b'] } }, 0), { static_clean: true, allowlisted: 2 });
  assert.throws(() => determinismSignal({}, 0), /transcendentals\.files/);
});

test('sigsumSignal reads leaf index and cosigner count; RED on a truncated record', () => {
  assert.deepEqual(sigsumSignal(SIGSUM_RECORD), { latest_leaf: 68569, cosigners: 3 });
  assert.throws(() => sigsumSignal({ inclusion_proof: {} }), /leaf_index/);
});

test('rekorSignal reads the 64-hex uuid; RED on anything else', () => {
  assert.deepEqual(rekorSignal({ uuid: 'a'.repeat(64) }), { latest_entry: 'a'.repeat(64) });
  assert.throws(() => rekorSignal({ uuid: 'deadbeef' }), /uuid/);
});

test('citationDriftSignal and conformanceCorpusSignal count from the gate files', () => {
  assert.deepEqual(citationDriftSignal({ known_findings: ['a', 'b'] }), { baseline: 2 });
  assert.deepEqual(conformanceCorpusSignal({ version: '1.1.0', vectors: [{}, {}] }), { vectors: 2, manifest_version: '1.1.0' });
  assert.throws(() => conformanceCorpusSignal({ vectors: [] }), /version/);
});

// ── assembly: the published shape, byte-deterministic ────────────────────────
test('assembleDocument emits the row shape and renders byte-deterministically', () => {
  const signals = { proof_coverage: { covered: 1, total: 2 } };
  const a = renderDocument(assembleDocument({ generatedAt: '2026-09-28T08:00:00Z', commit: 'a'.repeat(40), signals }));
  const b = renderDocument(assembleDocument({ generatedAt: '2026-09-28T08:00:00Z', commit: 'a'.repeat(40), signals }));
  assert.equal(a, b);
  const doc = JSON.parse(a);
  assert.deepEqual(Object.keys(doc), ['schema', 'generated_at', 'commit', 'signals', 'verify']);
  assert.equal(doc.schema, SCHEMA_ID);
  assert.equal(doc.verify.how.length > 0, true);
});

// ── the validator: GREEN on the real file, RED on mutations ──────────────────
test('validator: the REAL emitted digest validates against the REAL schema', () => {
  const doc = JSON.parse(readFileSync(resolve(REPO, '.well-known', 'trust-signals.json'), 'utf8'));
  const schema = JSON.parse(readFileSync(resolve(REPO, '.well-known', 'trust-signals.schema.json'), 'utf8'));
  assert.deepEqual(validateTrustSignals(doc, schema), []);
});

test('validator RED: wrong schema const', () => {
  const schema = JSON.parse(readFileSync(resolve(REPO, '.well-known', 'trust-signals.schema.json'), 'utf8'));
  const doc = JSON.parse(readFileSync(resolve(REPO, '.well-known', 'trust-signals.json'), 'utf8'));
  doc.schema = 'ainumbers.co/trust-signals/v2';
  const f = validateTrustSignals(doc, schema);
  assert.ok(f.some((x) => x.includes('const violation')), f.join('; '));
});

test('validator RED: missing required member (commit)', () => {
  const schema = JSON.parse(readFileSync(resolve(REPO, '.well-known', 'trust-signals.schema.json'), 'utf8'));
  const doc = JSON.parse(readFileSync(resolve(REPO, '.well-known', 'trust-signals.json'), 'utf8'));
  delete doc.commit;
  const f = validateTrustSignals(doc, schema);
  assert.ok(f.some((x) => x.includes('required member missing: commit')), f.join('; '));
});

test('validator RED: non-integer count and below-minimum cosigners', () => {
  const schema = JSON.parse(readFileSync(resolve(REPO, '.well-known', 'trust-signals.schema.json'), 'utf8'));
  const base = () => JSON.parse(readFileSync(resolve(REPO, '.well-known', 'trust-signals.json'), 'utf8'));
  let doc = base();
  doc.signals.proof_coverage.covered = 1.5;
  assert.ok(validateTrustSignals(doc, schema).some((x) => x.includes('expected integer')), 'float count must red');
  doc = base();
  doc.signals.anchors.sigsum.cosigners = -1;
  assert.ok(validateTrustSignals(doc, schema).some((x) => x.includes('below minimum')), 'negative cosigners must red');
});

test('validator RED: commit pattern and empty verify.how', () => {
  const schema = JSON.parse(readFileSync(resolve(REPO, '.well-known', 'trust-signals.schema.json'), 'utf8'));
  const base = () => JSON.parse(readFileSync(resolve(REPO, '.well-known', 'trust-signals.json'), 'utf8'));
  let doc = base();
  doc.commit = 'deadbeef';
  assert.ok(validateTrustSignals(doc, schema).some((x) => x.includes('fails pattern')), 'short sha must red');
  doc = base();
  doc.verify.how = '';
  assert.ok(validateTrustSignals(doc, schema).some((x) => x.includes('minLength')), 'empty how must red');
});

// ── the context split: pure decision, all four quadrants ─────────────────────
test('decideCommitLeg: match is green in every context', () => {
  assert.deepEqual(decideCommitLeg({ fileCommit: 'a', expectedCommit: 'a', mainContext: true }), { ok: true, advisory: false });
  assert.deepEqual(decideCommitLeg({ fileCommit: 'a', expectedCommit: 'a', mainContext: false }), { ok: true, advisory: false });
});

test('decideCommitLeg: mismatch is advisory on a PR, hard on main (fails closed on undeterminable)', () => {
  assert.deepEqual(decideCommitLeg({ fileCommit: 'a', expectedCommit: 'b', mainContext: false }), { ok: false, advisory: true });
  assert.deepEqual(decideCommitLeg({ fileCommit: 'a', expectedCommit: 'b', mainContext: true }), { ok: false, advisory: false });
  // mainContext undefined/null (a probe that threw) must BLOCK, never relax.
  assert.deepEqual(decideCommitLeg({ fileCommit: 'a', expectedCommit: 'b', mainContext: undefined }), { ok: false, advisory: false });
});
