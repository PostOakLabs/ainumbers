#!/usr/bin/env node
/**
 * sync-ain-bridge.mjs — BRIDGE-SNIPPET-SYNC-GEN-1.
 *
 * ONE WRITER for the AIN Bridge block on a published page. Before this script
 * the estate had no writer and no gate: the v1.1 rollout was a one-off regex
 * repair (scripts/fix-send-to-verify-global.py, anchored on a literal
 * `window.AINBridge={version:'1.0',`), and the per-page `bridge_version`
 * metadata was written by nothing at all. Measured 2026-09-28: 597 pages carry
 * window.AINBridge, 568 carry sendToVerify, 16 carry sessionRoot, 506 still
 * declare "bridge_version": "1.0".
 *
 * WHAT A "REGION" IS (measured on the canonical tool template,
 * tools/152-baas-provider-comparator.html lines 481-615, and on a ChainGraph
 * node page, chaingraph/art-01-ap2-mandate-chain-validator.html lines
 * 1149-1311). The region is a contiguous triple:
 *
 *   1. OPTIONAL header comment naming the master by its repo-relative path:
 *      <!-- === AIN Bridge v1.1: ... Master: scripts/ain-bridge-v1.snippet.html === -->
 *      Present on tools/ pages, ABSENT on the art-* node pages. Optional by
 *      measurement, not by taste.
 *   2. The per-page CFG line:
 *      <script>window.AIN_BRIDGE_CFG={runFn:'...',intake:...};</script>
 *      PAGE-SPECIFIC. Copied through BYTE-IDENTICAL, always.
 *   3. ONE <script> block holding the bridge body.
 *
 * WHAT THIS REWRITES. Only (1) the header comment's version token, (3) the
 * whole bridge body from the master, and - outside the region - the single
 * `"bridge_version": "X.Y"` token in the page's MANIFEST metadata. Everything
 * else in the file is asserted byte-identical before/after (assertOutsideBytes
 * below); a violated assert throws rather than writing.
 *
 * MODES
 *   node scripts/sync-ain-bridge.mjs --check            list drifted pages, exit 1 on drift, NO writes
 *   node scripts/sync-ain-bridge.mjs --check --summary  one line (count only), exit 1 on drift
 *   node scripts/sync-ain-bridge.mjs <path> [<path>...] rewrite the named pages
 *   node scripts/sync-ain-bridge.mjs --all              rewrite every page that carries a region
 * --check is wired into scripts/preflight.mjs as ADVISORY (prints the count,
 * never blocks). It becomes blocking in the last batch of BRIDGE-SNIPPET-ROLL-1,
 * not here — a blocking flip is a separate decision with a measured cost.
 *
 * The region finder is a pure function (findBridgeRegion) with unit tests in
 * scripts/sync-ain-bridge.test.mjs. It never regex-replaces across a page.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MASTER_PATH = resolve(REPO, 'scripts', 'ain-bridge-v1.snippet.html');
const PUBLISHED_DIRS = resolve(REPO, 'scripts', 'published-dirs.json');

// A WebMCP registration living INSIDE the bridge script block means the two
// blocks were merged by hand at some point. Never merge them further and never
// overwrite one with the master: SKIP the page and name it (safety assert (d)).
const WEBMCP_IN_BLOCK = /navigator\.modelContext|registerTool\s*\(|__AIN_WEBMCP/;

const CFG_OPEN = /<script>\s*window\.AIN_BRIDGE_CFG\s*=/g;
const SCRIPT_CLOSE = '</script>';
// The bridge body's signature line, present in every variant from the
// abbreviated v1.0 block to the v1.2 master.
const CONSUMES_CFG = /CFG\s*=\s*window\.AIN_BRIDGE_CFG/;
// Page-specific shim scripts allowed between the CFG line and the bridge block.
const MAX_PREAMBLE_SCRIPTS = 6;

/** Byte offset of every `<script>...window.AIN_BRIDGE_CFG=...</script>` element. */
function cfgElements(html) {
  const out = [];
  CFG_OPEN.lastIndex = 0;
  let m;
  while ((m = CFG_OPEN.exec(html)) !== null) {
    const close = html.indexOf(SCRIPT_CLOSE, m.index);
    if (close === -1) continue;
    out.push({ start: m.index, end: close + SCRIPT_CLOSE.length });
  }
  return out;
}

/**
 * The header comment immediately above the CFG line, or null. "Immediately"
 * means: only whitespace between its `-->` and the CFG line's `<script>`, and
 * its text names the bridge. The art-* node pages have none; that is legal.
 */
