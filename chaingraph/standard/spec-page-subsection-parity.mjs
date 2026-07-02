#!/usr/bin/env node
/**
 * spec-page-subsection-parity.mjs — SSOT gate: the rendered spec page may not LAG SPEC.md sub-sections.
 *
 * Companion to spec-page-parity.mjs. That gate reconciles top-level `## §N` sections + the TOC. This one
 * closes the finer gap that let §16.3 / §18.5 / §18.6 exist in SPEC.md (the normative source) while the
 * hand-kept `openchain-graph-spec.html` silently omitted them — reader-facing drift no gate watched.
 *
 * RULE: every sub-section heading in SPEC.md (a `### §X.Y` heading OR a `**§X.Y ...` bold lead-in, the two
 * formats the normative core uses) MUST appear as a `§X.Y` token somewhere on the rendered page. Direction is
 * one-way: SPEC ⊆ page. The page MAY carry extra finer sub-sections (e.g. it renders §12/§13 at a granularity
 * SPEC.md states in prose) — those are not flagged. A SPEC sub-section with no page presence FAILS.
 *
 * This makes the hand-kept page self-correcting under review: adding a `**§X.Y` to SPEC.md without rendering
 * it on the page turns the gate red in preflight + CI, so the public spec can no longer drift behind the SSOT.
 *
 * Zero-dependency. Wired into scripts/preflight.mjs + the site CI (deploy-to-dreamhost.yml). The page is then
 * propagated to the public GitHub Pages mirror by the existing sync-chaingraph-spec workflow.
 *
 * Usage:
 *   node chaingraph/standard/spec-page-subsection-parity.mjs            strict (CI): exit 1 on any missing
 *   node chaingraph/standard/spec-page-subsection-parity.mjs --list     print SPEC + page sub-section sets
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC = process.env.SPEC || resolve(HERE, 'SPEC.md');
const PAGE = process.env.PAGE || resolve(HERE, '..', 'openchain-graph-spec.html');
const LIST = process.argv.includes('--list');

const specMd = readFileSync(SPEC, 'utf8');
const page = readFileSync(PAGE, 'utf8');

// SPEC sub-sections: `### §X.Y` headings + `**§X.Y` bold lead-ins (the normative-core sub-section formats).
const specSubs = new Set([...specMd.matchAll(/(?:^###\s*|\*\*)§(\d+\.\d+)/gm)].map((m) => m[1]));
// Every §X.Y the rendered page shows (in any heading/prose).
const pageSubs = new Set([...page.matchAll(/§(\d+\.\d+)/g)].map((m) => m[1]));

const byNum = (a, b) => a.split('.').map(Number)[0] - b.split('.').map(Number)[0] || a.split('.').map(Number)[1] - b.split('.').map(Number)[1];
const missing = [...specSubs].filter((s) => !pageSubs.has(s)).sort(byNum);

if (LIST) {
  console.log('SPEC.md sub-sections (' + specSubs.size + '): ' + [...specSubs].sort(byNum).join(' '));
  console.log('page sub-sections  (' + pageSubs.size + '): ' + [...pageSubs].sort(byNum).join(' '));
}

if (missing.length) {
  console.error(`✗ spec-page-subsection-parity FAILED — ${missing.length} SPEC.md sub-section(s) are missing from the rendered page (openchain-graph-spec.html):`);
  for (const s of missing) console.error('  • §' + s);
  console.error('\nAdd a matching <h3>§' + missing[0] + ': …</h3> block to the page’s section (the mirror re-syncs it automatically). The page renders SPEC.md; it may not fall behind it.');
  process.exit(1);
}
console.log(`✓ spec-page-subsection-parity clean — all ${specSubs.size} SPEC.md sub-sections present on the page.`);
