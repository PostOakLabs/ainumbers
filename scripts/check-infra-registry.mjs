#!/usr/bin/env node
/**
 * scripts/check-infra-registry.mjs — INFRA-PAGE-1 gate (PR-side HARD, like new
 * islands). Companion to scripts/gen-infra-registry.mjs (which owns the scope
 * enumeration and the EXEMPT rationale table — reused, not duplicated).
 *
 * Verdicts (each names the file):
 *   · an in-scope page with no `ain:category` meta           → RED (the page
 *     exists but is off the map; the PR must tag it)
 *   · an `ain:category` value outside the enum               → RED
 *   · a registry entry whose file is gone                    → RED (stale)
 *   · --check: regenerate data/infra-registry.json in memory → byte-compare
 *
 * --selftest (SO #40b RED-then-GREEN pairing): builds a fixture repo in a
 * temp dir with one untagged page and asserts the missing-meta verdict, then
 * tags the page and asserts the verdict clears — the gate is proven to read
 * the meta, not to rubber-stamp.
 *
 * Usage:
 *   node scripts/check-infra-registry.mjs            # gate (exit 1 on any finding)
 *   node scripts/check-infra-registry.mjs --check    # + registry byte-compare
 *   node scripts/check-infra-registry.mjs --selftest # RED-then-GREEN fixture proof
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, buildRegistry } from './gen-infra-registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SELFTEST = process.argv.includes('--selftest');
const CHECK = process.argv.includes('--check');
const REG_REL = 'data/infra-registry.json';

/**
 * Scan an in-memory tree the same way the registry builder does and return
 * every finding. Exported for the self-test.
 * @param {string} repo root
 * @param {boolean} doCheckRegistry also verify registry byte-freshness
 * @returns {{ findings: string[], checked: number, registryEntries: number }}
 */
export async function scan(repo, doCheckRegistry) {
  const findings = [];
  const rows = buildRegistry(repo);
  const registry = existsSync(join(repo, REG_REL))
    ? JSON.parse(readFileSync(join(repo, REG_REL), 'utf8'))
    : null;
  if (registry) {
    const onDisk = new Set(rows.map(r => r.path));
    for (const e of registry) {
      if (!onDisk.has(e.path) && !existsSync(join(repo, e.path))) {
        findings.push(`STALE registry entry — file gone: ${e.path}`);
      }
    }
    if (doCheckRegistry) {
      const fresh = JSON.stringify(rows, null, 2) + '\n';
      if (fresh !== readFileSync(join(repo, REG_REL), 'utf8')) {
        findings.push(`REGISTRY STALE — regenerate: node scripts/gen-infra-registry.mjs`);
      }
    }
  }
  // every in-scope, non-shim page must carry a valid ain:category.
  // buildRegistry() skips pages without the meta, so re-walk its own scope via
  // the exempt/shim/node logic it exposes: reuse by diffing against the full
  // collect() the generator does — reimplemented here only as the negative
  // half (pages the registry silently dropped). To keep one enumeration, the
  // generator exports CATEGORIES and buildRegistry; the missing-meta walk
  // below is the gate's own subject and deliberately independent (a bug that
  // hid untagged pages in the generator must not hide them here too).
  const { readdirSync } = await import('node:fs');
  const { relative } = await import('node:path');
  const cgPath = join(repo, 'chaingraph', 'chaingraph.json');
  let nodeUrls = new Set();
  try {
    nodeUrls = new Set((JSON.parse(readFileSync(cgPath, 'utf8')).nodes || [])
      .map(n => (n.url || '').replace('https://ainumbers.co/', '')));
  } catch { /* page-derived scope */ }
  const exempt = [
    'start.html', 'tools.html', 'sitemap.html', 'chaingraph/chaingraph-hub.html',
    'guides/index.html', 'euc-register.html', 'chaingraph/integrator-profile.html',
    'chaingraph/conformance-roster.html', 'chaingraph/clause-edge-report.html',
    'chaingraph/kernel-vm-explainer.html', 'docs/index.html',
  ];
  const isShim = (html) => {
    const t = html.replace(/\s+/g, '');
    return /http-equiv=["']?refresh/i.test(t) || /name=["']?robots["']?content=["'][^"']*noindex/i.test(t);
  };
  const pages = [];
  (function walk(dir, rel) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name === '.git' || e.name === 'node_modules') continue;
        walk(join(dir, e.name), r);
      } else if (/\.html?$/i.test(e.name)) pages.push(r);
    }
  })(repo, '');
  let checked = 0;
  for (const rel of pages.sort()) {
    if (exempt.includes(rel)) continue;
    if (rel.startsWith('tools/') || rel.startsWith('chaingraph/chains/') || rel.startsWith('scripts/')) continue;
    if (nodeUrls.has(rel)) continue;
    let html = '';
    try { html = readFileSync(join(repo, rel), 'utf8'); } catch { continue; }
    if (isShim(html)) continue;
    checked++;
    const m = html.match(/<meta\s+name=["']ain:category["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']ain:category["']/i);
    if (!m) {
      findings.push(`MISSING ain:category — in-scope page is off the infrastructure map: ${rel}`);
      continue;
    }
    if (!CATEGORIES.includes(m[1])) {
      findings.push(`INVALID ain:category "${m[1]}" (enum: ${CATEGORIES.join('|')}): ${rel}`);
    }
  }
  return { findings, checked, registryEntries: rows.length };
}

