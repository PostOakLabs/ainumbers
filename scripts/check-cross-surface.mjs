#!/usr/bin/env node
/**
 * check-cross-surface.mjs — XSURF-CHECKER-1: the cross-surface fact-consistency
 * detector.
 *
 * WHY THIS EXISTS
 * ---------------
 * The 2026-08-23 cross-surface audit measured the estate pair by pair. The only
 * two surface pairs that never drift are the two with a single mechanical
 * writer (repo<->worker 634/634 clean; shard->catalog->register->okf 1900/1900
 * clean). Every hand-maintained pair drifts, and nothing watched. This script
 * does not fix any writer. It makes the drift visible, so the writer question
 * can be settled surface by surface instead of in the dark.
 *
 * The concrete failure it closes: a kernel PR lands without its page (or the
 * reverse), the two surfaces publish different regulatory strings for the same
 * node, and no gate in the estate notices.
 *
 * FIVE LEGS
 * ---------
 *   (a) PAGE <-> KERNEL payload-string parity  [GATING, baselined, ratchet down]
 *       table_version / table_source / regulatory_basis / mcp_name /
 *       TOOL_VERSION. Normalized set-difference in both directions.
 *
 *   (b) REGISTER <-> KERNEL-SOURCE digest      [REPORT-ONLY, NEVER FAILS CI]
 *       register.kernel_digest vs a recomputed source digest. Tim's ruling
 *       2026-08-23 is explicit: detection now, policy separately. Every stale
 *       entry sits under trust_label "independently verified", so failing CI
 *       here would red the estate on a question that has not been decided.
 *       This leg has no baseline, no exit code, and never edits a register
 *       entry. See "LEG (b) IS REPORT-ONLY" below.
 *
 *   (c) FLAG-GHOST lint                        [GATING, baselined, ratchet down]
 *       An UPPER_SNAKE token in a shard description must exist somewhere in the
 *       kernel source. A description that advertises a flag the kernel never
 *       emits is a promise to an agent that the estate cannot keep.
 *
 *   (d) KERNEL-META <-> SHARD mcp_name         [GATING, baselined, ratchet down]
 *       kernel `export const meta.mcp_name` == shard `mcp_name`. A split here
 *       means the worker registers one tool name and the graph publishes
 *       another. REPORTING the splits is this script's job; FIXING them is
 *       MCPNAME-KERNEL-ALIGN-1's row, which is why the known splits are
 *       baselined rather than repaired here.
 *
 *   (e) WIRING — preflight AND CI. A preflight-only checker is the
 *       check-vs-CI divergence class this estate has been bitten by twice.
 *       Wired into scripts/preflight.mjs (which scripts-verify.yml runs in
 *       full), .github/workflows/land-verify.yml (fires on kernel + shard
 *       paths) and .github/workflows/html-verify.yml (fires on page paths), so
 *       every surface this script reads is covered by at least one CI trigger.
 *
 * NORMALIZATION — STATED, BECAUSE AN UNSTATED NORMALIZATION IS A SILENT WAIVER
 * ---------------------------------------------------------------------------
 * Leg (a) compares payload strings after normalizeValue(), in this order:
 *   1. Unicode NFKC.
 *   2. Dash unification: en/em/minus/figure/horizontal-bar dashes -> "-".
 *   3. Quote unification: curly single/double quotes -> "'" / '"'.
 *   4. Section-sign spacing: "§ 232.4" -> "§232.4".
 *   5. Whitespace: every run collapses to one space; ends trimmed.
 *   6. Commas dropped entirely (legal citation strings differ only in comma
 *      placement: "80 FR 43560, Jul 22, 2015" vs "80 FR 43560 Jul 22 2015").
 *   7. SENTENCE-FINAL periods dropped -- a "." only when followed by
 *      whitespace or end-of-string. Decimal points and citation numerals
 *      ("§232.4", "1.0.0") are deliberately PRESERVED, so "§232.4" and
 *      "§23.24" never collide into equality.
 *   8. Lowercase.
 * NOT normalized, so a difference in any of these is still a violation:
 * digits, letters, parentheses, semicolons, colons, slashes, "§", "$", "%",
 * and word order.
 *
 * LEG (a) SURFACE DEFINITIONS
 * ---------------------------
 * Kernel surface  = the whole .kernel.mjs source, comments masked out.
 * Page surface    = the concatenated bodies of the page's <script> elements,
 *                   comments masked out. Visible HTML prose is display, not
 *                   payload, and is deliberately out of scope.
 * A value is only collected from a real string literal (single, double or
 * backtick), optionally built by "+" concatenation of adjacent literals. A key
 * mentioned inside a comment contributes nothing.
 *
 * Per node and per key the comparison is a SET difference in both directions:
 * a value present on exactly one surface is one violation. Nodes routinely
 * carry two branches (a zero-input early return and the main return), so sets,
 * not single values, are the honest unit.
 *
 * BASELINE + RATCHET (scripts/cross-surface-baseline.json)
 * -------------------------------------------------------
 * Three buckets, one per gating leg: pageKernel / flagGhost / mcpNameSplit.
 * A node may carry at most its baselined count in a bucket; a node absent from
 * a bucket must be clean there. Counts MOVE DOWN ONLY -- `--update` REFUSES to
 * write a baseline that raises any entry or adds a node that is not already
 * present, and names the offenders. That is the mechanical half of "the
 * baseline ratchets"; the reporting half prints every count that beat its
 * baseline so the next --update can tighten it.
 *
 * LEG (b) IS REPORT-ONLY
 * ----------------------
 * Leg (b) contributes ZERO to the exit code, has no baseline, and writes
 * nothing. It prints a count and (under --report) the list. This is load-
 * bearing: 116-ish register entries are known stale and all of them are
 * published under an "independently verified" trust label. Turning that into a
 * CI failure decides a policy question this row was explicitly told not to
 * decide.
 *
 * INDEPENDENT DERIVATION (SO #34)
 * -------------------------------
 * Leg (b) recomputes the digest from the PRIMARY source -- the deployed kernel
 * file -- through chaingraph/kernels/_buildid.mjs, the estate's single source
 * of truth for the §17 kernel digest. It never reads the digest it is
 * validating out of the artifact under test, and it never introduces a second
 * canonicalization. No eval, no dynamic require: every other leg is a pure
 * text scan.
 *
 * Usage:
 *   node scripts/check-cross-surface.mjs            # gate (preflight + CI)
 *   node scripts/check-cross-surface.mjs --report   # full per-node detail, all legs
 *   node scripts/check-cross-surface.mjs --update   # tighten the baseline (down only)
 *   node scripts/check-cross-surface.mjs --rules    # print the normalization rules
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODES_DIR = resolve(REPO, 'chaingraph', 'graph', 'nodes');
const KERNELS_DIR = resolve(REPO, 'chaingraph', 'kernels');
const PAGES_DIR = resolve(REPO, 'chaingraph');
const REGISTER_DIR = resolve(REPO, 'chaingraph', 'register');
const BASELINE_PATH = resolve(REPO, 'scripts', 'cross-surface-baseline.json');

// ---------------------------------------------------------------------------
// JS text scanning -- comment masking + string-literal extraction.
// Pure text, no eval, no import of the code under test (SO #34 security rider).
// ---------------------------------------------------------------------------

/** Characters after which a "/" starts a regex literal rather than division. */
const REGEX_PRECEDERS = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>', '\n']);

