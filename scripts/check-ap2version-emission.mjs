#!/usr/bin/env node
/**
 * check-ap2version-emission.mjs — ratchet gate for the RETIRED `ap2_version`
 * payload field (AP2VERSION-RETIREMENT-SWEEP-1).
 *
 * CONTRACT §3.1 / §A3.2: the in-payload `ap2_version` field (value "1.0"/"1.0.0")
 * was retired at v0.4 — `chaingraph_version` is the sole envelope version and the
 * field is "no longer emitted". This gate enforces the emission half: a payload
 * LITERAL (bare object key `ap2_version:` with a quoted string value) inside a
 * live <script> block of any tracked .html file is RED.
 *
 * SCOPE — the EMISSION SHAPE ONLY (the row's hard requirement):
 *   - Quoted-key references ('ap2_version' in m, req:['ap2_version',...],
 *     m.ap2_version !== '1.0', validator _fail/_warn back-compat paths) are NOT
 *     emissions and never fire this gate — a mention-shape lint would red every
 *     validator and get disabled within a week.
 *   - JS comments (// and block /* *​/), HTML comments, and non-JS script blocks
 *     (ld+json, src=) are PROSE/data and never fire this gate.
 *   - The check is comment-aware and string-aware (a `ap2_version:` inside a
 *     quoted string or comment is not a bare object key).
 *
 * RATCHET MECHANISM — baseline shape (scripts/ap2version-emission-baseline.json):
 *   Baseline files are ones whose KEPT in-file validator hard-requires the field
 *   on their own export path (req-list / `!p.ap2_version` / `!== '1.0'` checks
 *   wired into validate-before-download). Deleting their emission would break
 *   their export buttons (the row's "report, don't fix blind" class), so the
 *   emission is grandfathered there and the follow-up fix (relax the validator,
 *   then drop the emission) shrinks the baseline. A file NOT in the baseline
 *   must carry ZERO emission occurrences — any new emission is RED. Baseline
 *   counts may only go down.
 *
 * Enumeration is `git ls-files` (tracked files only) — never a directory walk
 * (SO #52: worktree fan-out makes recursive walks edit other sessions' trees).
 *
 * Usage:
 *   node scripts/check-ap2version-emission.mjs            # gate (preflight + CI)
 *   node scripts/check-ap2version-emission.mjs --update   # regenerate baseline from the live tree
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE_PATH = resolve(REPO, 'scripts', 'ap2version-emission-baseline.json');
const UPDATE = process.argv.includes('--update');

// ── classifier (string-aware, comment-aware) ────────────────────────────────
export function scriptSpans(html) {
  const spans = []; const SRE = /<script\b([^>]*)>/gi; let m;
  while ((m = SRE.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;               // external js — not ours
    const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    if (/ld\+json/i.test(type)) continue;                  // data island — not JS
    const cs = SRE.lastIndex;
    const ce = html.indexOf('</script>', cs);
    if (ce === -1) break;
    spans.push({ contentStart: cs, contentEnd: ce });
    SRE.lastIndex = ce + 9;
  }
  return spans;
}

export function jsCommentSpans(js) {
  const ranges = []; let i = 0; const n = js.length;
  const isQ = (c) => c === "'" || c === '"' || c === '`';
  while (i < n) {
    const c = js[i];
    if (c === '/' && js[i + 1] === '/') { let j = js.indexOf('\n', i); if (j === -1) j = n; ranges.push([i, j]); i = j; continue; }
    if (c === '/' && js[i + 1] === '*') { let j = js.indexOf('*/', i + 2); j = j === -1 ? n : j + 2; ranges.push([i, j]); i = j; continue; }
    if (isQ(c)) { const q = c; let j = i + 1; while (j < n) { if (js[j] === '\\') j += 2; else if (js[j] === q) { j++; break; } else j++; } i = j; continue; }
    i++;
  }
  return ranges;
}

