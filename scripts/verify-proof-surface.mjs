#!/usr/bin/env node
// verify-proof-surface.mjs — GATE for the v0.5 §16 mass rollout (no-drift across ~925 pages).
// Companion to WAVE-V0.5-MASS-ROLLOUT-SPEC.md §5. Asserts that every ARTIFACT-EMITTING page carries a
// correct, non-drifting §16 Proof Binding surface. This is the page-level analogue of the SSOT
// spec-version-consistency.mjs gate: one pinned source (the inline _proof block) + a sweep that proves
// every page matches it.
//
// An "emitter" page = one that produces an artifact, identified by the inline `OCG-CANON v1` sentinel
// (the §4 canonicalizer). Only emitters can sign, so only emitters are required to carry the §16 surface.
// Non-emitter pages (pure hubs/index/guides) are reported separately and only checked for a stale
// spec_version label.
//
// Per emitter, REQUIRE:
//   (a) declares spec_version '0.5.0' (and NOT a 0.4.x spec_version field)
//   (b) still declares chaingraph_version '0.4.0'         (§16 MUST NOT bump the envelope tag)
//   (c) carries an `OCG-PROOF v1` sentinel block byte-identical to the pinned inline form
//   (d) the OCG-PROOF block appears AFTER the OCG-CANON block (it depends on __ocgCanon)
//   (e) has signArtifactBtn + verifySigBtn in markup AND both wired into the button-enable id array
//
// Pinned source of truth for (c): chaingraph/kernels/_proof.inline.min.js — the single minified inline
// build of kernels/_proof.mjs that the rollout injector stamps into every page. Gate and injector read
// the SAME file, so a page can never drift from the kernel. (The injector is responsible for keeping the
// pin byte-equal to _proof.mjs; a separate kernel test asserts that. Here we only enforce page == pin.)
//
// Zero-dependency. Strict: any non-conformant emitter => exit 1. Pre-rollout this is EXPECTED to be red
// (no page carries the block yet) — that is the gate the rollout turns green, batch by batch.
//
// Usage:
//   node scripts/verify-proof-surface.mjs              strict (CI): exit 1 on any non-conformant emitter
//   node scripts/verify-proof-surface.mjs --summary    counts only (emitters / conformant / missing), exit 0
//   node scripts/verify-proof-surface.mjs --list-missing   print every emitter still missing the §16 surface
//   node scripts/verify-proof-surface.mjs --chains-only    strict only over chaingraph/chains/ (Phase 1 CI gate)

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');                                  // repo/
const SUMMARY = process.argv.includes('--summary');
const LIST_MISSING = process.argv.includes('--list-missing');
const CHAINS_ONLY = process.argv.includes('--chains-only');

// Phase 0 laggards: chains that have OCG-CANON v1 but are not yet on the engagement template
// (missing exportVCBtn / buildArtifact). They qualify for the gate's emitter scan but are excluded
// from Phase 1's strict check because they are Phase 0 scope. Remove each entry once Phase 0 lands.
const PHASE0_LAGGARDS = new Set([
  // (empty) — agentic-policy.html §16 hand-port landed 2026-06-25; the gate now covers 100% of
  // emitters with no carve-out. Re-add only if a new custom-runtime laggard appears.
]);

// ── page roots (re-verify counts at build time; never trust hardcoded numbers) ───────────────────
// --chains-only scopes the strict check to chaingraph/chains/ only (Phase 1 CI gate;
// non-chains emitters are Phase 2/3 scope and expected-missing until those phases land).
const PAGE_DIRS = CHAINS_ONLY
  ? [join(ROOT, 'chaingraph', 'chains')]
  : ['tools', 'guides', 'chaingraph'].map((d) => join(ROOT, d));
const PIN = join(ROOT, 'chaingraph', 'kernels', '_proof.inline.min.js');

// ── sentinels (must match the injector exactly) ──────────────────────────────────────────────────
const CANON_SENTINEL = 'OCG-CANON v1';
const PROOF_OPEN = '/* OCG-PROOF v1';        // line-comment header the injector writes
const PROOF_MARK = 'OCG-PROOF v1';
const REQUIRED_BTNS = ['signArtifactBtn', 'verifySigBtn'];