function skipStringLiteral(src, i) {
  const quote = src[i];
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === quote) return i + 1;
    i++;
  }
  return i;
}

function skipRegexLiteral(src, i) {
  i++; // past the opening "/"
  let inClass = false;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '\n') return i; // unterminated: it was division after all
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) return i + 1;
    i++;
  }
  return i;
}

/**
 * Byte ranges of every comment in a JS source, computed with string- and
 * regex-literal awareness so a "//" inside a URL string is never mistaken for
 * a comment. Exported for unit testing.
 * @param {string} src
 * @returns {Array<[number, number]>}
 */
export function commentRanges(src) {
  const out = [];
  let i = 0;
  let prevSig = '';
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const start = i;
      i += 2;
      while (i < src.length && src[i] !== '\n') i++;
      out.push([start, i]);
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(src.length, i + 2);
      out.push([start, i]);
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i = skipStringLiteral(src, i);
      prevSig = c;
      continue;
    }
    if (c === '/' && REGEX_PRECEDERS.has(prevSig)) {
      i = skipRegexLiteral(src, i);
      prevSig = '/';
      continue;
    }
    if (!/\s/.test(c)) prevSig = c;
    i++;
  }
  return out;
}

function inRanges(ranges, pos) {
  for (const [a, b] of ranges) if (pos >= a && pos < b) return true;
  return false;
}

const ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' };
function unescapeLiteral(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '\\' && i + 1 < raw.length) {
      const nx = raw[i + 1];
      if (nx === 'u' && raw[i + 2] === '{') {
        const close = raw.indexOf('}', i + 3);
        if (close > 0) { out += String.fromCodePoint(parseInt(raw.slice(i + 3, close), 16)); i = close; continue; }
      }
      if (nx === 'u') { out += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16)); i += 5; continue; }
      if (nx === 'x') { out += String.fromCharCode(parseInt(raw.slice(i + 2, i + 4), 16)); i += 3; continue; }
      out += Object.prototype.hasOwnProperty.call(ESCAPES, nx) ? ESCAPES[nx] : nx;
      i++;
      continue;
    }
    out += raw[i];
  }
  return out;
}

/** Read one string literal at `i` (must point at a quote). Returns {value, end} or null. */
function readLiteral(src, i) {
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== '`') return null;
  const end = skipStringLiteral(src, i);
  return { value: unescapeLiteral(src.slice(i + 1, end - 1)), end };
}

/**
 * Every string value assigned to `name` via `name: "..."` or `name = "..."`,
 * skipping occurrences inside comments and following "+" concatenation of
 * adjacent string literals. Exported for unit testing.
 * @param {string} src  JS source (kernel file, or a page's concatenated <script> bodies)
 * @param {string} name identifier to look for
 * @returns {string[]}
 */
export function stringAssignments(src, name) {
  const comments = commentRanges(src);
  const re = new RegExp(`(^|[^A-Za-z0-9_$])${name}\\s*[:=]\\s*`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const keyPos = m.index + m[1].length;
    if (inRanges(comments, keyPos)) continue;
    let i = m.index + m[0].length;
    const lit = readLiteral(src, i);
    if (!lit) continue;
    let value = lit.value;
    i = lit.end;
    // "+"-concatenated continuation, e.g.  table_source: 'a ' + 'b'
    for (;;) {
      const rest = src.slice(i);
      const plus = rest.match(/^\s*\+\s*/);
      if (!plus) break;
      const nxt = readLiteral(src, i + plus[0].length);
      if (!nxt) break;
      value += nxt.value;
      i = nxt.end;
    }
    out.push(value);
    re.lastIndex = i;
  }
  return out;
}

/** Concatenated bodies of every <script> element in an HTML page. Exported for tests. */
export function scriptBodies(html) {
  const out = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out.join('\n;\n');
}

/**
 * Text of the object literal assigned to `name` (`name = { ... }`), located by
 * balanced braces with string awareness. Returns null when there is no such
 * assignment. Used to scope a lookup to a DECLARATION SITE — the kernel's
 * `export const meta = {...}` and the page's `var MANIFEST = {...}` — so a
 * fixture or demo payload elsewhere in the file cannot masquerade as the
 * surface's published value. Exported for unit testing.
 */
