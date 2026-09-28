#!/usr/bin/env node
// gen-trust-signals.mjs — TRUST-SIGNALS-WELLKNOWN-1 (2026-09-28).
//
// Generates .well-known/trust-signals.json: the machine-readable digest of facts
// the site's PUBLIC GATES already compute, published at one URL for third parties
// and trust directories (Tim popup 2026-09-28, "Source-currency feed +
// trust-signals.json"). Every number is READ from a gate, never typed.
//
// ── WHERE EACH NUMBER COMES FROM (the inventory, quoted in the PR) ──────────
//   proof_coverage    check-compute-proof-coverage.mjs — the §18 gate's OWN
//                     exported evaluateCoverage() over chaingraph.json
//                     (no --json flag exists; the exported pure classifier IS
//                     the gate's machine-readable surface).
//   digest_freshness  check-s18-digest-freshness.mjs — the §18 freshness gate's
//                     OWN exported computeStaleness() + chaingraph/kernels/
//                     _buildid.mjs sourceDigest() (the ONE canonical producer),
//                     recomputed live. Not parsed from
//                     s18-digest-freshness-baseline.json: that ratchet carries
//                     only the stale count; the schema publishes {fresh, stale}.
//   determinism       check-kernel-determinism.mjs — run for its exit status
//                     (static_clean), plus scripts/kernel-determinism-allowlist.json
//                     (transcendentals.files count → allowlisted).
//   anchors.sigsum    registry/lineage/checkpoint.sigsum-record.json — the
//                     LATEST published lineage anchor (the register-sigsum
//                     fixture is the 2026-08 registration record, leaf 59524;
//                     the published lineage checkpoint is the current one).
//   anchors.rekor     scripts/register-rekor.fixtures.json — the tracked copy
//                     of the real Rekor record (the only Rekor record in the
//                     repo, verified 2026-09-28).
//   citation_drift    scripts/citation-drift-baseline.json (known_findings).
//   conformance_corpus ocg-conformance/vectors/manifest.json (version + vectors).
//
// ── SINGLE WRITER (SO #35 doctrine, same shape as sitemap.xml) ──────────────
// The file is a SHARED DERIVED ARTIFACT: COVERED id 'trust-signals' in
// scripts/derived-artifacts.mjs; derived-artifacts-regen.yml regenerates it on
// main after every merge. A PR must NOT regenerate it — its `--check` freshness
// gate is advisory on a PR (generic ADVISORY_ON_PR downgrade) and blocking on
// main. `--check` byte-compares the committed file against a fresh generation.
//
// ── WHY `commit` IS NOT LITERALLY `git rev-parse HEAD` ─────────────────────
// This workflow re-triggers on its own bot commits (on: push: main), and its
// fixpoint is "regenerate → zero drift → skip the commit" (derived-artifacts.mjs
// header, filter (b) IDEMPOTENT). An artifact embedding the sha of the commit
// that CONTAINS it can never reach that fixpoint: at the bot commit C the
// regenerated file would name C, drift, and mint C' — forever. So the digest is
// anchored to the most recent commit that is NOT the mechanical
// "chore(derived): regenerate shared derived artifacts on main" bot commit —
// the main commit whose tree the facts actually describe (bot commits only
// rewrite derived bytes). generated_at is that commit's committer timestamp,
// not the wall clock, for the same idempotency doctrine. On main this equals
// HEAD in the stable state; check-trust-signals.mjs asserts exactly that
// equivalence (HEAD, or HEAD^ when HEAD is the bot commit).
//
// Usage:
//   node scripts/gen-trust-signals.mjs           # write .well-known/trust-signals.json
//   node scripts/gen-trust-signals.mjs --check   # byte-compare, exit 1 if stale (the COVERED gate)
//
// Self-test: scripts/check-trust-signals.test.mjs (drives the exported pure
// functions — pickFactCommit, assembleDocument, sigsumSignal, rekorSignal,
// proofCoverageSignal — over in-memory fixtures, plus the REAL emitted file
// against the REAL schema; SO #40b pairing).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { evaluateCoverage } from './check-compute-proof-coverage.mjs';
import { computeStaleness } from './check-s18-digest-freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUT_PATH = resolve(REPO, '.well-known', 'trust-signals.json');
export const SCHEMA_ID = 'ainumbers.co/trust-signals/v1';

export const VERIFY_HOW =
  'Every number in this file is computed by the public gate scripts in this repository — ' +
  'scripts/check-compute-proof-coverage.mjs, scripts/check-s18-digest-freshness.mjs, ' +
  'scripts/check-kernel-determinism.mjs, registry/lineage/checkpoint.sigsum-record.json, ' +
  'scripts/register-rekor.fixtures.json, scripts/citation-drift-baseline.json and ' +
  'ocg-conformance/vectors/manifest.json — and re-derived by scripts/gen-trust-signals.mjs, ' +
  'which regenerates this file on main after every merge.';

