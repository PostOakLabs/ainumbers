#!/usr/bin/env node
// verify_repo_sitemap_context.test.mjs — three-state control for SITEMAP-DEPLOY-SPLIT-1
// (SO #40b RED-first pairing; modeled on check-compute-proof-coverage.test.mjs's wiring
// control, which pins the same advisory-on-PR / DERIVED_ROOT-HARD-on-merge_group /
// HARD-on-main split for the §18 gate).
//
// WHY THIS EXISTS: verify_repo.py's sitemap leg ("missing from sitemap.xml") stayed HARD
// on pull_request after SITEMAP-MAINSIDE-1 moved the repair main-side (SO #35), making
// every flatDirs page-adding PR unlandable — advisory freshness gates green while the
// required context reds. First measured on #2023 (run 35881007896: "[SITEMAP] 1 file(s)
// missing from sitemap.xml" failing scripts-verify). A gate whose relaxation was never
// observed relaxing is not known to be split; a gate never observed red is not known to
// work. Both halves are asserted here by executing the REAL shipped script against a
// minimal scratch skeleton — never a re-implementation (SO #34).
//
// ASSERTION DESIGN — differential, deliberately: the scratch skeleton is not a full repo,
// so unrelated checks ([HASH] gate scripts absent, etc.) file errors in EVERY state
// identically. The control therefore asserts the SITEMAP error class specifically:
//   A. no GITHUB_EVENT_NAME (local / push / unrecognized) → HARD: the ❌ error block
//      contains "[SITEMAP] … missing" (this is also the pre-change RED shape, unchanged).
//   B. GITHUB_EVENT_NAME=pull_request → ADVISORY: the ⚠️ advisory marker prints, and the
//      ❌ error block contains ZERO "[SITEMAP]" lines — the class that redded #2023
//      contributes no error in PR context.
//   C. GITHUB_EVENT_NAME=merge_group + DERIVED_ROOT overlay → the assembled fresh sitemap
//      resolves the page: no sitemap finding of either kind anywhere in the output.
// Relation: sitemap-class errors A ⊋ B (≥1 vs exactly 0) — main is never more lenient.

import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'verify_repo.py');
const ROBOTS = 'User-agent: *\nAllow: /\nContent-Signal: search=yes, ai-input=yes, ai-train=yes\n';

function scratchRepo() {
  const root = mkdtempSync(join(tmpdir(), 'vr-sitemap-ctx-'));
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'tools'), { recursive: true });
  mkdirSync(join(root, 'manifests'), { recursive: true });
  mkdirSync(join(root, 'guides'), { recursive: true });
  copyFileSync(SCRIPT, join(root, 'scripts', 'verify_repo.py'));
  writeFileSync(join(root, 'scripts', 'published-dirs.json'),
    JSON.stringify({ flatDirs: ['guides'], recursiveDirs: [], recursiveExcludeSubdirs: [] }));
  // The fixture that motivates the change: a published-dir page that no PR can add to
  // sitemap.xml without breaking the single-writer rule.
  writeFileSync(join(root, 'guides', 'fixture-new-page.html'),
    '<!doctype html><html><body><p>fixture</p></body></html>');
  writeFileSync(join(root, 'sitemap.xml'),
    '<urlset><url><loc>https://ainumbers.co/</loc></url></urlset>');
  writeFileSync(join(root, 'robots.txt'), ROBOTS);
  return root;
}

function run(root, env) {
  const r = spawnSync('python', [join(root, 'scripts', 'verify_repo.py')], {
    env: { ...process.env, ...env }, encoding: 'utf8', timeout: 120000,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const failedIdx = out.indexOf('FAILED');
  const errorBlock = failedIdx >= 0 ? out.slice(failedIdx) : '';
  const sitemapErrors = errorBlock.split('\n').filter((l) => l.includes('[SITEMAP]')).length;
  return { code: r.status, out, sitemapErrors };
}

const failures = [];
function assert(cond, label) {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) failures.push(label);
}

const root = scratchRepo();
try {
  // A — local/main/unrecognized context: the sitemap missing class is a HARD error.
  const a = run(root, { GITHUB_EVENT_NAME: '' });
  assert(a.code !== 0 && a.sitemapErrors >= 1 && !a.out.includes('PR context: advisory'),
    `A main/local: sitemap missing is a hard error (${a.sitemapErrors} in block; pre-change RED shape preserved)`);

  // B — pull_request: advisory marker prints, ZERO sitemap errors in the block.
  const b = run(root, { GITHUB_EVENT_NAME: 'pull_request' });
  assert(b.out.includes('PR context: advisory') && b.sitemapErrors === 0,
    'B pull_request: advisory marker present, zero sitemap errors in block (the #2023 unblock)');

  // C — merge_group with DERIVED_ROOT overlay: fresh sitemap ⇒ no finding of either kind.
  const overlay = mkdtempSync(join(tmpdir(), 'vr-sitemap-ovl-'));
  writeFileSync(join(overlay, 'sitemap.xml'),
    '<urlset><url><loc>https://ainumbers.co/</loc></url>' +
    '<url><loc>https://ainumbers.co/guides/fixture-new-page.html</loc></url></urlset>');
  const c = run(root, { GITHUB_EVENT_NAME: 'merge_group', DERIVED_ROOT: overlay });
  assert(!c.out.includes('missing from sitemap.xml'),
    'C merge_group overlay: no sitemap finding at all (queue posture)');

  // Relation: the hard context carries strictly more sitemap errors than the PR context.
  assert(a.sitemapErrors > b.sitemapErrors,
    'relation: main is never more lenient than PR');
} finally {
  try { rmSync(root, { recursive: true, force: true }); } catch {}
}

if (failures.length) {
  console.error(`SELF-TEST FAILED: ${failures.join(' | ')}`);
  process.exit(1);
}
console.log('SELF-TEST: 4/4 three-state assertions hold (A hard / B advisory / C overlay-green / relation)');