function walkHtml(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkHtml(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

// Extract the inline OCG-PROOF block body (between its <script> open-comment and the closing </script>).
// Returns the trimmed block text, or null if absent.
function extractProofBlock(html) {
  const i = html.indexOf(PROOF_OPEN);
  if (i === -1) return null;
  const scriptClose = html.indexOf('</script>', i);
  if (scriptClose === -1) return null;
  // back up to the opening <script> that precedes the comment
  const scriptOpen = html.lastIndexOf('<script', i);
  if (scriptOpen === -1) return null;
  const inner = html.slice(html.indexOf('>', scriptOpen) + 1, scriptClose);
  return inner.trim();
}

// Normalize whitespace so trivial reflow differences don't false-positive, while real drift still fails.
const norm = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n').trim();

if (!existsSync(PIN)) {
  console.error(`FATAL: pinned inline not found at ${relative(ROOT, PIN)}`);
  console.error('       The rollout injector must build kernels/_proof.inline.min.js (minified _proof.mjs)');
  console.error('       before this gate can verify pages against it. See WAVE-V0.5-MASS-ROLLOUT-SPEC.md §3b.');
  process.exit(2);
}
const PIN_BODY = norm(readFileSync(PIN, 'utf8'));

const files = PAGE_DIRS.flatMap((d) => walkHtml(d));
let emitters = 0, conformant = 0;
const missing = [];     // emitter pages lacking/incorrect §16 surface
const labelStale = [];  // any page still declaring a 0.4.x spec_version field
const problems = [];    // detailed per-file reasons

for (const f of files) {
  const html = readFileSync(f, 'utf8');
  const rel = relative(ROOT, f);

  // stale label check (all pages): a spec_version field still on 0.4.x
  if (/spec_version['"]?\s*[:=]\s*['"]0\.4\.[0-9]+['"]/.test(html)) labelStale.push(rel);

  const isEmitter = html.includes(CANON_SENTINEL);
  if (!isEmitter) continue;                // non-emitter → no §16 surface required
  // In --chains-only mode, skip Phase 0 laggards (not yet on engagement template; Phase 0 scope).
  if (CHAINS_ONLY && PHASE0_LAGGARDS.has(basename(f))) continue;
  emitters++;

  const reasons = [];

  // (a) spec_version 0.5.0
  if (!/spec_version['"]?\s*[:=]\s*['"]0\.5\.0['"]/.test(html)) reasons.push('no spec_version 0.5.0');
  // (b) chaingraph_version still 0.4.0
  if (!/chaingraph_version['"]?\s*[:=]\s*['"]0\.4\.0['"]/.test(html)) reasons.push('chaingraph_version not 0.4.0 (MUST stay 0.4.0)');

  // (c) + (d) OCG-PROOF block present, matches pin, after canon
  const block = extractProofBlock(html);
  if (!block) {
    reasons.push('no OCG-PROOF v1 block');
  } else {
    if (norm(block) !== PIN_BODY) reasons.push('OCG-PROOF block drifted from pinned _proof.inline.min.js');
    const canonAt = html.indexOf(CANON_SENTINEL);
    const proofAt = html.indexOf(PROOF_MARK);
    if (canonAt > proofAt) reasons.push('OCG-PROOF block precedes OCG-CANON (ordering invariant violated)');
  }

  // (e) both buttons present; signArtifactBtn ALSO wired into the enable id array (verifySigBtn is
  //     intentionally always-on — verification needs no completed run — so it is NOT required in the array).
  for (const b of REQUIRED_BTNS) {
    if (!html.includes(`id="${b}"`) && !html.includes(`id='${b}'`)) reasons.push(`missing button #${b}`);
  }
  if ((html.includes('id="signArtifactBtn"') || html.includes("id='signArtifactBtn'"))) {
    const sansId = html.replace(/id=["']signArtifactBtn["']/g, '');
    if (!/['"]signArtifactBtn['"]/.test(sansId)) reasons.push('#signArtifactBtn not wired into the button-enable id array');
  }

  if (reasons.length === 0) conformant++;
  else { missing.push(rel); problems.push({ rel, reasons }); }
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────
console.log(`verify-proof-surface · ${files.length} HTML pages scanned`);
console.log(`  emitters (carry OCG-CANON): ${emitters}`);
console.log(`  §16-conformant emitters    : ${conformant}`);
console.log(`  emitters missing §16       : ${missing.length}`);
console.log(`  pages with stale 0.4.x spec_version label: ${labelStale.length}`);

if (LIST_MISSING) { console.log('\nemitters missing §16 surface:'); for (const m of missing) console.log('  · ' + m); }

if (SUMMARY) process.exit(0);

if (problems.length) {
  console.error('\n✗ non-conformant emitters:');
  for (const p of problems.slice(0, 50)) console.error(`  ✗ ${p.rel}\n      ${p.reasons.join('; ')}`);
  if (problems.length > 50) console.error(`  … and ${problems.length - 50} more`);
}
if (labelStale.length) {
  console.error(`\n✗ ${labelStale.length} page(s) still declare a 0.4.x spec_version (label bump missed) — first 20:`);
  for (const s of labelStale.slice(0, 20)) console.error('  ✗ ' + s);
}

const failed = problems.length > 0 || labelStale.length > 0;
console.log(failed ? `\n✗ proof-surface gate RED — ${problems.length} emitter(s) + ${labelStale.length} stale label(s)`
                   : `\n✓ proof-surface gate GREEN — all ${emitters} emitters carry the §16 surface; no stale labels`);
process.exit(failed ? 1 : 0);
