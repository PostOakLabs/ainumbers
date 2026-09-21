#!/usr/bin/env node
/**
 * scripts/check-gen-walker-scope.mjs — REGEN-WT-SCOPE-POISON-1.
 *
 * Measured 2026-09-19: the shared clone `repo/` hosts `repo/.wt/` with 195
 * worktrees. A derived-artifacts regen run INSIDE that clone exploded
 * data/infra-registry.json (+240K lines), infrastructure.html (+203K lines)
 * and index.html's `infra_pages` count 203 → 17258, because gen-infra-registry's
 * repo-root walk skipped only `.git`/`node_modules` — worktree scaffolding is
 * published-looking HTML to it. CI at the SAME tip (clean checkout, no `.wt/`)
 * was green in both passes, so the input discovery itself is what ingests the
 * scaffolding. This fixture pins the exclusion so the poison class cannot
 * silently return.
 *
 * Fixtures are cold scratch trees in the OS temp dir (never the real repo,
 * never committed bytes): one tagged published page and one `.well-known` page
 * as controls (an over-broad exclusion would hide real pages off the map),
 * plus tagged probes under `.wt/probe/` and `.git/probe/` that must stay
 * invisible to every repo-root tree-walking generator. Covers three walkers:
 * gen-infra-registry.mjs's buildRegistry (the measured poison),
 * gen-wayfinder.mjs's findSentinelFiles (same root, same skip-list gap), and —
 * INFRA-REGISTRY-CHECK-WALK-SCOPE-1 — check-infra-registry.mjs's own
 * missing-meta walk, which kept the two-name skip and died in the pre-push
 * hook on every push from the shared clone.
 *
 * --self-test (SO #40b / GATE-SELFTEST-META-1 paired red-proof): replays the
 * PRE-FIX discovery — verbatim legacy skip-lists, `.wt` unexcluded — against
 * the same controls and asserts the probes FAIL there, proving this checker
 * detects exactly the poisoning that happened, not a rubber stamp.
 *
 * Usage:
 *   node scripts/check-gen-walker-scope.mjs            # fixture gate (exit 1 on any finding)
 *   node scripts/check-gen-walker-scope.mjs --self-test # RED/GREEN controls for the checker itself
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistry } from './gen-infra-registry.mjs';
import { findSentinelFiles } from './gen-wayfinder.mjs';
import { scan } from './check-infra-registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELFTEST = process.argv.includes('--self-test');

const PAGE = (title) => `<html><head><title>${title}</title>`
  + '<meta name="description" content="walker-scope fixture">'
  + '<meta name="ain:category" content="guide"></head><body>fixture</body></html>';
const SENTINEL = '<html><body><!--WAYFINDER: fixture --></body></html>';

// buildScratch — the cold fixture tree. Controls and probes carry IDENTICAL
// markup, so the only thing that can distinguish them is the walker's path
// discovery — exactly the surface this row fenced.
function buildScratch(dir) {
  mkdirSync(join(dir, 'guides'), { recursive: true });
  mkdirSync(join(dir, '.well-known'), { recursive: true });
  mkdirSync(join(dir, '.wt', 'probe'), { recursive: true });
  mkdirSync(join(dir, '.git', 'probe'), { recursive: true });
  // controls — must stay visible (over-exclusion would silently drop real pages)
  writeFileSync(join(dir, 'guides', 'real.html'), PAGE('control published'));
  writeFileSync(join(dir, '.well-known', 'keeper.html'), PAGE('control well-known'));
  writeFileSync(join(dir, 'guides', 'with-rail.html'), SENTINEL);
  // probes — worktree/git scaffolding, must stay invisible
  writeFileSync(join(dir, '.wt', 'probe', 'page.html'), PAGE('probe wt'));
  writeFileSync(join(dir, '.git', 'probe', 'page.html'), PAGE('probe git'));
  writeFileSync(join(dir, '.wt', 'probe', 'wf.html'), SENTINEL);
  writeFileSync(join(dir, '.git', 'probe', 'wf.html'), SENTINEL);
  // INFRA-REGISTRY-CHECK-WALK-SCOPE-1: the checker's missing-meta walk only
  // FLAGS untagged pages, so tagged probes cannot witness it descending into
  // scaffolding — these two probes carry no ain:category and are named by the
  // walk if and only if the walk enters .wt/ / .git/. (Invisible to
  // buildRegistry either way: it registers tagged pages only.)
  writeFileSync(join(dir, '.wt', 'probe', 'loose.html'), '<html><head><title>loose wt</title></head><body>fixture</body></html>');
  writeFileSync(join(dir, '.git', 'probe', 'loose.html'), '<html><head><title>loose git</title></head><body>fixture</body></html>');
}

const relOf = (dir, f) => relative(dir, f).split(sep).join('/');

/**
 * runControls — the assertions, parameterized over the walkers so the
 * self-test can replay the legacy (unscoped) discovery through the identical
 * control set. `walkers.missing` (INFRA-REGISTRY-CHECK-WALK-SCOPE-1) is the
 * checker's missing-meta walk: given a repo root it returns its finding
 * strings. Async — the real checker's scan() is.
 * @param {{ rows: (repo: string) => {path: string}[], sentinels: (repo: string) => string[], missing?: (repo: string) => Promise<string[]> }} walkers
 * @returns {Promise<{ name, ok, detail }[]>} — never throws.
 */
