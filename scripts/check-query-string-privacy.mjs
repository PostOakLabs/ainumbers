#!/usr/bin/env node
/**
 * scripts/check-query-string-privacy.mjs — QUERYSTRING-PRIVACY-1
 *
 * WHY: the privacy promise is that no AINumbers server ever sees what a user
 * enters. A URL fragment (`#...`) never leaves the browser; a query string
 * (`?...`) is sent to the host every single time the link is opened, and it
 * lands in the host's access log. CONTRACT §2.4 already makes deep links
 * fragment-only (`#in=`), but the `location.search` check in
 * scripts/check-deeplink-contract.mjs only covers the WebMCP-registered pages,
 * so the rule held over a subset of the estate and nowhere else. Tool 08 built
 * its share link with `?s=<base64 merchant config>` under copy that said "No
 * data is sent to any server"; tool 477 emitted and read `?prefill=` links
 * carrying customer-risk attributes.
 *
 * WHAT IT ASSERTS, over every .html under the published directories
 * (scripts/published-dirs.json — the same shared manifest the sitemap
 * generator and its gate read, so scope cannot drift by hand-edit):
 *
 *   1. no `location.search` read,
 *   2. no `URLSearchParams(` construction,
 *   3. no history.replaceState/pushState whose URL argument is a string
 *      literal containing `?`,
 *
 * except for two narrowly-shaped BENIGN patterns, recognised structurally
 * rather than baselined one page at a time:
 *
 *   (a) EMBED FLAG — `/[?&]embed=1/.test(location.search)`. A display flag,
 *       carrying no user input, on 100+ pages.
 *   (b) FRAGMENT STRIP — `history.replaceState(null,'',location.pathname
 *       + location.search)`, which REMOVES a fragment after prefill and adds
 *       nothing to the query.
 *
 * and for whatever is listed in scripts/query-string-privacy-baseline.json.
 * That baseline is SHRINK-ONLY by construction: an entry permits at most its
 * recorded occurrence count for one file and one token, and anything not
 * listed is a hard failure. Fewer occurrences than recorded is reported as
 * prunable debt, never as a pass-by-silence.
 *
 * ⛔ THE BASELINE IS NOT A PLACE TO PARK NEW WORK. It holds exactly the two
 * legacy `?` -> `#` converters on tools 08 and 13, each with its reason. A new
 * entry means a new page is sending user state to the host.
 *
 * USAGE
 *   node scripts/check-query-string-privacy.mjs              — check (exit 1 on a violation)
 *   node scripts/check-query-string-privacy.mjs --self-test  — paired RED/GREEN mutation control
 *
 * Zero-dep, text-based, reads only tracked repo files.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const BASELINE_PATH = resolve(HERE, 'query-string-privacy-baseline.json');
const DIRS_PATH = resolve(HERE, 'published-dirs.json');

/* ── the published surface ─────────────────────────────────────────────── */

function publishedHtmlFiles() {
  const cfg = JSON.parse(readFileSync(DIRS_PATH, 'utf8'));
  const out = [];
  const excluded = new Set(cfg.recursiveExcludeSubdirs || []);

  const addFlat = (dir) => {
    const abs = resolve(ROOT, dir);
    if (!existsSync(abs)) return;
    for (const name of readdirSync(abs)) {
      if (name.endsWith('.html')) out.push(join(dir, name));
    }
  };
  const addRecursive = (dir) => {
    const abs = resolve(ROOT, dir);
    if (!existsSync(abs)) return;
    for (const name of readdirSync(abs)) {
      const rel = `${dir}/${name}`;
      if (excluded.has(rel)) continue;
      const st = statSync(resolve(ROOT, rel));
      if (st.isDirectory()) addRecursive(rel);
      else if (name.endsWith('.html')) out.push(rel);
    }
  };

  for (const d of cfg.flatDirs || []) addFlat(d);
  for (const d of cfg.recursiveDirs || []) addRecursive(d);
  for (const s of cfg.externalSurfaces || []) addRecursive(s.dir);
  for (const p of cfg.rootPages || []) {
    if (p.path.endsWith('.html') && existsSync(resolve(ROOT, p.path))) out.push(p.path);
  }
  return [...new Set(out.map((p) => p.replace(/\\/g, '/')))].sort();
}

/* ── the scan ──────────────────────────────────────────────────────────── */

const WINDOW = 120; // chars of context used to recognise a benign shape