function precedingHeaderComment(html, cfgStart) {
  const before = html.slice(0, cfgStart);
  const closeIdx = before.lastIndexOf('-->');
  if (closeIdx === -1) return null;
  if (before.slice(closeIdx + 3).trim() !== '') return null;
  const openIdx = before.lastIndexOf('<!--', closeIdx);
  if (openIdx === -1) return null;
  const text = before.slice(openIdx, closeIdx + 3);
  if (!/AIN Bridge v\d+\.\d+/.test(text)) return null;
  return { start: openIdx, end: closeIdx + 3, text };
}

/**
 * Pure. Locate the bridge region in `html`.
 * Returns { ok: true, ... } or { ok: false, reason } — `reason` is the SKIP
 * label printed by --check and by the writer. Never throws.
 */
export function findBridgeRegion(html) {
  const cfgs = cfgElements(html);
  if (cfgs.length === 0) {
    // Distinguished, not conflated: a page with NO bridge at all is out of
    // scope, while a page whose CFG assignment sits inside a shared <script>
    // with the page's own JS (measured: chaingraph/art-15-agentic-mandate-
    // sandbox.html line 1046) HAS a bridge that no region can be cut out of.
    // The second is an estate hole the ROLL row must be told about by name.
    return {
      ok: false,
      reason: /window\.AIN_BRIDGE_CFG\s*=/.test(html) ? 'cfg-not-in-its-own-script-element' : 'no-bridge-region',
    };
  }
  // (a) exactly one region per page, else SKIP + list.
  if (cfgs.length > 1) return { ok: false, reason: `multiple-cfg-lines(${cfgs.length})` };
  const cfg = cfgs[0];
  const cfgLine = html.slice(cfg.start, cfg.end);

  // Walk the run of <script> elements that follows the CFG line. 37 pages
  // (measured: tools/109-cdd-edd-checklist.html line 534) put a page-specific
  // AIN_BUILD_MANDATE shim between the CFG line and the bridge block. That
  // shim is the page's own, exactly like the CFG line: it is carried through
  // byte-identical as part of the region's preamble, never rewritten and never
  // treated as "this page has no bridge". Bounded so a malformed page cannot
  // make the finder swallow the rest of the document.
  let cursor = cfg.end;
  let bridge = null;
  for (let i = 0; i < MAX_PREAMBLE_SCRIPTS && bridge === null; i += 1) {
    const open = html.indexOf('<script', cursor);
    if (open === -1) return { ok: false, reason: 'cfg-line-has-no-following-script' };
    if (html.slice(cursor, open).trim() !== '') return { ok: false, reason: 'cfg-line-not-adjacent-to-bridge-block' };
    const openEnd = html.indexOf('>', open);
    if (openEnd === -1) return { ok: false, reason: 'unterminated-script-open-tag' };
    const close = html.indexOf(SCRIPT_CLOSE, openEnd);
    if (close === -1) return { ok: false, reason: 'unterminated-bridge-script-block' };
    const scriptBody = html.slice(openEnd + 1, close);
    // The bridge body is identified by the line that CONSUMES the CFG, not by
    // the object it exports. 44 pages (measured: chaingraph/art-22-agentic-
    // payments-protocol-comparator.html, "AIN Bridge v1.0 (abbreviated)") carry
    // a real bridge block that never assigns window.AINBridge at all — testing
    // for the export files every one of them as "not the bridge" and hides the
    // exact pages furthest behind the master.
    if (CONSUMES_CFG.test(scriptBody)) {
      // A bridge block is a bare <script> — an attributed one (type=, src=) is
      // a different element and must not be swallowed.
      if (html.slice(open, openEnd + 1) !== '<script>') return { ok: false, reason: 'bridge-block-is-not-a-bare-script-tag' };
      bridge = { open, close, body: scriptBody };
    } else {
      cursor = close + SCRIPT_CLOSE.length;
    }
  }
  if (bridge === null) return { ok: false, reason: 'script-after-cfg-is-not-the-bridge' };
  const { close, body } = bridge;
  // Whitespace plus any page-specific shim scripts, verbatim.
  const preamble = html.slice(cfg.end, bridge.open);
  // (d) a WebMCP registration inside the same script block: SKIP, never merge.
  if (WEBMCP_IN_BLOCK.test(body)) return { ok: false, reason: 'webmcp-registration-inside-bridge-block' };
  const bridgeAssignments = (html.match(/window\.AINBridge\s*=/g) || []).length;
  if (bridgeAssignments > 1) return { ok: false, reason: `multiple-AINBridge-assignments(${bridgeAssignments})` };

  const comment = precedingHeaderComment(html, cfg.start);
  return {
    ok: true,
    start: comment ? comment.start : cfg.start,
    end: close + SCRIPT_CLOSE.length,
    comment,
    cfgLine,
    preamble,
    body,
  };
}