const EMITS_AT = /^ap2_version\s*:\s*(['"])((?:(?!\1).)*)\1/;

/**
 * Every ap2_version occurrence in one html string, classified.
 *   EMITS               — bare object key with a quoted string value, in live JS
 *   VALIDATES_TOLERATES — other live-JS references (validator/back-compat paths)
 *   PROSE               — non-script text, html comments, JS comments
 * Exported for the paired self-test.
 */
export function classifyAp2VersionOccurrences(html) {
  const occ = [];
  let outside = 0, oi = 0;
  // occurrences outside any script block are PROSE (page copy, html comments)
  const pieces = [];
  let last = 0;
  for (const s of scriptSpans(html)) { pieces.push(html.slice(last, s.contentStart)); last = s.contentEnd; pieces.push(null); }
  pieces.push(html.slice(last));
  for (const p of pieces) {
    if (p !== null) outside += (p.match(/ap2_version/g) || []).length;
  }
  if (outside) occ.push({ cls: 'PROSE', count: outside, where: 'outside-script' });
  for (const s of scriptSpans(html)) {
    const js = html.slice(s.contentStart, s.contentEnd);
    const comments = jsCommentSpans(js);
    const inComment = (i) => comments.some(([a, b]) => i >= a && i < b);
    let idx = js.indexOf('ap2_version');
    while (idx !== -1) {
      const prev = idx === 0 ? '' : js[idx - 1];
      if (inComment(idx)) occ.push({ cls: 'PROSE', count: 1, where: 'js-comment' });
      else if (/['"\w.$-]/.test(prev)) occ.push({ cls: 'VALIDATES_TOLERATES', count: 1, where: 'quoted-key-or-member' });
      else if (EMITS_AT.test(js.slice(idx))) occ.push({ cls: 'EMITS', count: 1, where: 'payload-literal', line: js.slice(0, idx).split('\n').length });
      else occ.push({ cls: 'VALIDATES_TOLERATES', count: 1, where: 'live-js-ref' });
      idx = js.indexOf('ap2_version', idx + 1);
    }
  }
  return occ;
}

export function emissionLines(html) {
  return classifyAp2VersionOccurrences(html).filter((o) => o.cls === 'EMITS');
}

function trackedHtmlFiles() {
  const out = execSync('git ls-files -- "*.html"', { cwd: REPO, encoding: 'utf8' });
  return out.split('\n').map((s) => s.replace(/\r/g, '').trim()).filter(Boolean);
}

function liveEmissions() {
  const findings = {};
  for (const rel of trackedHtmlFiles()) {
    const html = readFileSync(resolve(REPO, rel), 'utf8');
    const hits = emissionLines(html);
    if (hits.length) findings[rel] = hits.length;
  }
  return findings;
}

const shebangGuard = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (shebangGuard) {
  const findings = liveEmissions();
  if (UPDATE) {
    const before = existsSync(BASELINE_PATH)
      ? new Set(Object.keys(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files || {}))
      : new Set();
    const files = {};
    for (const rel of Object.keys(findings).sort()) files[rel] = 'grandfathered (kept in-file validator hard-requires the field on its own export path)';
    const added = Object.keys(files).filter((f) => !before.has(f));
    const removed = [...before].filter((f) => !files[f]);
    writeFileSync(BASELINE_PATH, JSON.stringify({ files }, null, 2) + '\n');
    console.log(`ap2version-emission: baseline written — ${Object.keys(files).length} grandfathered file(s); +added=[${added.join(', ')}] -removed=[${removed.join(', ')}]. Counts only go down.`);
    process.exit(0);
  }
  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : { files: {} };
  const baseSet = new Set(Object.keys(baseline.files || {}));
  const failures = [];
  for (const [rel, n] of Object.entries(findings)) {
    if (!baseSet.has(rel)) failures.push(`${rel}: NEW retired-field emission x${n} — ap2_version payload literal in live JS (CONTRACT §3.1/§A3.2: retired at v0.4, no longer emitted)`);
  }
  const improvements = [...baseSet].filter((f) => !findings[f]);
  if (improvements.length) console.log(`ap2version-emission: ${improvements.length} baseline file(s) no longer emit — tighten with --update: ${improvements.join(', ')}`);
  if (failures.length) {
    console.error(`\nap2version-emission: ${failures.length} FAILURE(s):\n  ` + failures.join('\n  '));
    console.error('\nThe in-payload ap2_version field is RETIRED (CONTRACT §3.1/§A3.2) — new tools MUST NOT emit it. Baselined files (scripts/ap2version-emission-baseline.json) are grandfathered because their kept validator hard-requires the field; their count may only go down.');
    process.exit(1);
  }
  console.log(`ap2version-emission: OK — 0 emission occurrences outside baseline; ${baseSet.size} grandfathered file(s) within ratchet.`);
}