// The regen bot's commit subject (derived-artifacts-regen.yml's `-m` line). A
// commit with this subject carries ONLY regenerated derived bytes, so it is
// never the commit the FACTS describe. Kept in sync with the workflow by the
// paired test, which asserts the exact workflow text matches this pattern.
export const BOT_COMMIT_SUBJECT = 'chore(derived): regenerate shared derived artifacts on main';

/** Pure: pick the fact-commit line out of `git log --format=%H%x01%cI%x01%s` output.
 *  Returns { commit, generatedAt } for the newest commit whose subject is NOT the
 *  regen bot's. Throws when the log is exhausted (all-bot history = wiring bug). */
export function pickFactCommit(logText) {
  for (const line of String(logText).split('\n')) {
    if (!line.trim()) continue;
    const [sha, date, subject] = line.split('\x01');
    if (subject === BOT_COMMIT_SUBJECT) continue;
    if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error(`gen-trust-signals: unparsable git log line: ${JSON.stringify(line.slice(0, 90))}`);
    // UTC seconds precision — byte-stable at a fixed commit (derived-artifacts
    // idempotency doctrine (b); wall clock would churn the bot's commit step).
    const generatedAt = new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');
    return { commit: sha, generatedAt };
  }
  throw new Error('gen-trust-signals: every commit in the log window is a chore(derived) bot commit — refusing to anchor the digest to nothing');
}

