// add-chain-narrative-clarification.mjs — CHAINNARRATIVE-CLARIFY-1
//
// WHY: CHAINNARRATIVE-SCOPE-1 found 7/10 sampled chain pages (matching
// PACKMARKER-BINDING-SCOPE-1's corpus count of 690/1069 steps) use causation
// register in their per-step "handoff" copy ("X feeds Y", named fields
// crossing steps) with ZERO backing in execution code — SPEC.md §21 never
// specifies inter-step data threading, and helm's execution code never reads
// a prior step's output. Tim's ruling (2026-08-04): add an ADDITIVE, DATED
// clarification to every chain page — do NOT touch a single existing
// handoff sentence (post-hoc removal of published copy reads as spoliation
// in this estate). See board/done/CHAINNARRATIVE-CLARIFY-1.md.
//
// Anchor: every chain page template variant in repo/chaingraph/chains/*.html
// carries exactly one <h1> (the chain title) — verified across all files
// before choosing this insertion point, because hero markup otherwise varies
// across at least 3 template families (hero-badges / hero-meta / no-badges).
// Idempotent: a marker HTML comment guards against double-injection on rerun.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CHAINS_DIR = join(REPO, 'chaingraph', 'chains');

export const MARKER = '<!-- CHAIN-NARRATIVE-CLARIFICATION:v1 -->';

export const NOTE_HTML = `${MARKER}
  <div class="chain-narrative-note" style="font-family:'JetBrains Mono',monospace;font-size:.62rem;line-height:1.55;color:var(--body);background:var(--warn-dim);border:1px solid var(--warn);border-radius:var(--radius);padding:.65rem .85rem;margin:.85rem 0 0"><span style="color:var(--warn)">Note (dated 2026-08-04):</span> a chain composes independent computations performed in an analytical order. No step's output is carried into the next step by the execution model; each step computes from its own declared inputs. This is true of every chain on this site, including chains whose per-step copy below reads as a data handoff.</div>`;

function injectOne(text) {
  if (text.includes(MARKER)) return null; // already applied
  const idx = text.indexOf('</h1>');
  if (idx === -1) return { error: 'no <h1> found' };
  const cut = idx + '</h1>'.length;
  return { text: text.slice(0, cut) + '\n' + NOTE_HTML + text.slice(cut) };
}

function main() {
  const files = readdirSync(CHAINS_DIR).filter((f) => f.endsWith('.html'));
  let applied = 0, skipped = 0, failed = [];
  for (const f of files) {
    const p = join(CHAINS_DIR, f);
    const text = readFileSync(p, 'utf8');
    const result = injectOne(text);
    if (result === null) { skipped++; continue; }
    if (result.error) { failed.push(`${f}: ${result.error}`); continue; }
    writeFileSync(p, result.text);
    applied++;
  }
  console.log(`chain-narrative-clarification: applied ${applied}, already-present ${skipped}, failed ${failed.length}/${files.length}`);
  if (failed.length) {
    console.error('FAILED (no <h1> anchor found):');
    for (const f of failed) console.error(`  • ${f}`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('add-chain-narrative-clarification.mjs')) {
  main();
}