/** Pure. `var BRIDGE_VERSION='1.2'` is authoritative; `version:'1.2'` is the fallback. */
export function readVersion(body) {
  const v = body.match(/BRIDGE_VERSION\s*=\s*'([\d.]+)'/) || body.match(/version\s*:\s*'([\d.]+)'/);
  return v ? v[1] : null;
}

/** Pure. The master body + its version, read out of the snippet by the SAME finder. */
export function extractMaster(snippetHtml) {
  const r = findBridgeRegion(snippetHtml);
  if (!r.ok) throw new Error(`master snippet unreadable: ${r.reason}`);
  const version = readVersion(r.body);
  if (!version) throw new Error('master snippet declares no bridge version');
  return { body: r.body, version };
}

const BRIDGE_VERSION_META = /("bridge_version"\s*:\s*")([\d.]+)(")/g;

/**
 * (b), mechanically. Everything before the region start and everything after
 * the region end must be byte-identical. Throws — a failed assert must never
 * reach a write.
 */
function assertOutsideBytes(before, after, start, endBefore, endAfter) {
  if (before.slice(0, start) !== after.slice(0, start)) {
    throw new Error('SAFETY: bytes BEFORE the bridge region changed');
  }
  if (before.slice(endBefore) !== after.slice(endAfter)) {
    throw new Error('SAFETY: bytes AFTER the bridge region changed');
  }
}

/**
 * Reverse the metadata edit and require the original back, byte for byte. A
 * spot check on each match index would pass even if the loop had also mangled
 * the text between two matches; reconstructing the whole file cannot.
 */
function assertOnlyVersionTokensMoved(before, after, metas, version) {
  let restored = after;
  for (const t of [...metas].reverse()) {
    const head = restored.slice(0, t.index);
    const tail = restored.slice(t.index + t[1].length + version.length + t[3].length);
    restored = head + t[1] + t[2] + t[3] + tail;
  }
  if (restored !== before) {
    throw new Error('SAFETY: the bridge_version rewrite touched bytes beyond the version tokens');
  }
}

/**
 * Pure. The page's `out` bytes for `master`, or a SKIP.
 * Returns { ok:true, out, changed, region } | { ok:false, reason }.
 */
export function rewritePage(html, master) {
  const region = findBridgeRegion(html);
  if (!region.ok) return region;

  const comment = region.comment
    ? region.comment.text.replace(/AIN Bridge v\d+\.\d+/, `AIN Bridge v${master.version}`) + '\n'
    : '';
  const newRegion = `${comment}${region.cfgLine}${region.preamble}<script>${master.body}</script>`;

  const staged = html.slice(0, region.start) + newRegion + html.slice(region.end);
  // (b) bytes outside the region unchanged — asserted on the indices, not on a
  // summary of them.
  assertOutsideBytes(html, staged, region.start, region.end, region.start + newRegion.length);

  // The metadata lives OUTSIDE the region, so its offsets moved with the region
  // swap: re-locate in `staged`. A page may carry the field MORE THAN ONCE (46
  // pages do — e.g. tools/290-policy-register.html declares it both in the
  // pretty-printed manifest block at line 26 and in the inline MANIFEST
  // JSON.parse at line 556). They describe the same page and must move
  // together; stamping one and leaving the other is the drift this row exists
  // to end. Only the version token inside each match is touched.
  const metas = [...staged.matchAll(BRIDGE_VERSION_META)];
  let out = staged;
  for (const t of [...metas].reverse()) {
    out = out.slice(0, t.index) + t[1] + master.version + t[3] + out.slice(t.index + t[0].length);
  }
  assertOnlyVersionTokensMoved(staged, out, metas, master.version);

  return { ok: true, out, changed: out !== html, region };
}

/**
 * (c) the rewrite must not REGRESS the two page gates. Not "passes them": most
 * of the estate carries pre-existing hallmark debt shielded by
 * scripts/copy-hallmarks-baseline.json, so a pass requirement would SKIP every
 * page and gate nothing. The honest invariant is a non-regression: a page that
 * was clean stays clean, a page that carried the CONTRACT §1.3 banner keeps it.
 * Imported lazily so --check never pays for the two modules.
 */
export async function assertNoGateRegression(relPath, before, after) {
  // Sequential, NOT Promise.all: the two gates share a CJS dependency
  // (scripts/_changed-files-lib.js), and importing them concurrently trips
  // Node's "Cannot require() ES Module ... not yet fully loaded" internal
  // assertion. Measured, not defensive.
  const hall = await import('./check-copy-hallmarks.mjs');
  const pii = await import('./check-pii-banner.mjs');
  const debtBefore = hall.hasHallmarkDebt(hall.hallmarkFindings(before));
  const debtAfter = hall.hasHallmarkDebt(hall.hallmarkFindings(after));
  if (debtAfter && !debtBefore) {
    throw new Error(`SAFETY: ${relPath} gained copy-hallmark debt (check-copy-hallmarks.mjs)`);
  }
  if (pii.hasCanonicalBanner(before) && !pii.hasCanonicalBanner(after)) {
    throw new Error(`SAFETY: ${relPath} lost the CONTRACT §1.3 PII banner (check-pii-banner.mjs)`);
  }
}