/** Slice of surrounding text used to classify one occurrence. */
function around(text, idx, len) {
  return text.slice(Math.max(0, idx - WINDOW), idx + len + WINDOW);
}

/**
 * (a) EMBED FLAG: the occurrence sits next to an `embed=1` query-flag test.
 * Deliberately narrow — `embed` alone would excuse any parameter whose name
 * happened to start with it.
 */
function isEmbedFlag(ctx) {
  // Either the regex-literal form `/[?&]embed=1/` or a plain `?embed=1` / `&embed=1`.
  return /(?:\[\?&\]|[?&])embed=1/.test(ctx);
}

/**
 * (b) FRAGMENT STRIP: replaceState/pushState that rebuilds the CURRENT url
 * from pathname + the EXISTING search, i.e. drops the fragment and adds
 * nothing to the query.
 */
function isFragmentStrip(ctx) {
  return /(replaceState|pushState)\s*\([^;]*location\.pathname\s*\+\s*(window\.)?location\.search/.test(ctx);
}

/** Argument text of a history call, from the open paren, depth-aware, capped. */
function callArgs(text, openParenIdx) {
  let depth = 0;
  const cap = Math.min(text.length, openParenIdx + 600);
  for (let i = openParenIdx; i < cap; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return text.slice(openParenIdx + 1, i);
    }
  }
  return text.slice(openParenIdx + 1, cap);
}

/**
 * Does any STRING LITERAL inside the args contain a literal `?`.
 *
 * Tokenised rather than regexed: a naive /'[^']*\?/ matches ACROSS two
 * separate literals, so `pushState(null, '', location.pathname + (h ? h : ''))`
 * reads as a query-string write when it is a plain ternary (measured on
 * ledger/index.html:3166).
 */
function hasQueryStringLiteral(args) {
  let i = 0;
  while (i < args.length) {
    const q = args[i];
    if (q === "'" || q === '"' || q === '`') {
      i++;
      let body = '';
      while (i < args.length && args[i] !== q) {
        if (args[i] === '\\') { i += 2; continue; }
        body += args[i];
        i++;
      }
      i++; // closing quote
      if (body.includes('?')) return true;
      continue;
    }
    i++;
  }
  return false;
}

/**
 * (c) FRAGMENT PARSE: `new URLSearchParams(location.hash.replace(/^#/,''))`.
 * The `&`-separated key/value grammar is reused to read the FRAGMENT, which is
 * never transmitted. No query string is involved.
 */
