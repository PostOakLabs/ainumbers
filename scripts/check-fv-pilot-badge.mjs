#!/usr/bin/env node
// check-fv-pilot-badge.mjs — FV-BADGE-1 per-kernel tier badge derivation.
//
// SCOPE: this is the four-kernel formal-verification PILOT on methods.html (art-157, art-27, art-215,
// art-376) -- a distinct, smaller tier from the PBT-floor tier check-fv-floor-coverage.mjs covers (594/600
// live kernels, internal QC only). Do not conflate the two counts or the two badge concepts.
//
// THREE badges, never one: class A "Verified by exhaustive enumeration (all N inputs)", class B
// "Property-tested over stated ranges", class C "Machine-checked proof (Dafny)" -- Tim's labels verbatim
// (methods.html). A generic "Formally Verified" badge is banned. Class C is granted only where a real
// Dafny artifact exists -- today art-215 alone; blanket class-C Dafny stays frozen.
//
// CHAINS AND WORKFLOWS: this badge is per-KERNEL only. A chain composed of a badged kernel plus
// non-pilot kernels must NEVER render or infer a chain-level FV badge -- an agreement between two
// runners (a chain's own hash-verify / differential check) is not a proof, and this module deliberately
// exposes no chain-level API. Verified 2026-08-14 (FV-BADGE-1): 3 of 363 chains include a pilot kernel
// (emir-reconciliation-and-lifecycle, mortgage-apr-accuracy-and-tolerance-cure, vop-liability-evidence)
// and none of their composer pages carry any formal-verification claim today -- their "verified"/"proof"
// occurrences are all the unrelated §16 DataIntegrityProof hash-verify UI. Do not add a chain-level badge
// without a real per-chain proof artifact to derive it from.
//
// DERIVATION, never authoring: each chaingraph/fv-pilot/<tool_id>.json record carries the class/label
// (Tim's pilot enrollment -- a one-time editorial fact, same as methods.html's own prose) plus a
// kernel_digest_at_authoring. This script recomputes sourceDigest() of the CURRENT kernel source and
// compares -- the badge is FRESH (shown) only when they match, DROPPED (never shown) the instant a kernel
// edit moves the digest. Nothing here re-authors class/label from a kernel edit; a stale kernel just loses
// its badge until a human re-signs it (same shape as classifyFloor() in check-fv-floor-coverage.mjs).
//
// Usage:
//   node scripts/check-fv-pilot-badge.mjs                 summary + exit 0 always (informational; a
//                                                           DROPPED badge is not a failure, it is the gate
//                                                           doing its job)
//   node scripts/check-fv-pilot-badge.mjs --list           print every pilot record + its derived state
//   node scripts/check-fv-pilot-badge.mjs --json            machine-readable derivation, one line per record
//   node scripts/check-fv-pilot-badge.mjs --check           exit 1 if any record's evidence_vector is
//                                                           shape/gate-invalid (FV-EVIDENCE-VECTOR-1);
//                                                           badge freshness itself never fails this way

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_DIR = resolve(REPO, 'chaingraph');
const PILOT_DIR = resolve(CG_DIR, 'fv-pilot');
const KDIR = resolve(CG_DIR, 'kernels');

const ALLOWED_CLASSES = new Set(['A', 'B', 'C']);

// ── classifyPilotStatus ──────────────────────────────────────────────────────────────────────────
// Pure function: given a pilot record ({tool_id, class, label, kernel_digest_at_authoring}), the CURRENT
// kernel source text (or null if the kernel is gone), and the canonical sourceDigest() function, return
// the derived badge state. Injectable so a self-test can exercise both fresh and stale paths without
// touching disk (mirrors classifyFloor() in check-fv-floor-coverage.mjs).
export async function classifyPilotStatus(record, kernelSource, sourceDigestFn) {
  if (!ALLOWED_CLASSES.has(record.class)) {
    return { tool_id: record.tool_id, badge: false, state: 'invalid-class', reason: `record class "${record.class}" is not one of A/B/C` };
  }
  if (kernelSource == null) {
    return { tool_id: record.tool_id, badge: false, state: 'missing-kernel', reason: `no kernel found for ${record.tool_id}` };
  }
  const current = await sourceDigestFn(kernelSource);
  if (current !== record.kernel_digest_at_authoring) {
    return {
      tool_id: record.tool_id, badge: false, state: 'stale',
      reason: `kernel_digest_at_authoring (${record.kernel_digest_at_authoring}) does not match the kernel as it stands now (${current}) -- the kernel moved since this pilot record was signed off, so the badge is dropped until a human re-verifies and re-authors the record`,
      recorded: record.kernel_digest_at_authoring, current,
    };
  }
  return { tool_id: record.tool_id, badge: true, state: 'fresh', class: record.class, label: record.label, reason: 'kernel_digest_at_authoring matches sourceDigest() of the current kernel' };
}