export function objectLiteralBlock(src, name) {
  const comments = commentRanges(src);
  const re = new RegExp(`(^|[^A-Za-z0-9_$])${name}\\s*=\\s*\\{`, 'g');
  let m;
  while ((m = re.exec(src))) {
    const at = m.index + m[1].length;
    if (inRanges(comments, at)) continue;
    const open = src.indexOf('{', at);
    let depth = 0;
    let i = open;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '"' || c === "'" || c === '`') { i = skipStringLiteral(src, i) - 1; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(open, Math.min(src.length, i + 1));
  }
  return null;
}

/** kernel `export const meta = { ... mcp_name: "x" ... }` -> "x" (null if absent). Exported for tests. */
export function metaMcpName(src) {
  const block = objectLiteralBlock(src, 'meta');
  if (!block) return null;
  const vals = stringAssignments(block, 'mcp_name');
  return vals.length ? vals[0] : null;
}

// ---------------------------------------------------------------------------
// Normalization (see the header block -- these eight steps ARE the contract).
// ---------------------------------------------------------------------------

export const NORMALIZATION_RULES = [
  'Unicode NFKC',
  'dash unification (en/em/minus/figure/horizontal-bar -> "-")',
  'quote unification (curly -> straight)',
  'section-sign spacing ("§ 232.4" -> "§232.4")',
  'whitespace runs collapse to one space, ends trimmed',
  'commas dropped entirely',
  'SENTENCE-FINAL periods dropped (a "." before whitespace or end only; decimals and citation numerals preserved)',
  'lowercase',
];

/** Apply the stated leg-(a) normalization. Exported for unit testing. */
export function normalizeValue(s) {
  return String(s)
    .normalize('NFKC')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/§\s+/g, '§')
    .replace(/\s+/g, ' ')
    .replace(/,/g, '')
    .replace(/\.(?=\s|$)/g, '')
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Leg (a): the payload-string keys, and how each surface spells them.
// ---------------------------------------------------------------------------
// `scope` names the object literal a key must be read from on that surface, or
// null to scan the whole surface. The three regulatory strings live inside the
// compute function's return payloads, so they are whole-surface. Identity keys
// (mcp_name, TOOL_VERSION) are read from the DECLARATION SITE only -- the
// kernel's `meta` block and the page's `MANIFEST` block -- because both files
// also carry fixtures, demo payloads and export envelopes with their own
// `version:` / `mcp_name:` fields (measured: art-149 carries the literal test
// values "not-semver" and "2.3.1" in a conformance fixture). Reading those as
// the surface's published identity is a phantom drift, and a checker that
// reports phantoms is a checker that gets baselined into uselessness.
const PARITY_KEYS = [
  { key: 'table_version', kernel: ['table_version'], page: ['table_version'], kernelScope: null, pageScope: null },
  { key: 'table_source', kernel: ['table_source'], page: ['table_source'], kernelScope: null, pageScope: null },
  { key: 'regulatory_basis', kernel: ['regulatory_basis'], page: ['regulatory_basis'], kernelScope: null, pageScope: null },
  { key: 'mcp_name', kernel: ['mcp_name'], page: ['mcp_name'], kernelScope: 'meta', pageScope: 'MANIFEST' },
  // The kernel names its version TOOL_VERSION (a const) and republishes it as
  // meta.tool_version; the page carries it as MANIFEST.version. "version" is
  // safe as a bare identifier here -- the regex requires a non-word char before
  // it, so spec_version / chaingraph_version / data_version never match.
  { key: 'TOOL_VERSION', kernel: ['TOOL_VERSION', 'tool_version'], page: ['version', 'tool_version'], kernelScope: null, pageScope: 'MANIFEST' },
];

