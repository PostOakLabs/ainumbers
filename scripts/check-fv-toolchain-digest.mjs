#!/usr/bin/env node
// scripts/check-fv-toolchain-digest.mjs — FVLEG-DIGEST-CONSUMER-1
//
// THE DEFECT THIS CLOSES (research/FV-TRIPLEBIND-MUTATE-1-2026-08-11.md, cell 3c):
// `toolchain_digest.fv_leg` — the 8 Dafny/Z3 toolchain sub-digests on a class-C FV artifact
// (today: only research/FV-C1-REGZ-APR.artifact.json) — is recorded but was never consumed by
// any checker anywhere. A mutation-test row flipped a byte in each of the other legs
// (kernel_digest, spec_digest, zk image_id/journal) and every one of them FAILED loudly; the
// fv_leg mutation had "no command exists" to catch it. That is the gate-name-theater shape:
// the field asserts a binding it does not enforce.
//
// WHAT THIS CHECKS: every artifact under workspace-root `research/` whose `toolchain_digest` is
// an OBJECT carrying an `fv_leg` sub-object (content-detected — class-A/B artifacts'
// `toolchain_digest` is a plain string or a harness-only object with no `fv_leg`, and are
// correctly not this checker's business; no filename allowlist).
//
// Of the 8 recorded fv_leg sub-digests, THREE are in-repo and content-addressable, and this
// script actually recomputes and compares them (never just displays them — SO #34):
//   model_digest          sha256 of fv_leg.model_file (explicit field on the artifact)
//   compiled_js_digest    sha256 of the `-o <file>` target named in verification_run.compile_command,
//                         resolved next to model_file (the artifact's own reproduce[] runs the
//                         compile command from that directory)
//   harness_digest        sha256 of the `*.harness.mjs` path named in the artifact's own reproduce[]
// The other FIVE need an artifact this checkout does not and structurally cannot contain — a
// locally-installed Dafny/Z3 binary, or a network fetch of the Dafny release zip — and are
// graded NOT_EVALUABLE, never silently passed (SO #34c, "absence is not a pass"):
//   dafny_exe_sha256, dafny_core_dll_sha256,
//   z3_4_12_1_sha256, z3_4_14_1_sha256          NOT_EVALUABLE-PREMISE — the toolchain binary is
//                                                out-of-repo; independently verifying it is
//                                                FV-REBUILD-FRESH-1's territory (prover repo,
//                                                private, a different fence), not this gate's.
//   release_zip_sha256                          NOT_EVALUABLE-NETWORK — this gate never fetches
//                                                the network (site zero-egress doctrine, see
//                                                check-verify-no-egress.mjs / check-site-egress.mjs).
//
// Verdict tokens are the enum-v2 vocabulary at workspace-root `board/row-state-enum.json` (SSOT).
// This script hardcodes the literal token strings rather than importing that file, because it
// must also run from a bare `ainumbers` checkout with no sibling `board/` directory (e.g. CI, or
// a clone of this repo with no surrounding workspace) — same reason
// scripts/assert-checkout-freshness.mjs states for doing the same thing.
//
// Usage:
//   node scripts/check-fv-toolchain-digest.mjs                 scan workspace-root research/, print + exit 0
//   node scripts/check-fv-toolchain-digest.mjs --check          exit 1 on any MISMATCH (NOT_EVALUABLE
//                                                                never fails --check — it is a distinct
//                                                                state, not a pass or a fail, SO #34c)
//   node scripts/check-fv-toolchain-digest.mjs --file <path>    check exactly one artifact.json (used by
//                                                                the selftest and for scratch-copy mutation
//                                                                testing per SO #40b, never the real file)
//   node scripts/check-fv-toolchain-digest.mjs --json <out>     also write the full result set as JSON

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

// ── verdict tokens (SSOT: workspace-root board/row-state-enum.json — hardcoded, see header) ──
export const MATCH = 'MATCH';
export const MISMATCH = 'MISMATCH';
export const NOT_EVALUABLE = 'NOT_EVALUABLE';
export const NOT_EVALUABLE_PREMISE = 'NOT_EVALUABLE-PREMISE';
export const NOT_EVALUABLE_NETWORK = 'NOT_EVALUABLE-NETWORK';

