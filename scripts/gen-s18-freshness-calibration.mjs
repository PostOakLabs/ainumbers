#!/usr/bin/env node
// gen-s18-freshness-calibration.mjs — S18-FRESHNESS-DURABLE-FIX-1 (mechanism b).
//
// The canonical WRITER of scripts/s18-freshness-calibration.json — the §18
// digest-freshness DESCRIPTIVE calibration {total, fresh, stale} over the
// committed estate. The numbers check-s18-digest-freshness.test.mjs asserts
// against are a DERIVED ARTIFACT the main-side regen owns and refreshes in the
// SAME bot commit that splices chaingraph.json — not hand-typed literals that
// sit one behind on every prove landing. That hand calibration is measured, not
// hypothetical: the self-test went red twice on regen-bot commits on
// 2026-09-17 alone ("expected 645 in-scope gpu:false proven nodes, got 646",
// Land Verify run 35280558768 on afcf565d; same shape on c6df18f0), each time
// healed by a human denominator edit (#1923, MAIN-HEAL-S18-FRESHNESS-118-2).
//
// ONE CANONICALIZATION (the _buildid.mjs rule): the counts are computed by
// computeStaleness() IMPORTED from the production gate
// check-s18-digest-freshness.mjs, over sourceDigest() from
// chaingraph/kernels/_buildid.mjs — the same two functions the gate itself
// uses. This script never recomputes a digest, never re-implements the
// in-scope filter (status === 'live' && gpu === false with a receipt), and
// never keeps a second copy of either. A second canonicalization here would be
// the exact false-positive failure mode that produced four-plus disputed
// findings on this project (see the gate's header).
//
// ⚖ SCOPE GUARD — THE RATCHET CEILING IS NOT THIS FILE'S BUSINESS. This
// artifact is DESCRIPTIVE ONLY. The CEILING
// (scripts/s18-digest-freshness-baseline.json, stale: 133, counts only go
// DOWN, `--update-baseline` the sole sanctioned tightener) is NOT regen-owned
// and is never written here — the regen can never launder a staleness
// regression through it, and ratchet-baseline.mjs's hard-failing loader keeps
// guarding it exactly as S18-DIGEST-GATE-1 defined. A staleness EVENT (a
// kernel edited without a re-prove, stale count +1) still reds the self-test
// until the canonical writer is re-run and the moved node is NAMED in the
// commit — the writer only ever publishes what the tree computes.
//
// Writers: derived-artifacts-regen.yml on main (COVERED id
// 's18-freshness-calibration' in scripts/derived-artifacts.mjs, ordered after
// 'chaingraph-assemble' — the counts are computed from the monolith that
// assemble-chaingraph.mjs writes in the same pass), and a human running
// --write locally for a staleness event. Idempotent by construction: a pure
// function of the committed tree, no wall clock, no network — a second pass
// over an unchanged tree is byte-identical and writes nothing.
//
// Usage:
//   node scripts/gen-s18-freshness-calibration.mjs --write   # recompute; write only on drift
//   node scripts/gen-s18-freshness-calibration.mjs --check   # verify the committed artifact matches

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computeStaleness } from './check-s18-digest-freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CG_PATH = resolve(REPO, 'chaingraph', 'chaingraph.json');
const KDIR = resolve(REPO, 'chaingraph', 'kernels');
// Literal segments (no variable parts) so check-derived-declare-parity.mjs's
// static analysis resolves the write target to exactly the path the COVERED
// entry declares in artifacts[]. Do not "generalize" this into a loop/join.
const CAL_PATH = resolve(HERE, 's18-freshness-calibration.json');

const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');
if (WRITE === CHECK) {
  console.error('usage: node scripts/gen-s18-freshness-calibration.mjs --write | --check');
  process.exit(2);
}

if (!existsSync(CG_PATH)) {
  console.error(`✗ ${CG_PATH} not found — the calibration describes the committed monolith; nothing to compute from.`);
  process.exit(1);
}

