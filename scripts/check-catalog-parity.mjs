#!/usr/bin/env node
/**
 * check-catalog-parity.mjs — preflight/CI wrapper around chaingraph/standard/catalog-parity.mjs.
 *
 * Why this wrapper exists (audit finding, 2026-07-09): catalog-parity.mjs is listed in
 * SPEC.md §15 as a NORMATIVE "validate"-time gate ("every node `url` page + chain page
 * exists (no orphans)"), but it was never invoked from preflight.mjs or any CI workflow —
 * spec-gate-coverage.mjs only checks that a gate FILE exists on disk, not that it is wired
 * in. Running it directly surfaced 17 pre-existing orphan chain pages (chains/*.html that no
 * chain's composer_url references) that had never been caught. Those 17 are legacy content
 * debt, not something this gate should silently swallow OR block every future push over —
 * so this wrapper uses the same baseline-shield pattern as check-copy-hallmarks.mjs
 * (scripts/copy-hallmarks-baseline.json): known debt is shielded by name, any NEW orphan
 * (or a previously-fixed one regressing) fails the gate immediately, and the baseline count
 * only goes down as pages are triaged/wired/removed.
 *
 * Usage:
 *   node scripts/check-catalog-parity.mjs            # gate (preflight + CI)
 *   node scripts/check-catalog-parity.mjs --update    # regenerate the baseline from current findings
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = resolve(REPO, 'scripts', 'catalog-parity-baseline.json');
const UPDATE = process.argv.includes('--update');

let out;
try {
  out = execFileSync(process.execPath, [resolve(REPO, 'chaingraph', 'standard', 'catalog-parity.mjs')], {
    cwd: REPO,
    env: { ...process.env, CG_DIR: resolve(REPO, 'chaingraph') },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  // catalog-parity.mjs sets a non-zero exitCode on errors — execFileSync throws;
  // stdout/stderr are still attached to the error object. The orphan-page lines
  // are logged via console.error, so stderr must be included, not just stdout.
  out = (e.stdout || '') + '\n' + (e.stderr || '');
}
if (typeof out !== 'string') out = String(out);

const orphans = [...out.matchAll(/^✗ orphan page (chains\/[^\s]+\.html) —/gm)].map((m) => m[1]).sort();
const otherErrors = out.split('\n').filter((l) => l.startsWith('✗') && !l.startsWith('✗ orphan page') && !/^✗ \d+ catalog-parity error/.test(l));

if (UPDATE) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ orphan_chain_pages: orphans }, null, 2) + '\n');
  console.log(`catalog-parity: baseline written for ${orphans.length} known orphan chain page(s).`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : { orphan_chain_pages: [] };
const baselined = new Set(baseline.orphan_chain_pages || []);

const newOrphans = orphans.filter((f) => !baselined.has(f));
const fixed = [...baselined].filter((f) => !orphans.includes(f));

if (otherErrors.length) {
  console.error(`catalog-parity: ${otherErrors.length} non-orphan error(s) (never baselined — always blocking):\n  ` + otherErrors.join('\n  '));
}
if (fixed.length) {
  console.log(`catalog-parity: ${fixed.length} baselined orphan(s) no longer present — tighten with --update:\n  ` + fixed.join('\n  '));
}
if (newOrphans.length) {
  console.error(`\ncatalog-parity: ${newOrphans.length} NEW orphan chain page(s) not in baseline:\n  ` + newOrphans.join('\n  '));
  console.error(`\nA chain page under chaingraph/chains/ that no chain's composer_url references is dead/undiscoverable surface (SPEC.md §15). Either wire it to a chain's composer_url, remove the page, or if intentional (rare), add it to scripts/catalog-parity-baseline.json via --update with a comment explaining why.`);
}

if (newOrphans.length || otherErrors.length) process.exit(1);
console.log(`catalog-parity: OK (${baselined.size} baselined legacy orphan(s) within budget, 0 new orphans, 0 non-orphan errors).`);