function gitLog() {
  return execFileSync('git', ['log', '-n', '50', '--format=%H%x01%cI%x01%s'], {
    cwd: REPO, env: gitEnv(), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
}

// ── signal collectors (thin: read a gate's own output, nothing else) ────────
export function proofCoverageSignal(chaingraph) {
  const { gpuFalse, proven } = evaluateCoverage(chaingraph);
  return { covered: proven.length, total: gpuFalse.length };
}

export function digestFreshnessSignal(staleness) {
  return { fresh: staleness.fresh.length, stale: staleness.stale.length };
}

export function determinismSignal(allowlist, kernelGateStatus) {
  const files = allowlist?.transcendentals?.files;
  if (!Array.isArray(files)) throw new Error('gen-trust-signals: kernel-determinism-allowlist.json has no transcendentals.files[] — cannot publish `allowlisted`');
  return { static_clean: kernelGateStatus === 0, allowlisted: files.length };
}

export function sigsumSignal(record) {
  const leafIndex = record?.inclusion_proof?.leaf_index;
  const cosigners = Array.isArray(record?.witness_cosignatures) ? record.witness_cosignatures.length : undefined;
  if (!Number.isInteger(leafIndex) || !Number.isInteger(cosigners)) {
    throw new Error('gen-trust-signals: sigsum anchor record lacks inclusion_proof.leaf_index or witness_cosignatures[]');
  }
  return { latest_leaf: leafIndex, cosigners };
}

export function rekorSignal(record) {
  const uuid = record?.uuid;
  // Rekor entry UUIDs are 64 hex (classic leaf-hash) or 80 hex (newer
  // transparent-entry format) — measured on the published record 2026-09-28.
  if (typeof uuid !== 'string' || !/^[0-9a-f]{64,128}$/.test(uuid)) {
    throw new Error('gen-trust-signals: rekor record lacks a 64-128 hex uuid — cannot publish `latest_entry`');
  }
  return { latest_entry: uuid };
}

export function citationDriftSignal(baseline) {
  const n = baseline?.known_findings;
  if (!Array.isArray(n)) throw new Error('gen-trust-signals: citation-drift-baseline.json lacks known_findings[]');
  return { baseline: n.length };
}

export function conformanceCorpusSignal(manifest) {
  if (!Array.isArray(manifest?.vectors) || typeof manifest?.version !== 'string') {
    throw new Error('gen-trust-signals: ocg-conformance/vectors/manifest.json lacks version or vectors[]');
  }
  return { vectors: manifest.vectors.length, manifest_version: manifest.version };
}

/** Pure: assemble the document. The ONLY place the published shape exists. */
export function assembleDocument({ generatedAt, commit, signals }) {
  return {
    schema: SCHEMA_ID,
    generated_at: generatedAt,
    commit,
    signals,
    verify: { how: VERIFY_HOW },
  };
}

/** Run every live collector against the real repo, in the COVERED order's
 *  guarantees (chaingraph.json is assembled before this entry runs main-side). */
async function collectSignals() {
  const chaingraph = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  const { sourceDigest } = await import(pathToFileURL(resolve(REPO, 'chaingraph', 'kernels', '_buildid.mjs')).href);

  // Kernel sources for the freshness recompute — the same loader loop the
  // freshness gate's own CLI block runs (it is deliberately not exported; the
  // CLASSIFICATION below still comes from the gate's exported computeStaleness).
  const liveGpuFalse = (chaingraph.nodes ?? []).filter((n) => n.status === 'live' && n.gpu === false);
  const kernelSources = {};
  for (const n of liveGpuFalse) {
    try {
      kernelSources[n.tool_id] = readFileSync(resolve(REPO, 'chaingraph', 'kernels', `${n.tool_id}.kernel.mjs`), 'utf8');
    } catch { /* absent file = NO_KERNEL_FILE, exactly as the gate classifies it */ }
  }
  const staleness = await computeStaleness(chaingraph, kernelSources, sourceDigest);
  // The gate refuses to report staleness when its own calibration fails (zero
  // fresh out of a non-empty scope means the instrument, not the estate, is
  // broken). The generator refuses for the same reason — never publish numbers
  // a broken instrument produced.
  if (staleness.total > 0 && staleness.fresh.length === 0) {
    console.error('✗ gen-trust-signals: CALIBRATION FAILED — zero nodes recomputed as fresh out of ' + staleness.total + '.');
    console.error('  The digest-freshness instrument is unsound; refusing to publish its numbers. See the gate (S18-DIGEST-GATE-1).');
    process.exit(1);
  }

  // static_clean is MEASURED, not assumed: run the hard lint for its exit status.
  const det = spawnSync(process.execPath, [resolve(HERE, 'check-kernel-determinism.mjs')], {
    cwd: REPO, env: gitEnv(), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (det.status !== 0) {
    console.error('✗ gen-trust-signals: check-kernel-determinism.mjs is RED — refusing to publish a trust digest from a red estate.');
    if (det.stdout) process.stdout.write(det.stdout);
    if (det.stderr) process.stderr.write(det.stderr);
    process.exit(1);
  }

  return {
    proof_coverage: proofCoverageSignal(chaingraph),
    digest_freshness: digestFreshnessSignal(staleness),
    determinism: determinismSignal(
      JSON.parse(readFileSync(resolve(HERE, 'kernel-determinism-allowlist.json'), 'utf8')),
      det.status,
    ),
    anchors: {
      sigsum: sigsumSignal(JSON.parse(readFileSync(resolve(REPO, 'registry', 'lineage', 'checkpoint.sigsum-record.json'), 'utf8'))),
      rekor: rekorSignal(JSON.parse(readFileSync(resolve(HERE, 'register-rekor.fixtures.json'), 'utf8')).prov_scitt_register_1_record),
    },
    citation_drift: citationDriftSignal(JSON.parse(readFileSync(resolve(HERE, 'citation-drift-baseline.json'), 'utf8'))),
    conformance_corpus: conformanceCorpusSignal(JSON.parse(readFileSync(resolve(REPO, 'ocg-conformance', 'vectors', 'manifest.json'), 'utf8'))),
  };
}

export function renderDocument(doc) {
  return JSON.stringify(doc, null, 2) + '\n';
}

// ── CLI (only when executed directly) ────────────────────────────────────────
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const CHECK = process.argv.includes('--check');
  const { commit, generatedAt } = pickFactCommit(gitLog());
  const rendered = renderDocument(assembleDocument({ generatedAt, commit, signals: await collectSignals() }));

  if (CHECK) {
    let onDisk = null;
    try { onDisk = readFileSync(OUT_PATH, 'utf8'); } catch { /* missing = stale */ }
    if (onDisk !== rendered) {
      console.error('✗ gen-trust-signals --check: .well-known/trust-signals.json is STALE (single-writer main regen owns the rewrite — SO #35).');
      console.error('  Expected commit anchor ' + commit + ' @ ' + generatedAt + '. Advisory on a PR, blocking on main; derived-artifacts-regen.yml repairs it after merge.');
      process.exit(1);
    }
    console.log('✓ .well-known/trust-signals.json fresh (anchored at ' + commit.slice(0, 12) + ').');
    process.exit(0);
  }

  writeFileSync(OUT_PATH, rendered);
  const s = JSON.parse(rendered).signals;
  console.log(`✓ wrote .well-known/trust-signals.json @ ${commit.slice(0, 12)} — ` +
    `proof ${s.proof_coverage.covered}/${s.proof_coverage.total}, digest ${s.digest_freshness.fresh}/${s.digest_freshness.fresh + s.digest_freshness.stale} fresh, ` +
    `determinism ${s.determinism.static_clean ? 'clean' : 'RED'} (${s.determinism.allowlisted} allowlisted), ` +
    `sigsum leaf ${s.anchors.sigsum.latest_leaf} (${s.anchors.sigsum.cosigners} cosigners), citation-drift baseline ${s.citation_drift.baseline}, ` +
    `corpus ${s.conformance_corpus.vectors} vectors @ ${s.conformance_corpus.manifest_version}.`);
}