export async function runControls(walkers) {
  const dir = mkdtempSync(join(tmpdir(), 'gen-walker-scope-'));
  try {
    buildScratch(dir);
    const rows = walkers.rows(dir);
    const paths = new Set(rows.map((r) => r.path));
    const sents = walkers.sentinels(dir).map((f) => relOf(dir, f));
    const controls = [
      { name: 'control — tagged published page still registered (no over-exclusion)',
        ok: paths.has('guides/real.html'),
        detail: `registry paths: ${[...paths].sort().join(', ') || '(none)'}` },
      { name: 'control — .well-known stays visible (the one published dot-dir)',
        ok: paths.has('.well-known/keeper.html'), detail: '' },
      { name: 'control — real sentinel still found',
        ok: sents.includes('guides/with-rail.html'),
        detail: `sentinels: ${sents.sort().join(', ') || '(none)'}` },
      { name: 'PROBE — .wt/ scaffold page invisible to the registry walk',
        ok: !paths.has('.wt/probe/page.html'),
        detail: paths.has('.wt/probe/page.html') ? 'REGEN-WT-SCOPE-POISON-1 poison: .wt page became a registry row' : '' },
      { name: 'PROBE — .git/ scaffold page invisible to the registry walk',
        ok: !paths.has('.git/probe/page.html'), detail: '' },
      { name: 'PROBE — .wt/ and .git/ scaffold sentinels invisible to the wayfinder walk',
        ok: !sents.some((s) => s.includes('.wt/') || s.includes('.git/')),
        detail: sents.filter((s) => s.includes('.wt/') || s.includes('.git/')).join(', ') },
    ];
    if (walkers.missing) {
      // finding strings end with `: <repo-relative path>` — probe on the path,
      // not the verdict prefix.
      const pathOf = (f) => f.slice(f.lastIndexOf(': ') + 2);
      const missing = (await walkers.missing(dir)).map((f) => pathOf(f.trim()));
      controls.push(
        { name: 'control — untagged real page still named by the checker\'s missing-meta walk (no over-exclusion)',
          ok: missing.some((f) => f.includes('guides/with-rail.html')),
          detail: `findings: ${missing.join(' ; ') || '(none)'}` },
        { name: 'PROBE — .wt/ scaffold page invisible to the checker\'s missing-meta walk',
          ok: !missing.some((f) => f.startsWith('.wt/')),
          detail: missing.filter((f) => f.startsWith('.wt/')).join(' ; ') },
        { name: 'PROBE — .git/ scaffold page invisible to the checker\'s missing-meta walk',
          ok: !missing.some((f) => f.startsWith('.git/')),
          detail: missing.filter((f) => f.startsWith('.git/')).join(' ; ') },
      );
    }
    return controls;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── legacy walkers (self-test only) — the PRE-FIX discovery, verbatim shape:
// these are the skip-lists that ingested repo/.wt/ on 2026-09-19. ⛔ Keep them
// unscoped; the self-test FAILS if the real walkers ever behave like this.
function legacyRows(repo) {
  const out = [];
  (function collect(d, rel) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name === '.git' || e.name === 'node_modules') continue;
        collect(join(d, e.name), r);
      } else if (/\.html?$/i.test(e.name)) out.push(r);
    }
  })(repo, '');
  return out.map((p) => {
    let tagged = false;
    try {
      const html = readFileSync(join(repo, p), 'utf8');
      tagged = /<meta\s+name=["']ain:category["']\s+content=["'][^"']+["']/i.test(html)
        || /<meta\s+content=["'][^"']+["']\s+name=["']ain:category["']/i.test(html);
    } catch { /* unreadable fixture page — untagged */ }
    return { path: p, tagged };
  }).filter((r) => r.tagged);
}
function legacySentinels(repo) {
  const SKIP = ['node_modules', '.git', 'tools', 'manifests', 'runners'];
  const found = [];
  (function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP.includes(e.name)) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith('.html')) {
        try {
          if (readFileSync(full, 'utf8').includes('<!--WAYFINDER:')) found.push(full);
        } catch { /* unreadable fixture page */ }
      }
    }
  })(repo);
  return found;
}
// legacyMissing (INFRA-REGISTRY-CHECK-WALK-SCOPE-1) — the checker's PRE-FIX
// missing-meta walk, verbatim shape: two-name skip, every *.html collected,
// untagged ones flagged. The old exempt/shim/prefix filters bind nothing on
// the scratch tree (no tools/, chaingraph/, shims, or chaingraph.json), so
// they are omitted as in the legacy registry replica above. ⛔ Keep unscoped;
// the self-test FAILS if the real checker walk ever behaves like this.
async function legacyMissing(repo) {
  const pages = [];
  (function walk(d, rel) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name === '.git' || e.name === 'node_modules') continue;
        walk(join(d, e.name), r);
      } else if (/\.html?$/i.test(e.name)) pages.push(r);
    }
  })(repo, '');
  const findings = [];
  for (const p of pages) {
    let html = '';
    try { html = readFileSync(join(repo, p), 'utf8'); } catch { continue; }
    const tagged = /<meta\s+name=["']ain:category["']\s+content=["'][^"']+["']/i.test(html)
      || /<meta\s+content=["'][^"']+["']\s+name=["']ain:category["']/i.test(html);
    if (!tagged) findings.push(`MISSING ain:category — in-scope page is off the infrastructure map: ${p}`);
  }
  return findings;
}

async function main() {
  if (SELFTEST) {
    const failures = [];
    const check = (name, ok, detail) => {
      console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
      if (!ok) failures.push(name);
    };
    // RED controls: the legacy (pre-fix) discovery MUST trip the .wt probes —
    // a checker that stays green against the measured poison proves nothing.
    const legacy = await runControls({ rows: legacyRows, sentinels: legacySentinels, missing: legacyMissing });
    check('RED — legacy discovery trips the .wt registry probe (poison detected)',
      legacy.find((c) => c.name.includes('.wt/ scaffold page invisible'))?.ok === false);
    check('RED — legacy discovery trips the .wt wayfinder probe',
      legacy.find((c) => c.name.includes('wayfinder walk'))?.ok === false);
    check('RED — legacy discovery trips the .wt missing-meta probe (the pre-push-hook death)',
      legacy.find((c) => c.name.includes('missing-meta walk') && c.name.includes('.wt/'))?.ok === false);
    check('RED — legacy discovery still passes the controls (faithful pre-fix replica)',
      legacy.filter((c) => c.name.startsWith('control')).every((c) => c.ok),
      legacy.filter((c) => !c.ok && c.name.startsWith('control')).map((c) => c.name).join('; '));
    // GREEN controls: the real walkers must clear every assertion.
    const real = await runControls({
      rows: buildRegistry,
      sentinels: findSentinelFiles,
      missing: async (repo) => (await scan(repo, false)).findings,
    });
    for (const c of real) check(`GREEN — ${c.name}`, c.ok, c.detail);
    console.log('');
    if (failures.length) {
      console.error(`✗ check-gen-walker-scope --self-test FAILED: ${failures.length} control(s) red.`);
      process.exit(1);
    }
    console.log('✅ check-gen-walker-scope --self-test PASSED — legacy .wt poison trips the probes, scoped walkers clear all nine.');
    return;
  }
  const results = await runControls({
    rows: buildRegistry,
    sentinels: findSentinelFiles,
    missing: async (repo) => (await scan(repo, false)).findings,
  });
  for (const c of results) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail && !c.ok ? ` — ${c.detail}` : ''}`);
  }
  const bad = results.filter((c) => !c.ok);
  if (bad.length) {
    console.error(`✗ check-gen-walker-scope: ${bad.length} control(s) red — a repo-root walker is ingesting worktree scaffolding.`);
    process.exit(1);
  }
  console.log('✅ check-gen-walker-scope: OK — .wt/ and .git/ scaffolding invisible to all repo-root walkers (registry, wayfinder, checker missing-meta), controls visible.');
}

await main();
