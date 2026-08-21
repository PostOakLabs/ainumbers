#!/usr/bin/env node
/**
 * scripts/gen-debt-ledger.mjs — DEBT-LEDGER-1
 *
 * WHY: 0xAlpha/2026-08-21-mechanical-verification-audit.md Finding 3 — the
 * estate carries ~25 committed ratchet baseline / allowlist / quarantine
 * files (one per gate that shields known, reviewed debt behind a "counts
 * only go down" ceiling instead of blocking the build outright), and no
 * single generated artifact ever totalled them, so the claim "counts only
 * go down" had no instrument proving it. This generator is that instrument.
 *
 * DISCOVERY IS MECHANICAL, NOT A HARDCODED LIST (SO #34 — never trust an
 * enumeration, derive it): every file anywhere in the repository whose name
 * ends in `-baseline.json`, `-allowlist.json` or `-quarantine.json` is a
 * candidate. A candidate is kept only if some OTHER file under the repo
 * (any `.mjs` or `.py`) contains its exact basename as a substring — proof
 * some checker script actually reads it, not just a coincidentally named
 * artifact (chaingraph/graph/nodes/art-114-suspect-product-quarantine.json
 * is a real chain node whose slug happens to end "-quarantine.json"; it has
 * no reader and is correctly excluded by this rule). A new ratchet file
 * dropped in tomorrow is picked up automatically on the next `--write`; a
 * removed one drops off automatically.
 *
 * COUNTING each file's shielded-debt size cannot be one generic rule: the
 * 25 files were authored independently, by different gates, over weeks, and
 * their shapes range from a flat array to a `{file: count}` map to nested
 * per-file per-category objects (see EXTRACTORS below — each maps to the
 * field that file's own doctrine comment names as the actual ceiling, never
 * a `known_*`/`*_files` provenance-scope field). EXTRACTORS is structural
 * metadata (which field to measure), not a count — the number itself is
 * always recomputed from the live file at generation time, never typed by
 * hand. A discovered file with no entry here still renders, via FALLBACK,
 * with a visible "no dedicated extractor yet" note rather than being
 * silently dropped (SO #34c: absence is not a pass) — that note is the
 * prompt to add one.
 *
 * OUTPUT: a single `<!-- GEN:DEBT-LEDGER:START -->...:END -->` block
 * embedded in fv-explainer.html (existing FV-status reader page — natural
 * home per the audit's Tier-B recommendation), owned exclusively by this
 * generator. Deliberately NOT wired through verify-counts.mjs's
 * `<!--COUNT:-->` sentinel mechanism, which already owns other sentinels on
 * this same page (see derived-artifacts.mjs COVERED id 'counts') — this
 * block is a self-contained region with its own markers, the same pattern
 * gen-chain-index.mjs already uses to own one region of chaingraph-hub.html
 * while other generators own others.
 *
 * NO TIME SERIES: each regen shows CURRENT counts only. "Last changed" per
 * class is that file's own most recent commit date (git log), so the trend
 * a reader wants is the file's own git history, never a second copy of it
 * kept here (the audit explicitly asked for visibility, not a database).
 * Because nothing in the rendered block is wall-clock-dependent, `--check`
 * is a plain, deterministic string comparison — no dynamic-field carve-out
 * needed (contrast scripts/gen-fv-status.mjs's `issued_at`).
 *
 * Usage:
 *   node scripts/gen-debt-ledger.mjs --write
 *   node scripts/gen-debt-ledger.mjs --check
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const FV_EXPLAINER = resolve(REPO, 'fv-explainer.html');

const args = process.argv.slice(2);
const mode = args.includes('--write') ? 'write' : args.includes('--check') ? 'check' : null;
if (!mode) { console.error('usage: gen-debt-ledger.mjs --write | --check'); process.exit(2); }

// ── 1. Filesystem walk ──────────────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.git', '.wt', '.worktrees', '.claude']);
const RATCHET_NAME_RE = /(-baseline|-allowlist|-quarantine)\.json$/i;
const CODE_EXT_RE = /\.(mjs|py)$/i;

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else {
      out.push(join(dir, entry.name));
    }
  }
}

const allFiles = [];
walk(REPO, allFiles);

const SELF_PATH = fileURLToPath(import.meta.url);
const candidates = allFiles.filter((f) => RATCHET_NAME_RE.test(basename(f)));
// Self-excluded: this file's own header comment names an example filename
// (the art-114 false positive this check exists to reject) to explain the
// rule — without excluding SELF_PATH that mention would satisfy its own
// cross-reference check, same self-referential trap check-generator-
// coverage.mjs's header names for its own self-exclusion.
const codeFiles = allFiles.filter((f) => CODE_EXT_RE.test(f) && f !== SELF_PATH);
const codeFileText = new Map(); // lazy cache, read once per code file

function isReferenced(candidatePath) {
  const name = basename(candidatePath);
  for (const cf of codeFiles) {
    if (cf === candidatePath) continue;
    let text = codeFileText.get(cf);
    if (text === undefined) {
      text = readFileSync(cf, 'utf8');
      codeFileText.set(cf, text);
    }
    if (text.includes(name)) return true;
  }
  return false;
}

const ratchetFiles = candidates.filter(isReferenced).sort();

if (ratchetFiles.length === 0) {
  console.error('gen-debt-ledger: 0 ratchet baseline/allowlist/quarantine files discovered — refusing to treat that as a valid empty regen (SO #34c: absence is not a pass)');
  process.exit(3);
}

// ── 2. Per-file count extraction ────────────────────────────────────────
const nonMeta = (obj) => Object.keys(obj).filter((k) => !k.startsWith('_'));
const sumValues = (obj) => Object.values(obj).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0);
function sumNumericLeaves(v) {
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.reduce((a, x) => a + sumNumericLeaves(x), 0);
  if (v && typeof v === 'object') return Object.values(v).reduce((a, x) => a + sumNumericLeaves(x), 0);
  return 0;
}

// Keyed by repo-relative POSIX path. Each extractor reads the field(s) that
// file's own doctrine comment names as the shrink-only ceiling — never a
// `known_*` / `*_files` provenance-scope field, which records the checked
// universe, not outstanding debt.
const EXTRACTORS = {
  'scripts/amendment-detection-baseline.json': (j) => ({ n: j.length, what: 'baselined amendment-vs-citation contradictions (root list)' }),
  'scripts/asof-staleness-baseline.json': (j) => ({ n: j.past.length, what: 'baselined stale as-of table references' }),
  'scripts/authority-contradiction-baseline.json': (j) => ({ n: j.length, what: 'baselined cross-authority contradictions (root list)' }),
  'scripts/catalog-parity-baseline.json': (j) => ({ n: j.orphan_chain_pages.length, what: 'orphaned chain composer pages' }),
  'scripts/chain-handoff-register-baseline.json': (j) => ({ n: sumValues(j), what: 'causation-register sentences across all baselined chain pages, summed' }),
  'scripts/compute-proof-baseline.json': (j) => ({ n: j.deferred_nodes.length, what: 'nodes with a deferred compute-integrity proof' }),
  'scripts/copy-hallmarks-baseline.json': (j) => ({ n: sumNumericLeaves(nonMetaObj(j)), what: 'em-dash/jargon/bold/insider/AI-vocabulary hits across all baselined pages, summed' }),
  'scripts/csp-consistency-baseline.json': (j) => ({ n: j.missing.length, what: 'pages missing a matching CSP profile' }),
  'scripts/csv-injection-baseline.json': (j) => ({ n: j.files.length, what: 'CSV emitters without the injection-prefix guard' }),
  'scripts/dead-link-baseline.json': (j) => ({ n: j.dead.length, what: 'known dead internal links' }),
  'scripts/fv-floor-coverage-baseline.json': (j) => ({ n: j.unfloored_nodes.length, what: 'live kernels with no property-test floor' }),
  'scripts/generator-check-baseline.json': (j) => ({ n: j.gapless.length, what: 'writer scripts with no dedicated freshness check' }),
  'scripts/inline-ssot-sync-baseline.json': (j) => ({ n: (j.ocgCanon?.variants ?? []).length, what: 'pinned legacy inline-copy variants' }),
  'scripts/internal-lang-leak-baseline.json': (j) => ({ n: sumNumericLeaves(j.counts ?? {}), what: 'internal-language marker hits across all baselined pages, summed' }),
  'scripts/nav-island-baseline.json': (j) => ({ n: j.length, what: 'by-design unreachable pages (root list)' }),
  'scripts/node-completeness-baseline.json': (j) => ({ n: j.legacy_ids.length, what: 'nodes carrying legacy completeness debt' }),
  'scripts/page-determinism-baseline.json': (j) => ({ n: j.entries.length, what: 'pre-existing page-determinism defects' }),
  'scripts/s18-digest-freshness-baseline.json': (j) => ({ n: j.stale_nodes.length, what: 'nodes with a stale compute-integrity digest' }),
  'scripts/site-egress-baseline.json': (j) => ({ n: nonMeta(j.files ?? {}).length, what: 'files carrying a reviewed, inert egress-shaped text match' }),
  'scripts/binary-byte-allowlist.json': (j) => ({ n: nonMeta(j).length, what: 'files shielding a deliberate control byte' }),
  'scripts/c2patool-oracle-allowlist.json': (j) => ({ n: (j.entries ?? []).length, what: 'fixtures where the structural check and the external oracle diverge, by design' }),
  'scripts/kernel-determinism-allowlist.json': (j) => ({ n: (j.transcendentals?.files ?? []).length + (j.hard_ban_baseline?.entries ?? []).length, what: 'files calling an approximated transcendental, plus pre-existing hard-ban hits, combined' }),
  'scripts/original-authorship-bundle-allowlist.json': (j) => ({ n: nonMeta(j).length, what: 'bundle files carrying a recorded original-authorship reason' }),
  'scripts/recompute-equality-quarantine.json': (j) => ({ n: (j.nodes ?? []).length, what: 'nodes with a named, observed recompute-equality mismatch' }),
  'chaingraph/standard/spec-page-parity-baseline.json': (j) => ({ n: (j.missing ?? []).length, what: 'spec sections with no matching page coverage' }),
};
// copy-hallmarks-baseline.json has no meta keys at its root (every key is a
// per-page record) — kept as a tiny local helper so the shared nonMeta()
// above stays a plain filter, not a special case for one file.
function nonMetaObj(j) {
  const out = {};
  for (const k of nonMeta(j)) out[k] = j[k];
  return out;
}

function fallbackExtract(j) {
  // NOTE: these strings land in reader-facing copy inside fv-explainer.html, so they are
  // bound by CONTRACT.md §1.4 — no em-dashes. Use a comma. (Caught on main 2026-08-21:
  // the 26th ratchet file was the first to reach this fallback path, and its em-dash
  // redded copy-hallmarks, which in turn ejected every queued PR from the merge queue.)
  if (Array.isArray(j)) return { n: j.length, what: 'root list length (generic fallback, no dedicated extractor yet in gen-debt-ledger.mjs)' };
  const keys = nonMeta(j);
  return { n: keys.length, what: 'top-level entries (generic fallback, no dedicated extractor yet in gen-debt-ledger.mjs)' };
}

function lastChanged(absPath) {
  const rel = relative(REPO, absPath).split('\\').join('/');
  try {
    const out = execSync(`git log -1 --format=%ad --date=short -- "${rel}"`, { cwd: REPO, encoding: 'utf8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}

const rows = ratchetFiles.map((absPath) => {
  const rel = relative(REPO, absPath).split('\\').join('/');
  const classId = basename(absPath, '.json');
  const j = JSON.parse(readFileSync(absPath, 'utf8'));
  const extractor = EXTRACTORS[rel];
  const { n, what } = extractor ? extractor(j) : fallbackExtract(j);
  const changed = lastChanged(absPath);
  return { classId, rel, n, what, changed };
});

// ── 3. Render ────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const tableRows = rows.map((r) => `        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:.5rem .6rem;color:var(--bright);white-space:nowrap">${escHtml(r.classId)}</td>
          <td style="padding:.5rem .6rem"><a href="${escHtml(r.rel)}" target="_blank" rel="noopener" style="color:var(--teal-lt)">${escHtml(r.rel)}</a></td>
          <td style="padding:.5rem .6rem;text-align:right;color:var(--bright)">${r.n}</td>
          <td style="padding:.5rem .6rem;color:var(--muted)">${escHtml(r.what)}</td>
          <td style="padding:.5rem .6rem;color:var(--muted);white-space:nowrap">${escHtml(r.changed ?? 'unknown')}</td>
        </tr>`).join('\n');

const genBlock = `<!-- GEN:DEBT-LEDGER:START (generator-owned -- do not hand-edit; regenerate via node scripts/gen-debt-ledger.mjs --write) -->
<div class="section" id="debt-ledger">
  <div class="container">
    <div class="sec-label">Verification debt</div>
    <h2 class="sec-heading">Ratchet baseline ledger</h2>
    <p class="sec-hook">Every shrink-only baseline in the estate, counted from the file itself.</p>
    <div class="prose">
      <p>Some gates in this codebase shield known, already-reviewed debt behind a committed baseline file rather than blocking the build outright. A baseline records exactly what already existed when the gate went live; a new violation fails the build immediately; the baseline itself may only shrink over time. This table is produced by scanning the repository for every file that follows that pattern, so a newly added baseline is picked up automatically the next time this page regenerates, and a retired one drops off the same way. Each count below is read from the named file at generation time; none of it is entered by hand.</p>
    </div>
    <div class="qc-stat">
      <div class="qc-stat-num">${rows.length}</div>
      <div class="qc-stat-label">Baseline, allowlist and quarantine files currently tracked across the repository, found by filename pattern and confirmed by checking that some script actually reads each one.</div>
    </div>
    <div style="overflow-x:auto;margin-top:1.2rem">
      <table style="width:100%;border-collapse:collapse;font-family:'JetBrains Mono',monospace;font-size:.68rem">
        <thead>
          <tr style="border-bottom:1px solid var(--border-2)">
            <th style="text-align:left;padding:.5rem .6rem;color:var(--muted);font-weight:500">Class</th>
            <th style="text-align:left;padding:.5rem .6rem;color:var(--muted);font-weight:500">File</th>
            <th style="text-align:right;padding:.5rem .6rem;color:var(--muted);font-weight:500">Count</th>
            <th style="text-align:left;padding:.5rem .6rem;color:var(--muted);font-weight:500">What is counted</th>
            <th style="text-align:left;padding:.5rem .6rem;color:var(--muted);font-weight:500">Last changed</th>
          </tr>
        </thead>
        <tbody>
${tableRows}
        </tbody>
      </table>
    </div>
    <div class="prose" style="margin-top:1rem">
      <p>Last changed is the most recent commit date on that file, so a class that has been still for a long time reads as stable and one that moved recently reads as active. The trend for any class is the git history of its own file, linked above; this page keeps no separate time series.</p>
    </div>
  </div>
</div>
<!-- GEN:DEBT-LEDGER:END -->`;

const html = readFileSync(FV_EXPLAINER, 'utf8');
const BLOCK_RE = /<!-- GEN:DEBT-LEDGER:START[\s\S]*?GEN:DEBT-LEDGER:END -->/;
const AFTER_MARKER = '<!-- Chain-level composition checks (L2), separate from the 4-kernel pilot above -->';

if (mode === 'check') {
  const m = html.match(BLOCK_RE);
  if (!m) {
    console.error('gen-debt-ledger --check FAIL: GEN:DEBT-LEDGER markers not found in fv-explainer.html. Run: node scripts/gen-debt-ledger.mjs --write');
    process.exit(1);
  }
  if (m[0] !== genBlock) {
    console.error(`gen-debt-ledger --check FAIL: fv-explainer.html's debt ledger is stale against the ${rows.length} ratchet file(s) on disk. Run: node scripts/gen-debt-ledger.mjs --write`);
    process.exit(1);
  }
  console.log(`gen-debt-ledger --check: fv-explainer.html debt ledger fresh (${rows.length} ratchet class(es)).`);
  process.exit(0);
}

// --- WRITE ---------------------------------------------------------------
let out;
if (BLOCK_RE.test(html)) {
  out = html.replace(BLOCK_RE, genBlock);
} else {
  const idx = html.indexOf(AFTER_MARKER);
  if (idx === -1) {
    console.error('gen-debt-ledger: could not find an insertion point in fv-explainer.html (expected the L2 chain-checks comment marker)');
    process.exit(2);
  }
  out = html.slice(0, idx) + genBlock + '\n\n' + html.slice(idx);
}
writeFileSync(FV_EXPLAINER, out);
console.log(`gen-debt-ledger: wrote ${rows.length} ratchet class(es) into fv-explainer.html.`);
