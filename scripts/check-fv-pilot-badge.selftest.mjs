#!/usr/bin/env node
// check-fv-pilot-badge.selftest.mjs — FV-BADGE-1. Demonstrates, not asserts, that a kernel edit which
// moves the digest DROPS the badge automatically. Pure in-memory fixtures, touches no real kernel or
// pilot record on disk. Run: node scripts/check-fv-pilot-badge.selftest.mjs
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classifyPilotStatus, validateEvidenceVector } from './check-fv-pilot-badge.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const { sourceDigest } = await import(pathToFileURL(resolve(HERE, '../chaingraph/kernels/_buildid.mjs')).href);

let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  OK:   ${name}`); }
  else { console.error(`  FAIL: ${name}`); failures++; }
}

// ── Fixture 1: kernel unchanged since authoring — badge stays FRESH ──
{
  const kernelSource = 'export function compute(pp){return pp.x+1;}\n';
  const digest = await sourceDigest(kernelSource);
  const record = { tool_id: 'fx-fresh', class: 'B', label: 'Property-tested over stated ranges', kernel_digest_at_authoring: digest };
  const result = await classifyPilotStatus(record, kernelSource, sourceDigest);
  check('unchanged kernel → badge fresh and shown', result.badge === true && result.state === 'fresh');
}

// ── Fixture 2: kernel edited after the pilot record was authored — badge DROPS ──
{
  const authoredSource = 'export function compute(pp){return pp.x+1;}\n';
  const editedSource = 'export function compute(pp){return pp.x+2;} // fixed off-by-one\n';
  const digestAtAuthoring = await sourceDigest(authoredSource);
  const record = { tool_id: 'fx-stale', class: 'A', label: 'Verified by exhaustive enumeration (all 4 inputs)', kernel_digest_at_authoring: digestAtAuthoring };
  const result = await classifyPilotStatus(record, editedSource, sourceDigest);
  check('kernel edited after authoring → badge DROPPED (state=stale)', result.badge === false && result.state === 'stale');
  check('drop reason names the digest mismatch, not a vague failure', typeof result.reason === 'string' && result.reason.includes('does not match'));
}

// ── Fixture 3: kernel missing entirely — badge DROPS, distinct reason ──
{
  const record = { tool_id: 'fx-missing', class: 'C', label: 'Machine-checked proof (Dafny)', kernel_digest_at_authoring: 'sha256:' + '0'.repeat(64) };
  const result = await classifyPilotStatus(record, null, sourceDigest);
  check('missing kernel → badge DROPPED (state=missing-kernel)', result.badge === false && result.state === 'missing-kernel');
}

// ── Fixture 4: invalid class — badge DROPS, never silently defaults ──
{
  const kernelSource = 'export function compute(pp){return 0;}\n';
  const digest = await sourceDigest(kernelSource);
  const record = { tool_id: 'fx-badclass', class: 'D', label: 'nonsense', kernel_digest_at_authoring: digest };
  const result = await classifyPilotStatus(record, kernelSource, sourceDigest);
  check('invalid class → badge DROPPED (state=invalid-class), no generic fallback badge', result.badge === false && result.state === 'invalid-class');
}

// ── Fixture 5: valid evidence_vector, every gate exists — VALID ──
{
  const FAKE_ROOT = resolve(HERE, 'fx-repo-root');
  const existing = new Set([resolve(FAKE_ROOT, 'scripts/real-gate.mjs'), resolve(FAKE_ROOT, 'scripts/other-gate.mjs')]);
  const record = {
    tool_id: 'fx-ev-valid',
    evidence_vector: {
      authoritative_vectors: { count: 3, source: 'house fixtures', tolerance: '2dp', gate: 'scripts/real-gate.mjs' },
      oracle_independence: 'structural',
      metamorphic_relations: [{ relation: 'symmetry', cases: 100, divergences: 0, gate: 'scripts/other-gate.mjs' }],
      machine_proof: { kind: 'enumeration', toolchain_digest: 'node vX' },
      human_signature: { status: 'none', note: 'metadata only' },
    },
  };
  const result = validateEvidenceVector(record, { existsFn: (p) => existing.has(p), repoRoot: FAKE_ROOT });
  check('valid evidence_vector with real gates → valid', result.valid === true && result.errors.length === 0);
}

// ── Fixture 6: evidence_vector claims a gate that does not exist — INVALID (the row's own positive control) ──
{
  const FAKE_ROOT = resolve(HERE, 'fx-repo-root');
  const existing = new Set([resolve(FAKE_ROOT, 'scripts/real-gate.mjs')]);
  const record = {
    tool_id: 'fx-ev-fake-gate',
    evidence_vector: {
      authoritative_vectors: { count: 3, source: 'house fixtures', tolerance: '2dp', gate: 'scripts/does-not-exist.mjs' },
    },
  };
  const result = validateEvidenceVector(record, { existsFn: (p) => existing.has(p), repoRoot: FAKE_ROOT });
  check('evidence_vector citing a non-existent gate → INVALID', result.valid === false);
  check('error names the missing gate', result.errors.some((e) => e.includes('does-not-exist.mjs')));
}

// ── Fixture 7: non-rederivable count (negative / non-integer) — INVALID ──
{
  const FAKE_ROOT = resolve(HERE, 'fx-repo-root');
  const existing = new Set([resolve(FAKE_ROOT, 'scripts/real-gate.mjs')]);
  const record = {
    tool_id: 'fx-ev-bad-count',
    evidence_vector: {
      authoritative_vectors: { count: -1, source: 'house fixtures', tolerance: '2dp', gate: 'scripts/real-gate.mjs' },
    },
  };
  const result = validateEvidenceVector(record, { existsFn: (p) => existing.has(p), repoRoot: FAKE_ROOT });
  check('negative/non-integer count → INVALID', result.valid === false);
}

// ── Fixture 8: missing evidence_vector entirely — INVALID, never silently accepted ──
{
  const result = validateEvidenceVector({ tool_id: 'fx-ev-missing' }, { existsFn: () => true, repoRoot: resolve(HERE, 'fx-repo-root') });
  check('missing evidence_vector → INVALID', result.valid === false);
}

console.log(`\n${failures === 0 ? '✓' : '✗'} check-fv-pilot-badge self-test: ${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