const { sourceDigest } = await import(pathToFileURL(resolve(KDIR, '_buildid.mjs')).href);
const cg = JSON.parse(readFileSync(CG_PATH, 'utf8'));
// Same in-scope population and kernel lookup the production gate uses — copied
// shape, single source of truth for the comparison itself (computeStaleness).
const liveGpuFalse = (cg.nodes ?? []).filter((n) => n.status === 'live' && n.gpu === false);
const kernelSources = {};
for (const n of liveGpuFalse) {
  const p = resolve(KDIR, `${n.tool_id}.kernel.mjs`);
  if (existsSync(p)) kernelSources[n.tool_id] = readFileSync(p, 'utf8');
}
const { stale, fresh, total } = await computeStaleness(cg, kernelSources, sourceDigest);

// Calibration soundness — the SAME rule the production gate applies before
// trusting any count: zero fresh out of a non-empty estate means the
// canonicalization is broken and every mismatch would be a false positive.
// Never publish counts from a refused instrument.
if (total > 0 && fresh.length === 0) {
  console.error(`✗ CALIBRATION FAILED — zero of ${total} in-scope nodes recomputed as fresh. The canonicalization`);
  console.error('  path is almost certainly wrong; refusing to write a calibration from an unsound instrument.');
  console.error('  See check-s18-digest-freshness.mjs and STALE-PROOF-AUDIT-2026-07-25.md, section "Calibration".');
  process.exit(1);
}

const artifact = {
  _comment: 'DESCRIPTIVE calibration for the §18 digest-freshness self-test (S18-FRESHNESS-DURABLE-FIX-1, mechanism b). Regen-owned derived artifact: computed by scripts/gen-s18-freshness-calibration.mjs with the gate\'s own computeStaleness() over _buildid.mjs sourceDigest(), and committed by derived-artifacts-regen.yml in the SAME bot commit as chaingraph/chaingraph.json. Describes only. The ratchet CEILING lives in s18-digest-freshness-baseline.json (counts only go down; --update-baseline is the sole sanctioned tightener) and is NOT written by the regen. Regenerate: node scripts/gen-s18-freshness-calibration.mjs --write',
  total,
  fresh: fresh.length,
  stale: stale.length,
};
const nextText = JSON.stringify(artifact, null, 2) + '\n';

if (WRITE) {
  const prevText = existsSync(CAL_PATH) ? readFileSync(CAL_PATH, 'utf8') : null;
  if (prevText === nextText) {
    console.log(`✓ s18 freshness calibration already byte-exact — no write (total ${total}, fresh ${fresh.length}, stale ${stale.length}).`);
    process.exit(0);
  }
  writeFileSync(CAL_PATH, nextText);
  console.log(`✓ s18 freshness calibration written: total ${total}, fresh ${fresh.length}, stale ${stale.length} → ${CAL_PATH}`);
  process.exit(0);
}

// --check: the committed artifact must equal the freshly recomputed truth,
// byte for byte. Absence is a hard failure, never a pass (SO #34c).
if (!existsSync(CAL_PATH)) {
  console.error(`✗ §18 freshness calibration MISSING — ${CAL_PATH} does not exist. Absence is not a pass (SO #34c).`);
  console.error('  Restore it: git checkout origin/main -- scripts/s18-freshness-calibration.json');
  console.error('  or regenerate: node scripts/gen-s18-freshness-calibration.mjs --write');
  process.exit(1);
}
const committedText = readFileSync(CAL_PATH, 'utf8');
if (committedText !== nextText) {
  let committed = null;
  try { committed = JSON.parse(committedText); } catch { /* unparseable — reported as such */ }
  const fmt = (v) => (v === null || v === undefined) ? '(unreadable)' : `${v}`;
  console.error(`✗ §18 freshness calibration STALE — ${CAL_PATH} does not match the committed estate.`);
  console.error(`  committed:  total ${fmt(committed?.total)} fresh ${fmt(committed?.fresh)} stale ${fmt(committed?.stale)}`);
  console.error(`  recomputed: total ${total} fresh ${fresh.length} stale ${stale.length}`);
  console.error('  The writer is: node scripts/gen-s18-freshness-calibration.mjs --write');
  console.error('  (derived-artifacts-regen.yml runs exactly that, in the same bot commit as chaingraph.json.)');
  console.error('  ⛔ This file is descriptive only — the ratchet ceiling in s18-digest-freshness-baseline.json');
  console.error('  is a different control and is never written here.');
  process.exit(1);
}
console.log(`✓ §18 freshness calibration matches the committed estate (total ${total}, fresh ${fresh.length}, stale ${stale.length}).`);
