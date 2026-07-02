#!/usr/bin/env node
/**
 * check-copy-hallmarks.mjs — gate against AI-writing hallmarks in reader-facing copy.
 *
 * Hard-fails on:
 *   1. Em-dashes (—) in the human-visible text of any public HTML page
 *      (script/style/pre/code/HTML-comments excluded), and in chaingraph.json
 *      node/chain descriptions (served live to agents via MCP tools/list).
 *   2. Internal build jargon in visible HTML text: "Wave N", "W-A".."W-F"
 *      badge codes, standalone "D0". (chaingraph.json jargon is already gated
 *      by check-shipped-prose.mjs.)
 *
 * Baseline (scripts/copy-hallmarks-baseline.json) shields not-yet-swept files:
 * a file may carry at most its baselined count. Files absent from the baseline
 * must be clean. New introductions anywhere therefore fail immediately, while
 * legacy debt burns down tier by tier.
 *
 * Advisory (never fails): "twotone" constructions ("It is not X. It is Y.")
 * in clean-target files, reported for human review.
 *
 * Usage:
 *   node scripts/check-copy-hallmarks.mjs            # gate (preflight + CI)
 *   node scripts/check-copy-hallmarks.mjs --update   # regenerate the baseline
 *
 * Style rule of record: CONTRACT.md §1.4 (reader-facing copy).
 *
 * The CONTRACT §1.3 PII banner is mandated verbatim and currently contains an
 * em-dash; its exact string is stripped before counting so it neither fails the
 * gate nor blocks new tools. Changing the banner itself is a CONTRACT decision.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = resolve(REPO, 'scripts', 'copy-hallmarks-baseline.json');
const UPDATE = process.argv.includes('--update');

const EMDASH = /—/g;
// Build jargon that must not reach readers. \b keeps ART-ids and W-8 (digit) safe.
const JARGON = [
  [/\bWave\s+\d+\b/g, 'Wave-N build code'],
  [/\bW-[A-F]\b/g, 'W-x badge code'],
  [/\bD0\b/g, 'D0 badge code'],
];
// Advisory only — rhetorical tic, too fuzzy for a hard gate.
const TWOTONE = /\b(?:is|are|was|were) not (?:a|an|the )?[\w-]+\.\s+(?:It|They|This|That) (?:is|are)\b/g;

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'scripts']);

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) htmlFiles(p, out);
    } else if (name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

// CONTRACT §1.3 mandates this banner verbatim (em-dash included) — exempt it.
const PII_BANNER = '🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.';

/** Human-visible text: drop script/style/pre/code bodies, HTML comments, then tags. */
function visibleText(html) {
  return html
    .split(PII_BANNER).join(' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code\b[\s\S]*?<\/code>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

const findings = {}; // rel path -> { emdash, jargon: [msg], twotone }
for (const file of htmlFiles(REPO)) {
  const rel = relative(REPO, file).replace(/\\/g, '/');
  const text = visibleText(readFileSync(file, 'utf8'));
  const emdash = (text.match(EMDASH) || []).length;
  const jargon = [];
  for (const [re, label] of JARGON) {
    const m = text.match(re) || [];
    if (m.length) jargon.push(`${label} ×${m.length} (${[...new Set(m)].slice(0, 3).join(', ')})`);
  }
  const twotone = (text.match(TWOTONE) || []).length;
  if (emdash || jargon.length || twotone) findings[rel] = { emdash, jargon, twotone };
}

// chaingraph.json descriptions — served to agents over MCP; em-dash gate only
// (jargon there is check-shipped-prose.mjs territory).
const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
let cgEmdash = 0;
for (const n of cg.nodes || []) cgEmdash += ((n.description || '').match(EMDASH) || []).length;
for (const c of cg.chains || []) cgEmdash += ((c.description || '').match(EMDASH) || []).length;
if (cgEmdash) findings['chaingraph/chaingraph.json#descriptions'] = { emdash: cgEmdash, jargon: [], twotone: 0 };

if (UPDATE) {
  const baseline = {};
  for (const [rel, f] of Object.entries(findings)) {
    const debt = f.emdash + f.jargon.length;
    if (debt) baseline[rel] = { emdash: f.emdash, jargon: f.jargon.length };
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`copy-hallmarks: baseline written for ${Object.keys(baseline).length} file(s).`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};
const failures = [];
const improvements = [];
const advisories = [];

for (const [rel, f] of Object.entries(findings)) {
  const b = baseline[rel] || { emdash: 0, jargon: 0 };
  if (f.emdash > b.emdash) failures.push(`${rel}: ${f.emdash} em-dash(es) in visible text (baseline ${b.emdash})`);
  else if (f.emdash < b.emdash) improvements.push(`${rel}: em-dash ${b.emdash} -> ${f.emdash}`);
  if (f.jargon.length > b.jargon) failures.push(`${rel}: build jargon in visible text: ${f.jargon.join('; ')} (baseline ${b.jargon})`);
  if (f.twotone && !baseline[rel]) advisories.push(`${rel}: ${f.twotone} possible twotone construction(s)`);
}
for (const rel of Object.keys(baseline)) {
  if (!findings[rel]) improvements.push(`${rel}: clean (baseline entry can be dropped)`);
}

if (advisories.length) {
  console.log(`copy-hallmarks ADVISORY (not failing):\n  ` + advisories.join('\n  '));
}
if (improvements.length) {
  console.log(`copy-hallmarks: ${improvements.length} file(s) beat the baseline — tighten with --update:\n  ` + improvements.slice(0, 10).join('\n  '));
}
if (failures.length) {
  console.error(`\ncopy-hallmarks: ${failures.length} FAILURE(s) — new AI-writing hallmarks in reader-facing copy:\n  ` + failures.join('\n  '));
  console.error(`\nFix the copy (see CONTRACT.md §1.4). Em-dashes become colon/comma/period by context; build codes (Wave N, W-x, D0) never reach readers. Only if intentional: --update.`);
  process.exit(1);
}
console.log(`copy-hallmarks: OK (${Object.keys(baseline).length} baselined file(s) within budget, 0 new hallmarks).`);