/**
 * Every published page, from the SHARED manifest scripts/published-dirs.json —
 * the same file regen-sitemap.mjs and verify_repo.py's check_sitemap read, so
 * this scope cannot drift from theirs by a hand edit here.
 */
export function publishedPages() {
  const m = JSON.parse(readFileSync(PUBLISHED_DIRS, 'utf8'));
  const excluded = new Set((m.recursiveExcludeSubdirs || []).map((d) => d.replace(/\\/g, '/')));
  const out = [];

  const push = (abs) => {
    if (abs.endsWith('.html') && existsSync(abs)) out.push(abs);
  };
  for (const d of m.flatDirs || []) {
    const abs = resolve(REPO, d);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) push(join(abs, f));
  }
  const walk = (abs) => {
    if (excluded.has(relative(REPO, abs).replace(/\\/g, '/'))) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, e.name);
      if (e.isDirectory()) walk(child);
      else push(child);
    }
  };
  for (const d of m.recursiveDirs || []) {
    const abs = resolve(REPO, d);
    if (existsSync(abs) && statSync(abs).isDirectory()) walk(abs);
  }
  for (const p of m.rootPages || []) push(resolve(REPO, p.path));

  return [...new Set(out)].sort();
}

function rel(abs) {
  return relative(REPO, abs).replace(/\\/g, '/');
}

/** Scan (no writes). Returns { scanned, drifted[], skipped[{path,reason}] }. */
export function scan(files, master) {
  const drifted = [];
  const skipped = [];
  let scanned = 0;
  for (const f of files) {
    const html = readFileSync(f, 'utf8');
    if (!/window\.AIN_BRIDGE_CFG\s*=/.test(html)) continue; // not a bridge page at all
    scanned += 1;
    const r = rewritePage(html, master);
    if (!r.ok) skipped.push({ path: rel(f), reason: r.reason });
    else if (r.changed) drifted.push(rel(f));
  }
  return { scanned, drifted, skipped };
}

async function writePages(relPaths, master) {
  let written = 0;
  for (const p of relPaths) {
    const abs = resolve(REPO, p);
    const html = readFileSync(abs, 'utf8');
    const r = rewritePage(html, master);
    if (!r.ok || !r.changed) continue;
    await assertNoGateRegression(rel(abs), html, r.out);
    writeFileSync(abs, r.out);
    written += 1;
  }
  return written;
}

async function main(argv) {
  const master = extractMaster(readFileSync(MASTER_PATH, 'utf8'));
  const CHECK = argv.includes('--check');
  const SUMMARY = argv.includes('--summary');
  const ALL = argv.includes('--all');
  const paths = argv.filter((a) => !a.startsWith('--'));

  // Scan scope: explicit paths win; otherwise the published estate.
  const files = paths.length ? paths.map((p) => resolve(REPO, p)) : publishedPages();

  if (CHECK || (!ALL && paths.length === 0)) {
    const res = scan(files, master);
    console.log(
      `sync-ain-bridge: master v${master.version} · ${res.scanned} bridge page(s) scanned · ` +
        `${res.drifted.length} DRIFTED · ${res.skipped.length} SKIP`,
    );
    if (!SUMMARY) {
      for (const p of res.drifted) console.log(`  DRIFT ${p}`);
      for (const s of res.skipped) console.log(`  SKIP  ${s.path}: ${s.reason}`);
    } else if (res.skipped.length) {
      // Grouped, with up to three named pages per reason: a bare count tells
      // the ROLL row how many pages it will not reach but not WHICH shape to
      // look at, and an unexamined SKIP is how a silent estate hole starts.
      const byReason = new Map();
      for (const s of res.skipped) {
        if (!byReason.has(s.reason)) byReason.set(s.reason, []);
        byReason.get(s.reason).push(s.path);
      }
      for (const [reason, paths2] of byReason) {
        const eg = paths2.slice(0, 3).join(', ') + (paths2.length > 3 ? `, +${paths2.length - 3} more` : '');
        console.log(`  SKIP ${reason} = ${paths2.length}  e.g. ${eg}`);
      }
    }
    return CHECK && res.drifted.length > 0 ? 1 : 0;
  }

  const res = scan(files, master);
  const written = await writePages(res.drifted, master);
  console.log(
    `sync-ain-bridge: master v${master.version} · ${res.scanned} bridge page(s) scanned · ` +
      `${written} REWRITTEN · ${res.skipped.length} SKIP`,
  );
  for (const s of res.skipped) console.log(`  SKIP ${s.path}: ${s.reason}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
