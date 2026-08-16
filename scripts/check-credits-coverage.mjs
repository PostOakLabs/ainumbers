#!/usr/bin/env node
// Gate: fails when a vendored-looking file has no data/credits-registry.json entry
// covering it. Detects vendoring by convention used across all 4 repos: a
// `vendor/`/`vendored/` path segment, or a `*.bundle.mjs`/`*.bundle.js` filename.
// (A bare `MANIFEST.json` is NOT itself a signal — first-party cross-repo mirrors
// like repo/helm/technical-design/MANIFEST.json use the same filename; those are
// covered by the vendor/vendored path check where the mirror is genuinely third-party.)
//
// The `*.bundle.mjs`/`*.bundle.js` filename check is FILENAME-ONLY — it cannot tell
// genuinely vendored code from an original-authorship shared kernel composition
// module that ACCT-INFRA-KERNELS-BUILD-SPEC.md §4.1 mandates ship with the identical
// `.bundle.mjs` suffix ("exactly the shipped _detmath shape"), regardless of who
// wrote the contents (CREDITS-BUNDLE-HEURISTIC-1, board/done/ACCT-AMORT-K-1.md,
// draft PR #1290). scripts/original-authorship-bundle-allowlist.json is the second,
// disjoint discriminator for that case: a *.bundle.mjs file not covered by the
// credits registry may instead be covered there, with a mandatory written `reason`
// — never a silent exemption, and never a substitute for real vendoring credit.
// Usage: node scripts/check-credits-coverage.mjs <repo-id>
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const repoId = process.argv[2];
if (!repoId || !['repo', 'mcp-apps-poc', 'helm', 'anchor-suite'].includes(repoId)) {
  console.error('Usage: node scripts/check-credits-coverage.mjs <repo-id>  (repo-id: repo|mcp-apps-poc|helm|anchor-suite)');
  process.exit(1);
}

const registry = JSON.parse(readFileSync(path.join(ROOT, 'data', 'credits-registry.json'), 'utf8'));
const covered = registry.vendored
  .filter(v => v.repos.includes(repoId))
  .flatMap(v => (v.paths && v.paths[repoId]) || [])
  .map(p => p.replace(/\\/g, '/'));

const ORIGINAL_ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'original-authorship-bundle-allowlist.json');
const originalAllowlist = existsSync(ORIGINAL_ALLOWLIST_PATH)
  ? JSON.parse(readFileSync(ORIGINAL_ALLOWLIST_PATH, 'utf8'))
  : {};

const allowlistErrors = [];
for (const [rel, entry] of Object.entries(originalAllowlist)) {
  if (rel === '_README') continue;
  if (typeof entry?.reason !== 'string' || !entry.reason.trim()) {
    allowlistErrors.push(`${rel}: original-authorship-bundle-allowlist.json entry has no written \`reason\` — every original-authorship bundle exemption must say why it is original`);
  }
}

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', '.wt', '.wrangler', '.claude', '.claude-worktrees', '.worktrees', 'bundled', 'dist']);
const VENDOR_PATH_RE = /(^|\/)vendored?\//i;
const BUNDLE_FILE_RE = /\.bundle\.(mjs|js)$/i;

function isCovered(relPath) {
  return covered.some(c => relPath === c || relPath.startsWith(c.endsWith('/') ? c : c + '/') || (c.endsWith('/') && relPath.startsWith(c)));
}

function isOriginalAuthorshipBundle(relPath) {
  const entry = originalAllowlist[relPath];
  return !!entry && typeof entry.reason === 'string' && entry.reason.trim().length > 0;
}

function walk(dir, relDir, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const rel = relDir ? `${relDir}/${name}` : name;
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      walk(full, rel, out);
    } else {
      const isVendorPath = VENDOR_PATH_RE.test(rel);
      const isBundleFile = BUNDLE_FILE_RE.test(name);
      if (isVendorPath || isBundleFile) out.push(rel);
    }
  }
}

const found = [];
walk(ROOT, '', found);

const uncovered = found.filter(f => !isCovered(f) && !isOriginalAuthorshipBundle(f));

if (allowlistErrors.length || uncovered.length) {
  if (uncovered.length) {
    console.error(`check-credits-coverage: ${uncovered.length} vendored-looking file(s) with no data/credits-registry.json entry (and no original-authorship-bundle-allowlist.json entry) for repo "${repoId}":`);
    for (const f of uncovered) console.error(`  - ${f}`);
    console.error('Either add an entry to data/credits-registry.json (vendored[].paths.' + repoId + ') and re-run scripts/gen-credits.mjs if this is genuinely vendored,');
    console.error('or add an entry with a written `reason` to scripts/original-authorship-bundle-allowlist.json if this is an original-authorship .bundle.mjs composition module.');
  }
  if (allowlistErrors.length) {
    console.error(`check-credits-coverage: ${allowlistErrors.length} invalid original-authorship-bundle-allowlist.json entr${allowlistErrors.length === 1 ? 'y' : 'ies'}:`);
    for (const e of allowlistErrors) console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log(`check-credits-coverage: ${found.length} vendored-looking file(s) scanned, all covered by the registry or the original-authorship allowlist.`);