export const RECOMPUTABLE_FIELDS = ['model_digest', 'compiled_js_digest', 'harness_digest'];
export const DAFNY_TOOLCHAIN_FIELDS = ['dafny_exe_sha256', 'dafny_core_dll_sha256', 'z3_4_12_1_sha256', 'z3_4_14_1_sha256'];
export const NETWORK_FIELDS = ['release_zip_sha256'];
// The full 8-field set fv_leg's header comment (and FV-TRIPLEBIND-MUTATE-1) names.
export const ALL_FV_LEG_DIGEST_FIELDS = [...RECOMPUTABLE_FIELDS, ...DAFNY_TOOLCHAIN_FIELDS, ...NETWORK_FIELDS];

export function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }
export function stripPrefix(d) { return typeof d === 'string' ? d.toLowerCase().replace(/^sha256:/, '') : d; }

// content-detected: is this artifact in this checker's scope at all?
export function hasFvLeg(record) {
  return !!(record && typeof record === 'object' && record.toolchain_digest && typeof record.toolchain_digest === 'object' && !Array.isArray(record.toolchain_digest) && record.toolchain_digest.fv_leg && typeof record.toolchain_digest.fv_leg === 'object');
}

// Pure, no disk IO: derive the absolute source-file path for each recomputable field from the
// artifact's OWN content (model_file field / compile_command's -o target / reproduce[]'s
// *.harness.mjs mention) — never a guessed filename, per the estate's derive-don't-allowlist
// convention (check-fv-attestation-staleness.mjs's header states the same rule).
export function deriveFvLegSources(record, workspaceRoot) {
  const fvLeg = record?.toolchain_digest?.fv_leg || {};
  const sources = {};

  if (typeof fvLeg.model_file === 'string') {
    sources.model_digest = path.resolve(workspaceRoot, fvLeg.model_file);
  }

  const compileCmd = record?.verification_run?.compile_command;
  if (typeof compileCmd === 'string' && sources.model_digest) {
    const m = compileCmd.match(/-o\s+(\S+)/);
    if (m) sources.compiled_js_digest = path.resolve(path.dirname(sources.model_digest), m[1]);
  }

  if (Array.isArray(record.reproduce)) {
    for (const line of record.reproduce) {
      if (typeof line !== 'string') continue;
      const m = line.match(/(\S+\.harness\.mjs)/);
      if (m) { sources.harness_digest = path.resolve(workspaceRoot, m[1]); break; }
    }
  }

  return sources;
}

// Pure given injected fs functions — this is what the selftest exercises without touching disk.
export function classifyFvLegField(field, recordedRaw, sourcePath, { existsFn = existsSync, readFileFn = readFileSync, sha256Fn = sha256 } = {}) {
  const recorded = stripPrefix(recordedRaw);
  if (typeof recorded !== 'string' || !/^[0-9a-f]{64}$/i.test(recorded)) {
    return { field, verdict: NOT_EVALUABLE, subcode: NOT_EVALUABLE_PREMISE, reason: `recorded value is not a well-formed sha256 hex digest: ${JSON.stringify(recordedRaw)}` };
  }

  if (RECOMPUTABLE_FIELDS.includes(field)) {
    if (!sourcePath) {
      return { field, verdict: NOT_EVALUABLE, subcode: NOT_EVALUABLE_PREMISE, reason: "could not derive a source file path from the artifact's own content (model_file / verification_run.compile_command / reproduce[])", recorded };
    }
    if (!existsFn(sourcePath)) {
      return { field, verdict: NOT_EVALUABLE, subcode: NOT_EVALUABLE_PREMISE, reason: `derived source file not found: ${sourcePath}`, recorded, source: sourcePath };
    }
    const current = sha256Fn(readFileFn(sourcePath));
    return current === recorded
      ? { field, verdict: MATCH, recorded, current, source: sourcePath }
      : { field, verdict: MISMATCH, recorded, current, source: sourcePath, reason: 'recomputed digest does not match the recorded value' };
  }

  if (DAFNY_TOOLCHAIN_FIELDS.includes(field)) {
    return { field, verdict: NOT_EVALUABLE, subcode: NOT_EVALUABLE_PREMISE, recorded, reason: 'toolchain binary is out-of-repo (no locally-installed Dafny/Z3 this checkout can read); independent verification is FV-REBUILD-FRESH-1 territory (prover repo, private, a different fence), not this gate\'s' };
  }

  if (NETWORK_FIELDS.includes(field)) {
    return { field, verdict: NOT_EVALUABLE, subcode: NOT_EVALUABLE_NETWORK, recorded, reason: 'verifying this field requires fetching release_source over the network; this gate never makes network calls (site zero-egress doctrine)' };
  }

  return { field, verdict: NOT_EVALUABLE, subcode: NOT_EVALUABLE_PREMISE, recorded, reason: 'field is not one of the known 8 fv_leg digest fields' };
}