function isFragmentParse(args, ctx) {
  return /location\.hash/.test(args) || (/\^#/.test(args) && /location\.hash/.test(ctx));
}

function lineOf(text, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (text[i] === '\n') n++;
  return n;
}

/**
 * Scan one file's text. Returns [{token, line, why}] for every occurrence that
 * is NOT structurally benign. Exported so --self-test can drive it against
 * in-memory fixtures rather than the tree.
 */
export function scanText(text) {
  const hits = [];

  for (const m of text.matchAll(/location\.search/g)) {
    const ctx = around(text, m.index, m[0].length);
    if (isEmbedFlag(ctx) || isFragmentStrip(ctx)) continue;
    hits.push({ token: 'location.search', line: lineOf(text, m.index), why: 'reads the query string' });
  }

  for (const m of text.matchAll(/URLSearchParams\s*\(/g)) {
    const ctx = around(text, m.index, m[0].length);
    const args = callArgs(text, m.index + m[0].length - 1);
    if (isEmbedFlag(ctx) || isFragmentParse(args, ctx)) continue;
    hits.push({ token: 'URLSearchParams(', line: lineOf(text, m.index), why: 'builds or parses a query string' });
  }

  for (const m of text.matchAll(/\b(?:history|window\.history)\.(replaceState|pushState)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const args = callArgs(text, open);
    if (!hasQueryStringLiteral(args)) continue;
    hits.push({
      token: `history.${m[1]}`,
      line: lineOf(text, m.index),
      why: 'writes a literal `?` into the address bar',
    });
  }

  return hits;
}

/* ── baseline ──────────────────────────────────────────────────────────── */

function loadBaseline() {
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const map = new Map();
  for (const e of raw.allowed || []) map.set(`${e.file}\u0000${e.token}`, e);
  return map;
}

/* ── self-test (GATE-SELFTEST-META-1 / SO #34c pairing) ────────────────── */

const RED_FIXTURES = [
  ['planted location.search read',
    '<script>var p = new URLSearchParams(location.search); var v = p.get("s");</script>'],
  ['planted query-string share link',
    '<script>history.replaceState({}, "", "?t=" + id);</script>'],
  ['planted URLSearchParams construction',
    '<script>var q = new URLSearchParams({a: 1});</script>'],
];

const GREEN_FIXTURES = [
  ['embed flag',
    '<script>if (/[?&]embed=1/.test(location.search)) document.body.classList.add("embed");</script>'],
  ['fragment strip',
    '<script>history.replaceState(null, "", location.pathname + location.search);</script>'],
  ['fragment read',
    '<script>var m = (location.hash||"").match(/[#&]s=([^&]+)/);</script>'],
  ['fragment write',
    '<script>window.history.replaceState({}, "", "#t=" + id);</script>'],
  ['ternary is not a query string',
    '<script>var x = cond ? "a" : "b"; history.replaceState({}, "", "#" + x);</script>'],
  ['ternary between two empty literals (ledger router shape)',
    '<script>window.history.pushState(null, "", location.pathname + (hash ? hash : ""));</script>'],
  ['URLSearchParams over the fragment (art-192 prefill shape)',
    '<script>var h = String(location.hash || ""); var p = new URLSearchParams(h.replace(/^#/, ""));</script>'],
];

function selfTest() {
  let bad = 0;
  for (const [name, src] of RED_FIXTURES) {
    const hits = scanText(src);
    if (hits.length === 0) { console.error(`  ✗ RED fixture did not fire: ${name}`); bad++; }
    else console.log(`  ✓ RED  ${name} (${hits.map((h) => h.token).join(', ')})`);
  }
  for (const [name, src] of GREEN_FIXTURES) {
    const hits = scanText(src);
    if (hits.length > 0) { console.error(`  ✗ GREEN fixture fired: ${name} — ${JSON.stringify(hits)}`); bad++; }
    else console.log(`  ✓ GREEN ${name}`);
  }
  if (bad) {
    console.error(`\n✗ check-query-string-privacy --self-test FAILED (${bad} control(s))`);
    process.exit(1);
  }
  console.log('\n✓ check-query-string-privacy --self-test OK — detector fires on a planted query-string read and stays quiet on the benign shapes.');
}

/* ── main ──────────────────────────────────────────────────────────────── */

function main() {
  const files = publishedHtmlFiles();
  if (files.length === 0) {
    console.error('✗ check-query-string-privacy: published surface came back EMPTY — nothing was compared (SO #34c: absence is not a pass).');
    process.exit(1);
  }

  const baseline = loadBaseline();
  const seen = new Map(); // key -> count
  const violations = [];

  for (const rel of files) {
    const text = readFileSync(resolve(ROOT, rel), 'utf8');
    for (const hit of scanText(text)) {
      const key = `${rel}\u0000${hit.token}`;
      seen.set(key, (seen.get(key) || 0) + 1);
      const allowed = baseline.get(key);
      if (allowed && seen.get(key) <= allowed.count) continue;
      violations.push({ file: rel, ...hit });
    }
  }

  // Shrink-only accounting: a baseline entry that no longer matches is debt
  // that has been paid, and it must be pruned rather than left to shield a
  // future regression on the same file.
  const prunable = [];
  for (const [key, entry] of baseline) {
    const count = seen.get(key) || 0;
    if (count < entry.count) prunable.push({ ...entry, actual: count });
  }

  console.log(`check-query-string-privacy: ${files.length} published page(s) scanned, ` +
    `${baseline.size} baselined legacy converter(s), ${violations.length} violation(s).`);

  if (prunable.length) {
    console.log('\nBaseline debt has shrunk — prune these entries in scripts/query-string-privacy-baseline.json:');
    for (const p of prunable) console.log(`  · ${p.file} [${p.token}] recorded ${p.count}, now ${p.actual}`);
  }

  if (violations.length) {
    console.error(`\n✗ check-query-string-privacy FAILED — ${violations.length} page(s) move user state through the query string:\n`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  [${v.token}] ${v.why}`);
    }
    console.error('\nA query string is sent to the host on every open. Put the state in the URL FRAGMENT');
    console.error('(`#...`), which the browser never transmits — CONTRACT §2.4 `#in=` for deep links.');
    console.error('If the read is a one-time legacy `?` -> `#` converter, add it to');
    console.error('scripts/query-string-privacy-baseline.json with its reason.');
    process.exit(1);
  }

  console.log('\n✓ query-string privacy clean — no published page reads or writes user state through a query string.');
}

if (process.argv.includes('--self-test')) selfTest();
else main();