async function selftest() {
  const dir = mkdtempSync(join(tmpdir(), 'infra-registry-selftest-'));
  const failures = [];
  const check = (name, ok, detail) => {
    console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
  };
  try {
    // fixture: one tagged page, one untagged page
    mkdirSync(join(dir, 'guides'), { recursive: true });
    const head = (cat) => cat
      ? `<html><head><title>T | X</title><meta name="description" content="d"><meta name="ain:category" content="${cat}"></head><body>hi</body></html>`
      : `<html><head><title>U | X</title><meta name="description" content="d"></head><body>hi</body></html>`;
    writeFileSync(join(dir, 'guides', 'tagged.html'), head('guide'));
    writeFileSync(join(dir, 'guides', 'untagged.html'), head(null));
    // RED: the untagged page is named, the tagged page is not
    const red = await scan(dir, false);
    check('RED — untagged in-scope page named by the gate',
      red.findings.some(f => f.includes('guides/untagged.html') && f.includes('MISSING ain:category')),
      red.findings.join(' ; '));
    check('RED — the tagged page is not flagged', !red.findings.some(f => f.includes('guides/tagged.html')), '');
    // RED: an out-of-enum value is caught
    writeFileSync(join(dir, 'guides', 'tagged.html'), head('bogus'));
    const bad = await scan(dir, false);
    check('RED — category outside the enum named', bad.findings.some(f => f.includes('INVALID ain:category') && f.includes('guides/tagged.html')), '');
    // GREEN: fix the value, both findings clear
    writeFileSync(join(dir, 'guides', 'tagged.html'), head('guide'));
    rmSync(join(dir, 'guides', 'untagged.html'));
    const green = await scan(dir, false);
    check('GREEN — findings clear once every page is tagged in-enum', green.findings.length === 0, green.findings.join(' ; '));
    // STALE: a registry entry whose file vanished
    mkdirSync(join(dir, 'data'), { recursive: true });
    writeFileSync(join(dir, 'data', 'infra-registry.json'), JSON.stringify([{ path: 'guides/vanished.html' }], null, 2) + '\n');
    const stale = await scan(dir, false);
    check('RED — registry entry whose file is gone is stale', stale.findings.some(f => f.includes('STALE') && f.includes('vanished.html')), stale.findings.join(' ; '));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log('');
  if (failures.length) {
    console.error(`✗ check-infra-registry --selftest FAILED: ${failures.length} control(s) red.`);
    process.exit(1);
  }
  console.log('✅ check-infra-registry --selftest PASSED — missing-meta RED, out-of-enum RED, stale-entry RED, GREEN after the fix.');
}

if (SELFTEST) {
  await selftest();
} else {
  const { findings, checked, registryEntries } = await scan(REPO, CHECK);
  if (findings.length) {
    console.error(`check-infra-registry: ${findings.length} problem(s):`);
    for (const f of findings) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`check-infra-registry: OK — ${checked} in-scope page(s) tagged in-enum, ${registryEntries} registry entr(ies) fresh${CHECK ? ', registry byte-exact' : ''}.`);
}