function valueSet(src, names, scope) {
  let text = src;
  if (scope) {
    const block = objectLiteralBlock(src, scope);
    if (block === null) return null; // declaration site absent: a distinct state, not an empty set
    text = block;
  }
  const set = new Set();
  for (const n of names) for (const v of stringAssignments(text, n)) set.add(normalizeValue(v));
  set.delete('');
  return set;
}

// ---------------------------------------------------------------------------
// Leg (c): flag-ghost lint.
// ---------------------------------------------------------------------------
// An UPPER_SNAKE token needs at least one underscore. That single requirement
// is what keeps the lint honest: bare acronyms (API, MAPR, USC, CFR, SEC, LTV)
// can never match, so the lint has nothing to say about prose and never has to
// be baselined into uselessness. The additional whitelist below is only for
// UNDERSCORED tokens that are standards/format identifiers rather than kernel
// flags -- each one is a named exemption, not a wildcard.
const FLAG_TOKEN = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
const FLAG_PROSE_WHITELIST = new Set([
  // Wire/standard identifiers a description may legitimately name without the
  // kernel containing the literal token.
  'ISO_20022',
  'ISO_8601',
  'RFC_8785',
  'UTF_8',
  'SHA_256',
  'X_509',
]);

export function flagGhostTokens(description, kernelSrc) {
  const toks = [...new Set(String(description || '').match(FLAG_TOKEN) || [])];
  return toks.filter((t) => !FLAG_PROSE_WHITELIST.has(t) && !kernelSrc.includes(t));
}

// ---------------------------------------------------------------------------
// Baseline ratchet.
// ---------------------------------------------------------------------------
const BUCKETS = ['pageKernel', 'flagGhost', 'mcpNameSplit'];

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { pageKernel: {}, flagGhost: {}, mcpNameSplit: {} };
  const b = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  for (const k of BUCKETS) if (!b[k]) b[k] = {};
  return b;
}

/**
 * Compare observed counts to a baseline bucket.
 * Returns { failures, improvements } -- OVER baseline fails, UNDER baseline is
 * an improvement the next --update can bank. Exported for unit testing.
 */
export function ratchet(observed, baselineBucket, label) {
  const failures = [];
  const improvements = [];
  for (const [id, n] of Object.entries(observed)) {
    const allowed = baselineBucket[id] || 0;
    if (n > allowed) failures.push({ id, n, allowed, label });
    else if (n < allowed) improvements.push(`${label}: ${id} ${allowed} -> ${n}`);
  }
  for (const [id, allowed] of Object.entries(baselineBucket)) {
    if (!(id in observed) && allowed > 0) improvements.push(`${label}: ${id} ${allowed} -> 0 (baseline entry can be dropped)`);
  }
  return { failures, improvements };
}

// ---------------------------------------------------------------------------
// Collection.
// ---------------------------------------------------------------------------