// ── validateEvidenceVector ───────────────────────────────────────────────────────────────────────
// FV-EVIDENCE-VECTOR-1. Pure shape/existence validator, never a re-execution engine. Every field that
// claims a script must name one, and that script must actually exist in this repo -- a field pointing at
// nothing (a typo, a path in a different repo, an invented gate) fails here. This does NOT re-run the
// named gates and re-derive their counts; it catches fabrication and drift in the vector's own shape, the
// mechanical bar this row's positive control asks for (SO #34: never trust a self-attested value with no
// re-runnable gate). existsFn is injectable so the selftest never touches real disk.
export function validateEvidenceVector(record, { existsFn = existsSync, repoRoot = REPO } = {}) {
  const errors = [];
  const ev = record.evidence_vector;
  if (ev == null || typeof ev !== 'object') {
    return { valid: false, errors: ['evidence_vector is missing or not an object'] };
  }

  const gatePath = (p) => resolve(repoRoot, p);
  function checkGate(path, label) {
    if (typeof path !== 'string' || path.trim() === '') { errors.push(`${label}: gate is missing or not a string`); return; }
    if (!existsFn(gatePath(path))) { errors.push(`${label}: gate "${path}" does not exist in this repo`); }
  }

  if (ev.authoritative_vectors != null) {
    const av = ev.authoritative_vectors;
    if (!Number.isInteger(av.count) || av.count < 0) errors.push('authoritative_vectors.count must be a non-negative integer');
    if (typeof av.source !== 'string' || av.source.trim() === '') errors.push('authoritative_vectors.source must be a non-empty string');
    checkGate(av.gate, 'authoritative_vectors');
  }

  if (ev.oracle_independence != null && !['structural', 'none'].includes(ev.oracle_independence)) {
    errors.push(`oracle_independence must be "structural" or "none", got "${ev.oracle_independence}"`);
  }

  if (ev.metamorphic_relations != null) {
    if (!Array.isArray(ev.metamorphic_relations)) {
      errors.push('metamorphic_relations must be an array');
    } else {
      ev.metamorphic_relations.forEach((rel, i) => {
        if (typeof rel.relation !== 'string' || rel.relation.trim() === '') errors.push(`metamorphic_relations[${i}].relation must be a non-empty string`);
        if (!Number.isInteger(rel.cases) || rel.cases < 0) errors.push(`metamorphic_relations[${i}].cases must be a non-negative integer`);
        if (!Number.isInteger(rel.divergences) || rel.divergences < 0) errors.push(`metamorphic_relations[${i}].divergences must be a non-negative integer`);
        checkGate(rel.gate, `metamorphic_relations[${i}]`);
      });
    }
  }

  if (ev.machine_proof != null) {
    const ALLOWED_KINDS = new Set(['dafny', 'enumeration', 'property+hand-proof']);
    if (!ALLOWED_KINDS.has(ev.machine_proof.kind)) errors.push(`machine_proof.kind must be one of dafny/enumeration/property+hand-proof, got "${ev.machine_proof.kind}"`);
  }

  if (ev.human_signature != null) {
    if (!['signed', 'none'].includes(ev.human_signature.status)) errors.push(`human_signature.status must be "signed" or "none", got "${ev.human_signature.status}"`);
  }

  return { valid: errors.length === 0, errors };
}

// ── deriveFvPilotBadges ──────────────────────────────────────────────────────────────────────────
// Reads every chaingraph/fv-pilot/*.json record, recomputes freshness against the live kernel tree.
// readKernelSource/sourceDigestFn are injectable for testing.
export async function deriveFvPilotBadges(readKernelSource, sourceDigestFn) {
  if (!existsSync(PILOT_DIR)) return [];
  const files = readdirSync(PILOT_DIR).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    const record = JSON.parse(readFileSync(resolve(PILOT_DIR, f), 'utf8'));
    const kernelSource = readKernelSource(record.tool_id);
    const status = await classifyPilotStatus(record, kernelSource, sourceDigestFn);
    status.evidenceVector = validateEvidenceVector(record);
    out.push(status);
  }
  return out.sort((a, b) => a.tool_id.localeCompare(b.tool_id));
}

// ── CLI entry point ──────────────────────────────────────────────────────────────────────────────
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const { sourceDigest } = await import(pathToFileURL(resolve(KDIR, '_buildid.mjs')).href);
  function readKernelSource(tool_id) {
    const p = resolve(KDIR, `${tool_id}.kernel.mjs`);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  }

  const results = await deriveFvPilotBadges(readKernelSource, sourceDigest);
  const fresh = results.filter((r) => r.badge);
  const dropped = results.filter((r) => !r.badge);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
  } else if (process.argv.includes('--list')) {
    for (const r of results) {
      console.log(r.badge ? `  BADGE:   ${r.tool_id} — class ${r.class} — ${r.label}` : `  DROPPED: ${r.tool_id} — ${r.state} — ${r.reason}`);
      console.log(r.evidenceVector?.valid ? `           evidence_vector: valid` : `           evidence_vector: INVALID — ${r.evidenceVector?.errors?.join('; ')}`);
    }
  }
  const evInvalid = results.filter((r) => !r.evidenceVector?.valid);
  console.log(`\nFV pilot badges (4-kernel pilot, distinct from PBT-floor tier) — ${fresh.length}/${results.length} badge-eligible, ${dropped.length} dropped.`);
  console.log(`Evidence vectors — ${results.length - evInvalid.length}/${results.length} valid.`);
  if (evInvalid.length) {
    for (const r of evInvalid) console.error(`  ✗ ${r.tool_id}: ${r.evidenceVector.errors.join('; ')}`);
  }
  // Plain invocation stays informational (exit 0 always, unchanged contract); --check is the CI gate.
  if (process.argv.includes('--check') && evInvalid.length) process.exit(1);
  process.exit(0);
}