// Orchestrates the two pure layers above for one artifact record.
export function checkFvLegArtifact(record, workspaceRoot, fsFns = {}) {
  const fvLeg = record?.toolchain_digest?.fv_leg || {};
  const sources = deriveFvLegSources(record, workspaceRoot);
  const results = [];
  for (const field of ALL_FV_LEG_DIGEST_FIELDS) {
    if (!(field in fvLeg)) continue; // not every fv_leg carries every field; never invent one
    results.push(classifyFvLegField(field, fvLeg[field], sources[field], fsFns));
  }
  return results;
}

// ---------- workspace-root discovery + directory walk (CLI-only, real disk) ----------

function findWorkspaceRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const parent = path.resolve(dir, '..');
    if (existsSync(path.join(parent, 'research')) && existsSync(path.join(parent, 'CLAUDE.md'))) return parent;
    if (parent === dir) break;
    dir = parent;
  }
  return null; // bare checkout — no sibling workspace (CI, or a clone with nothing around it)
}

function walkJsonFiles(dir) {
  let out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walkJsonFiles(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

// ---------- CLI entry point ----------

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const singleFile = fileIdx !== -1 ? args[fileIdx + 1] : null;
  const jsonIdx = args.indexOf('--json');
  const jsonOut = jsonIdx !== -1 ? args[jsonIdx + 1] : null;
  const CHECK = args.includes('--check');

  const workspaceRoot = findWorkspaceRoot(REPO);

  let files;
  if (singleFile) {
    files = [path.resolve(singleFile)];
  } else if (!workspaceRoot) {
    console.log('No sibling workspace root found (bare checkout, e.g. CI) — nothing to scan. --file <path> still works standalone.');
    process.exit(0);
  } else {
    files = walkJsonFiles(path.join(workspaceRoot, 'research'));
  }

  const rootForResolve = singleFile ? (workspaceRoot || path.dirname(singleFile)) : workspaceRoot;

  console.log('=== FVLEG-DIGEST-CONSUMER-1 run report ===');
  let scanned = 0;
  let inScope = 0;
  const allResults = [];

  for (const f of files.sort()) {
    let record;
    try {
      record = JSON.parse(readFileSync(f, 'utf8'));
    } catch (e) {
      if (singleFile) { console.error(`PARSE-FAILED: ${f}: ${e.message}`); process.exit(2); }
      continue; // not every .json under research/ is even meant to parse as an artifact record
    }
    scanned++;
    if (!hasFvLeg(record)) continue;
    inScope++;
    const results = checkFvLegArtifact(record, rootForResolve);
    console.log(`\n[${path.relative(rootForResolve, f)}] toolchain_digest.fv_leg — ${results.length} field(s) checked`);
    for (const r of results) {
      console.log(`  [${r.verdict}${r.subcode ? ` ${r.subcode}` : ''}] ${r.field}${r.source ? ` (${path.relative(rootForResolve, r.source)})` : ''}`);
      if (r.reason) console.log(`      ${r.reason}`);
      if (r.verdict === MISMATCH) console.log(`      recorded=${r.recorded}  current=${r.current}`);
    }
    allResults.push({ file: path.relative(rootForResolve, f), results });
  }

  const flat = allResults.flatMap((a) => a.results);
  const match = flat.filter((r) => r.verdict === MATCH);
  const mismatch = flat.filter((r) => r.verdict === MISMATCH);
  const notEvaluable = flat.filter((r) => r.verdict === NOT_EVALUABLE);

  console.log('\n--- summary ---');
  console.log(`artifacts scanned: ${scanned} · in scope (toolchain_digest.fv_leg present): ${inScope}`);
  console.log(`fields — MATCH: ${match.length} · MISMATCH: ${mismatch.length} · NOT_EVALUABLE: ${notEvaluable.length}`);
  if (mismatch.length) {
    console.log(`⛔ MISMATCH — recorded fv_leg digest no longer matches the source it claims to bind: ${mismatch.map((r) => r.field).join(', ')}`);
    console.log('  Report this as a finding (SO #25) — do NOT re-stamp the digest to make it pass.');
  }
  console.log(`NOT_EVALUABLE is never counted as a pass (SO #34c) — it means "out-of-repo, unverifiable here", not "verified".`);

  if (jsonOut) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(jsonOut, JSON.stringify(allResults, null, 2));
  }

  process.exitCode = CHECK && mismatch.length > 0 ? 1 : 0;
}
