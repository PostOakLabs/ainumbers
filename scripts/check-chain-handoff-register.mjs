#!/usr/bin/env node
// check-chain-handoff-register.mjs — CHAINNARRATIVE-CLARIFY-1
//
// WHY: CHAINNARRATIVE-SCOPE-1 found per-step "handoff" copy on chain pages
// frequently uses causation register ("X feeds Y", named fields crossing
// steps) with ZERO backing in execution code (SPEC.md §21 never specifies
// inter-step data threading; helm never reads a prior step's output).
// CHAINNARRATIVE-CLARIFY-1 added a dated, additive clarification note to
// every existing chain page rather than rewrite the ~690 existing causation
// sentences (spoliation risk — see board/done/CHAINNARRATIVE-CLARIFY-1.md).
// This gate is the other half: it does not retro-fail that grandfathered
// corpus, but it fails the build the moment a NEW causation-register handoff
// sentence is introduced — a new chain page, or a new/edited step on an
// existing page. Chain HTML is the source of truth checked here (not
// chaingraph.json, which is Read-denied to sessions per .claude/settings.json
// and is not this row's fence).
//
// BASELINE MECHANIC (same shape as scripts/copy-hallmarks-baseline.json):
// chain-handoff-register-baseline.json maps { "<file>.html": <count> } — the
// number of causation-register <div class="stage-handoff">...</div> strings
// that file carried when this gate went live. A file's live count may never
// EXCEED its baselined count (ratchet down only); a file absent from the
// baseline must have a live count of zero. Run with --init to (re)write the
// baseline from the current corpus — only legitimate immediately after this
// row's own clarification-note change, or when a grandfathered sentence is
// deliberately rewritten to sequence-only register (count goes down, baseline
// updates to match, never up).

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CHAINS_DIR = join(REPO, 'chaingraph', 'chains');
const BASELINE_PATH = join(HERE, 'chain-handoff-register-baseline.json');

// Causation register: an explicit transfer verb ("feed(s)", "passes to", "is
// used by", "carried into", "flows into"), OR the "output of X is used by Y"
// shape. Deliberately narrow — it must not fire on purely descriptive prose
// ("Recomputed figure...", "Per-rule pass/fail...") which is the accurate,
// sequence-only register this gate must let through untouched.
export const CAUSATION_RE = /\b(feed|feeds|fed into|passes? to|passed to|carried into|carries into|flows? into|is used by|are used by|output of .+ is used by)\b/i;

export function extractHandoffs(html) {
  const out = [];
  const re = /<div class="stage-handoff"[^>]*>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html))) {
    out.push(m[1].replace(/<[^>]+>/g, '').trim());
  }
  return out;
}

export function countCausation(html) {
  return extractHandoffs(html).filter((h) => CAUSATION_RE.test(h)).length;
}

function selfTest() {
  const causationExample = 'output_score,gap_list feed Stage 2 review';
  const sequenceExample = 'Recomputed figure and violation list against the published edit identifier.';
  const causationFires = CAUSATION_RE.test(causationExample);
  const sequencePasses = !CAUSATION_RE.test(sequenceExample);
  console.log(`positive control — causation sentence ${JSON.stringify(causationExample)} => matched=${causationFires}`);
  console.log(`positive control — sequence-only sentence ${JSON.stringify(sequenceExample)} => matched=${!sequencePasses ? 'true (WRONG)' : 'false (correct)'}`);
  if (!causationFires || !sequencePasses) {
    console.error('✗ SELF-TEST FAILED — the causation regex does not discriminate the two registers correctly.');
    process.exit(1);
  }
  console.log('✓ self-test passed — gate discriminates causation register from sequence-only register.');
}

function buildLiveCounts() {
  const files = readdirSync(CHAINS_DIR).filter((f) => f.endsWith('.html'));
  const counts = {};
  for (const f of files) {
    const html = readFileSync(join(CHAINS_DIR, f), 'utf8');
    counts[f] = countCausation(html);
  }
  return counts;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) {
    selfTest();
    return;
  }
  if (args.includes('--init')) {
    const counts = buildLiveCounts();
    writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n');
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`✓ baseline written — ${Object.keys(counts).length} files, ${total} grandfathered causation-register instance(s).`);
    return;
  }

  selfTest();

  if (!existsSync(BASELINE_PATH)) {
    console.error(`✗ chain-handoff-register FAILED — no baseline at ${BASELINE_PATH}. Run with --init once, immediately after CHAINNARRATIVE-CLARIFY-1's own corpus pass, to grandfather the existing corpus.`);
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const live = buildLiveCounts();

  const regressions = [];
  for (const [file, liveCount] of Object.entries(live)) {
    const baselineCount = baseline[file] ?? 0;
    if (liveCount > baselineCount) {
      regressions.push({ file, liveCount, baselineCount });
    }
  }

  if (regressions.length) {
    console.error(`✗ chain-handoff-register FAILED — ${regressions.length} file(s) introduced NEW causation-register handoff copy beyond their grandfathered baseline:`);
    for (const r of regressions) {
      console.error(`  • ${r.file}: ${r.liveCount} causation-register handoff(s), baseline allows ${r.baselineCount}`);
    }
    console.error('\nA "handoff" narrative may not claim a transfer verb ("feeds", "passes to", "is used by", ...) between chain steps — SPEC.md §21 never specifies inter-step data threading and no execution code reads a prior step\'s output. Rephrase to describe what the step produces, not what consumes it (sequence-only register), or — if this file is a deliberate rewrite of an existing grandfathered sentence — lower its count in scripts/chain-handoff-register-baseline.json to match (ratchet DOWN only, never up).');
    process.exit(1);
  }

  const totalLive = Object.values(live).reduce((a, b) => a + b, 0);
  const totalBaseline = Object.values(baseline).reduce((a, b) => a + b, 0);
  console.log(`✓ chain-handoff-register clean — ${totalLive} grandfathered causation-register instance(s) across ${Object.keys(live).length} chain pages, zero new since baseline (baseline total: ${totalBaseline}).`);
}

main();