export async function collect() {
  const ids = readdirSync(NODES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

  const legA = {};   // tool_id -> count of one-sided values
  const legADetail = {}; // tool_id -> [msg]
  const legC = {};
  const legCDetail = {};
  const legD = {};
  const legDDetail = {};
  const legB = [];   // { tool_id, published, recomputed, trust_label }
  const oneSided = []; // leg (a) coverage facts: key published by exactly one surface
  const skipped = { noPage: [], noKernel: [], noRegister: [], noKernelMeta: [] };

  const kernelSrcCache = new Map();
  const readKernel = (toolId) => {
    if (kernelSrcCache.has(toolId)) return kernelSrcCache.get(toolId);
    const p = resolve(KERNELS_DIR, `${toolId}.kernel.mjs`);
    const v = existsSync(p) ? readFileSync(p, 'utf8') : null;
    kernelSrcCache.set(toolId, v);
    return v;
  };

  for (const id of ids) {
    const shard = JSON.parse(readFileSync(resolve(NODES_DIR, `${id}.json`), 'utf8'));
    const toolId = shard.tool_id || id;
    const kernelSrc = readKernel(toolId);
    if (kernelSrc === null) { skipped.noKernel.push(toolId); continue; }

    // --- leg (a) -----------------------------------------------------------
    const pagePath = resolve(PAGES_DIR, `${toolId}.html`);
    if (!existsSync(pagePath)) {
      skipped.noPage.push(toolId);
    } else {
      const pageJs = scriptBodies(readFileSync(pagePath, 'utf8'));
      let count = 0;
      const msgs = [];
      for (const spec of PARITY_KEYS) {
        const kSet = valueSet(kernelSrc, spec.kernel, spec.kernelScope);
        const pSet = valueSet(pageJs, spec.page, spec.pageScope);
        if (kSet === null || pSet === null) {
          // The declaration site itself is missing (no `meta` block, no
          // `MANIFEST` block). Reported as coverage, never gated.
          oneSided.push(`${toolId}: ${spec.key} has no declaration site on the ${kSet === null ? 'KERNEL' : 'PAGE'} (no ${kSet === null ? spec.kernelScope : spec.pageScope} object literal)`);
          continue;
        }
        if (kSet.size === 0 && pSet.size === 0) continue;
        // ABSENCE IS NOT DISAGREEMENT — and it is not silently a pass either.
        // A key published by exactly one surface is a COVERAGE fact (this page
        // never states an mcp_name at all), not two surfaces asserting
        // different things about the same fact. Gating on it would put ~320
        // nodes straight into the baseline and drown the disagreements that
        // are the whole point of this leg. Tallied and reported instead.
        if (kSet.size === 0 || pSet.size === 0) {
          oneSided.push(`${toolId}: ${spec.key} published only by the ${kSet.size ? 'KERNEL' : 'PAGE'}`);
          continue;
        }
        const onlyKernel = [...kSet].filter((v) => !pSet.has(v));
        const onlyPage = [...pSet].filter((v) => !kSet.has(v));
        count += onlyKernel.length + onlyPage.length;
        for (const v of onlyKernel) msgs.push(`${spec.key}: KERNEL value absent from the page: "${trunc(v)}"`);
        for (const v of onlyPage) msgs.push(`${spec.key}: PAGE value absent from the kernel: "${trunc(v)}"`);
      }
      if (count) { legA[toolId] = count; legADetail[toolId] = msgs; }
    }

    // --- leg (c) -----------------------------------------------------------
    const ghosts = flagGhostTokens(shard.description, kernelSrc);
    if (ghosts.length) { legC[toolId] = ghosts.length; legCDetail[toolId] = ghosts; }

    // --- leg (d) -----------------------------------------------------------
    const metaName = metaMcpName(kernelSrc);
    if (metaName === null) {
      skipped.noKernelMeta.push(toolId);
    } else if (shard.mcp_name && metaName !== shard.mcp_name) {
      legD[toolId] = 1;
      legDDetail[toolId] = [`kernel meta.mcp_name "${metaName}" != shard mcp_name "${shard.mcp_name}"`];
    }

    // --- leg (b) — REPORT ONLY --------------------------------------------
    const regPath = resolve(REGISTER_DIR, `${toolId}.register.json`);
    if (!existsSync(regPath)) {
      skipped.noRegister.push(toolId);
    } else {
      const reg = JSON.parse(readFileSync(regPath, 'utf8'));
      const recomputed = await sourceDigestOf(kernelSrc);
      const published = reg.kernel_digest ? normDigest(reg.kernel_digest) : null;
      if (published !== recomputed) {
        legB.push({ tool_id: toolId, published, recomputed, trust_label: reg.trust_label || null });
      }
    }
  }

  return { ids, legA, legADetail, legB, legC, legCDetail, legD, legDDetail, oneSided, skipped };
}

function trunc(s, n = 120) {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

// _buildid.mjs is the estate's SINGLE SOURCE OF TRUTH for the §17 kernel
// digest. Importing it (a static ESM import of in-repo code, never eval and
// never a dynamic require of data) is what keeps leg (b) from inventing a
// SECOND canonicalization — the exact defect class CONTRACT §A4 bans.
let _buildid = null;
async function buildid() {
  if (!_buildid) _buildid = await import(pathToFileURL(resolve(KERNELS_DIR, '_buildid.mjs')).href);
  return _buildid;
}
async function sourceDigestOf(src) {
  return (await buildid()).sourceDigest(src);
}
function normDigest(d) {
  return typeof d === 'string' && d.startsWith('sha256:') ? d : `sha256:${d}`;
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const REPORT = process.argv.includes('--report');
  const UPDATE = process.argv.includes('--update');
  const RULES = process.argv.includes('--rules');

  if (RULES) {
    console.log('cross-surface leg (a) normalization — two payload strings are EQUAL after:');
    NORMALIZATION_RULES.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
    console.log('NOT normalized (a difference here is a violation): digits, letters, parentheses, semicolons, colons, slashes, "§", "$", "%", word order.');
    process.exit(0);
  }

  const r = await collect();
  const baseline = loadBaseline();

  // --- leg (b): report, never fail ----------------------------------------
  const verified = r.legB.filter((e) => /independently verified/i.test(e.trust_label || ''));
  console.log(`cross-surface leg (b) REPORT-ONLY — register.kernel_digest vs recomputed kernel-source digest: ${r.legB.length} entr(ies) stale of ${r.ids.length - r.skipped.noRegister.length - r.skipped.noKernel.length} compared; ${verified.length} of them published under an "independently verified" trust label. This leg NEVER fails CI and NEVER edits a register entry (detection now, policy separately).`);
  if (REPORT) {
    for (const e of r.legB) console.log(`  • ${e.tool_id}: published ${e.published} != recomputed ${e.recomputed}${/independently verified/i.test(e.trust_label || '') ? '  [independently verified]' : ''}`);
  } else if (r.legB.length) {
    console.log(`  (run with --report for the full list)`);
  }

  // --- skipped populations: absence is a distinct state, never a pass ------
  console.log(`cross-surface population: ${r.ids.length} shard(s); leg (a) skipped ${r.skipped.noPage.length} node(s) with no page, leg (b) skipped ${r.skipped.noRegister.length} with no register entry, leg (d) skipped ${r.skipped.noKernelMeta.length} with no kernel meta.mcp_name.`);
  console.log(`cross-surface leg (a) coverage — ${r.oneSided.length} key(s) published by exactly one of the two surfaces. NOT gated: absence is a coverage fact, not two surfaces disagreeing about the same fact (run with --report for the list).`);
  if (REPORT) for (const m of r.oneSided) console.log(`  • ${m}`);

  if (UPDATE) {
    const next = { pageKernel: r.legA, flagGhost: r.legC, mcpNameSplit: r.legD };
    const raises = [];
    for (const b of BUCKETS) {
      for (const [id, n] of Object.entries(next[b])) {
        const prev = baseline[b][id];
        if (prev === undefined) raises.push(`${b}: ${id} is not baselined (new violation, count ${n})`);
        else if (n > prev) raises.push(`${b}: ${id} ${prev} -> ${n} (would RAISE)`);
      }
    }
    if (raises.length && existsSync(BASELINE_PATH)) {
      console.error(`\ncross-surface --update REFUSED — the baseline ratchets DOWN ONLY, and this would raise ${raises.length} entr(ies):`);
      for (const x of raises.slice(0, 25)) console.error(`  • ${x}`);
      if (raises.length > 25) console.error(`  … and ${raises.length - 25} more`);
      console.error('\nFix the drift instead. A baseline is a shield for legacy debt, never a place to record a new violation.');
      process.exit(3);
    }
    const out = {
      _comment: 'XSURF-CHECKER-1 legacy-debt shield for scripts/check-cross-surface.mjs. Three buckets, one per GATING leg: pageKernel = leg (a) page<->kernel payload-string parity; flagGhost = leg (c) UPPER_SNAKE token in a shard description with no match in the kernel source; mcpNameSplit = leg (d) kernel meta.mcp_name != shard mcp_name (fixing those belongs to MCPNAME-KERNEL-ALIGN-1, not to this gate). Counts MOVE DOWN ONLY — --update refuses to raise an entry or add a new one. Leg (b) is report-only and deliberately has NO bucket here.',
      ...Object.fromEntries(BUCKETS.map((b) => [b, Object.fromEntries(Object.entries(next[b]).sort(([a], [c]) => a.localeCompare(c)))])),
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`cross-surface: baseline written — pageKernel ${Object.keys(next.pageKernel).length}, flagGhost ${Object.keys(next.flagGhost).length}, mcpNameSplit ${Object.keys(next.mcpNameSplit).length} node(s).`);
    process.exit(0);
  }

  const observed = { pageKernel: r.legA, flagGhost: r.legC, mcpNameSplit: r.legD };
  const labels = {
    pageKernel: 'leg (a) PAGE<->KERNEL payload-string parity',
    flagGhost: 'leg (c) FLAG-GHOST (shard description <-> kernel source)',
    mcpNameSplit: 'leg (d) KERNEL-META <-> SHARD mcp_name',
  };
  const detail = { pageKernel: r.legADetail, flagGhost: r.legCDetail, mcpNameSplit: r.legDDetail };

  const allFailures = [];
  const allImprovements = [];
  for (const b of BUCKETS) {
    const { failures, improvements } = ratchet(observed[b], baseline[b], labels[b]);
    allFailures.push(...failures.map((f) => ({ ...f, bucket: b })));
    allImprovements.push(...improvements);
  }

  if (REPORT) {
    for (const b of BUCKETS) {
      const ids = Object.keys(observed[b]).sort();
      console.log(`\n${labels[b]} — ${ids.length} node(s) with at least one violation:`);
      for (const id of ids) {
        console.log(`  • ${id} (${observed[b][id]}, baseline ${baseline[b][id] || 0})`);
        for (const m of detail[b][id] || []) console.log(`      - ${m}`);
      }
    }
  }

  if (allImprovements.length) {
    console.log(`\ncross-surface: ${allImprovements.length} node(s) beat the baseline — tighten with --update:\n  ${allImprovements.slice(0, 15).join('\n  ')}`);
    if (allImprovements.length > 15) console.log(`  … and ${allImprovements.length - 15} more`);
  }

  if (allFailures.length) {
    console.error(`\ncross-surface: ${allFailures.length} FAILURE(s) — a fact differs between two surfaces that must agree:`);
    for (const f of allFailures) {
      console.error(`  • ${f.label} — ${f.id}: ${f.n} violation(s), baseline ${f.allowed}`);
      for (const m of (detail[f.bucket][f.id] || []).slice(0, 6)) console.error(`      - ${m}`);
    }
    console.error('\nFix the surface that is wrong, then re-run. Leg (a)/(c)/(d) baselines shield pre-existing debt only and ratchet DOWN — never add an entry to hide a new violation (--update refuses).');
    console.error('Leg (a) equality is normalized: run `node scripts/check-cross-surface.mjs --rules` to see exactly what counts as equal.');
    process.exit(1);
  }

  console.log(`cross-surface: OK — legs (a)/(c)/(d) within baseline (pageKernel ${Object.keys(baseline.pageKernel).length}, flagGhost ${Object.keys(baseline.flagGhost).length}, mcpNameSplit ${Object.keys(baseline.mcpNameSplit).length} baselined node(s)); leg (b) report-only, ${r.legB.length} stale register digest(s) reported above.`);
}
