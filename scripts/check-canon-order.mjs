#!/usr/bin/env node
/**
 * check-canon-order.mjs — OCG-CANON block ordering gate.
 *
 * Classic <script> blocks do not share hoisting. A page that declares
 * __ocgCanon / __ocgAssertIJson / __ocgCanonStr in one inline block but reaches
 * them from a load-time IIFE in an EARLIER block throws
 * `ReferenceError: __ocgCanonStr is not defined` at parse time, the IIFE's own
 * catch paints the error into #hashValue, and every statement after the
 * throwing line is skipped — so the §4 compute-integrity surface never runs.
 *
 * This gate implements that predicate directly. A file FAILS iff:
 *   1. some inline block declares `function __ocgCanonStr`, AND
 *   2. an EARLIER inline block contains a load-time IIFE — `(function init(){...})()`
 *      or `(async function init(){...})()` — whose call graph reaches a use of
 *      __ocgCanonStr / __ocgCanon / __ocgAssertIJson.
 *
 * Button-gated consumers (runners/, tools/) pass: their hash path is only
 * reachable from a click handler, which runs long after every block has parsed.
 *
 * Usage:
 *   node scripts/check-canon-order.mjs            # gate mode, exit 1 on any violation
 *   node scripts/check-canon-order.mjs --list     # print the violating paths only
 *   node scripts/check-canon-order.mjs --json     # machine-readable report
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Directories that can legitimately carry an inlined OCG-CANON block. */
const SCAN_DIRS = ['chaingraph', 'tools', 'guides'];

/** The three canon identifiers. A load-time reach to ANY of them is the defect. */
const HASH_IDS = ['__ocgCanonStr', '__ocgCanon', '__ocgAssertIJson'];

/**
 * Known, un-repaired instances of this defect — a ratchet, not an exemption.
 *
 * These three diagnostic pages carry the same ordering defect as the chain pages
 * but on a narrower trigger: their load-time IIFE is `initFromHash`, which returns
 * immediately unless the URL carries `#in=<payload>`, and only reaches the hash
 * path when that deep link also sets `run=1`. A plain page load is unaffected,
 * which is why they were not in CANON-ORDER-1's fence (chains/ only).
 *
 * The list may only SHRINK. An entry that no longer violates is reported as stale
 * and fails the gate, so a fix cannot silently leave dead weight behind, and a new
 * violation anywhere else fails immediately.
 */
const KNOWN_DEBT = new Set([
  'chaingraph/art-27-agentic-readiness-diagnostic.html',
  'chaingraph/art-28-mcp-server-deployability-diagnostic.html',
  'chaingraph/art-29-dora-readiness-diagnostic.html',
]);

/** <script type="..."> values that are still JavaScript. Anything else is data. */
const JS_TYPES = new Set([
  '', 'text/javascript', 'application/javascript', 'module',
  'text/ecmascript', 'application/ecmascript',
]);

// ── JS masking ────────────────────────────────────────────────────────────────
// Replace the *contents* of strings, comments and regex literals with spaces so
// that brace matching and identifier searches never trip over a `}` or the word
// `function` inside a string. Length is preserved, so every index into the mask
// is also a valid index into the original text.

const KEYWORDS_BEFORE_REGEX = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'do', 'else', 'yield', 'await', 'case', 'throw',
]);

/** True if a `/` at index i starts a regex literal rather than a division. */
function regexAllowedAt(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0) return true;
  const c = src[j];
  if ('(,=:[!&|?{};+-*%~^<>'.includes(c)) return true;
  if (/[\w$]/.test(c)) {
    let k = j;
    while (k >= 0 && /[\w$]/.test(src[k])) k--;
    return KEYWORDS_BEFORE_REGEX.has(src.slice(k + 1, j + 1));
  }
  return false;
}

/**
 * Mask string/comment/regex contents with spaces, preserving length and offsets.
 * Single linear pass. Template literals keep their interpolation bodies visible
 * as code; the opening `${` and its closing `}` are blanked so brace matching
 * over the mask stays balanced.
 */
export function maskJs(src) {
  const out = src.split('');
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  // Stack entries: 'tmpl' (inside a template literal) or {depth} (inside an
  // interpolation body, counting braces so we know which `}` closes it).
  const stack = [];
  let i = 0;
  while (i < src.length) {
    const top = stack.length ? stack[stack.length - 1] : null;

    if (top === 'tmpl') {
      const c = src[i];
      if (c === '\\') { blank(i, i + 2); i += 2; continue; }
      if (c === '`') { out[i] = ' '; stack.pop(); i++; continue; }
      if (c === '$' && src[i + 1] === '{') {
        out[i] = ' '; out[i + 1] = ' ';
        stack.push({ depth: 0 });
        i += 2; continue;
      }
      out[i] = c === '\n' ? '\n' : ' ';
      i++; continue;
    }

    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      const end = nl === -1 ? src.length : nl;
      blank(i, end); i = end; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      blank(i, stop); i = stop; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c || src[j] === '\n') break;
        j++;
      }
      blank(i, Math.min(j + 1, src.length)); i = j + 1; continue;
    }
    if (c === '`') { out[i] = ' '; stack.push('tmpl'); i++; continue; }
    // Inside an interpolation body: find the `}` that ends it.
    if (top && typeof top === 'object') {
      if (c === '{') { top.depth++; i++; continue; }
      if (c === '}') {
        if (top.depth === 0) { out[i] = ' '; stack.pop(); i++; continue; }
        top.depth--; i++; continue;
      }
    }
    if (c === '/' && regexAllowedAt(src, i)) {
      let j = i + 1, inClass = false, ok = false;
      while (j < src.length) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) { ok = true; break; }
        j++;
      }
      if (ok) {
        while (j + 1 < src.length && /[gimsuyd]/.test(src[j + 1])) j++;
        blank(i, j + 1); i = j + 1; continue;
      }
    }
    i++;
  }
  return out.join('');
}

// ── script-block extraction ───────────────────────────────────────────────────

/** Extract every inline <script> block. `text` is the raw JS, `mask` the masked copy. */
export function scanScriptBlocks(html) {
  const blocks = [];
  const open = /<script\b([^>]*)>/gi;
  let m;
  while ((m = open.exec(html))) {
    const attrs = m[1] || '';
    const contentStart = m.index + m[0].length;
    const closeIdx = html.indexOf('</script>', contentStart);
    if (closeIdx === -1) break;
    const typeM = /type\s*=\s*["']?([^"'\s>]*)/i.exec(attrs);
    const type = (typeM ? typeM[1] : '').toLowerCase();
    const isJs = JS_TYPES.has(type) && !/\bsrc\s*=/i.test(attrs);
    const text = html.slice(contentStart, closeIdx);
    blocks.push({
      tagStart: m.index,
      contentStart,
      contentEnd: closeIdx,
      blockEnd: closeIdx + '</script>'.length,
      attrs, isJs, text,
      mask: isJs ? maskJs(text) : ' '.repeat(text.length),
    });
    open.lastIndex = closeIdx;
  }
  return blocks;
}

// ── structural helpers (all operate on the masked copy) ───────────────────────

/** Index of the `}` matching the `{` at openIdx, or -1. */
function matchBrace(mask, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < mask.length; i++) {
    if (mask[i] === '{') depth++;
    else if (mask[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Index of the `)` matching the `(` at openIdx, or -1. */
function matchParen(mask, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < mask.length; i++) {
    if (mask[i] === '(') depth++;
    else if (mask[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Prefix array of brace depth: depths[i] is the nesting depth just before index i. */
function depthPrefix(mask) {
  const d = new Int32Array(mask.length + 1);
  let cur = 0;
  for (let i = 0; i < mask.length; i++) {
    d[i] = cur;
    if (mask[i] === '{') cur++;
    else if (mask[i] === '}') cur--;
  }
  d[mask.length] = cur;
  return d;
}

/** All `function NAME(...) { ... }` declarations in a block → Map name → body. */
function collectFunctions(text, mask) {
  const fns = new Map();
  const re = /(?:^|[^.\w$])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(mask))) {
    const name = m[1];
    const parenOpen = mask.indexOf('(', m.index + m[0].length - 1);
    if (parenOpen === -1) break;
    const parenClose = matchParen(mask, parenOpen);
    if (parenClose === -1) break;
    const braceOpen = mask.indexOf('{', parenClose);
    if (braceOpen === -1) break;
    const braceClose = matchBrace(mask, braceOpen);
    if (braceClose === -1) break;
    if (!fns.has(name)) {
      fns.set(name, {
        body: text.slice(braceOpen + 1, braceClose),
        bodyMask: mask.slice(braceOpen + 1, braceClose),
      });
    }
    re.lastIndex = braceOpen;
  }
  return fns;
}

/**
 * Bodies of top-level immediately-invoked function expressions, i.e. code that
 * runs the instant the block is parsed. Matches `(function f(){...})()` and
 * `(async function f(){...})()` in both `})()` and `}())` spellings.
 */
function collectLoadTimeIifes(text, mask, depths) {
  const bodies = [];
  const re = /\(\s*(?:async\s+)?function\s*[A-Za-z_$][\w$]*\s*\(|\(\s*(?:async\s+)?function\s*\(/g;
  let m;
  while ((m = re.exec(mask))) {
    if (depths[m.index] !== 0) continue; // nested inside a function — not load-time
    const parenOpen = mask.indexOf('(', m.index + m[0].length - 1);
    if (parenOpen === -1) break;
    const parenClose = matchParen(mask, parenOpen);
    if (parenClose === -1) break;
    const braceOpen = mask.indexOf('{', parenClose);
    if (braceOpen === -1) break;
    const braceClose = matchBrace(mask, braceOpen);
    if (braceClose === -1) break;
    const tail = mask.slice(braceClose + 1, braceClose + 12);
    // `})()` / `})();`  or  `}())`
    if (!/^\s*\)\s*\(\s*\)/.test(tail) && !/^\s*\(\s*\)\s*\)/.test(tail)) continue;
    bodies.push({
      body: text.slice(braceOpen + 1, braceClose),
      bodyMask: mask.slice(braceOpen + 1, braceClose),
    });
    re.lastIndex = braceClose;
  }
  return bodies;
}

/**
 * Blank the bodies of nested *named function declarations*.
 *
 * A nested `function jcs(){ __ocgCanon(o) }` is a declaration, not an execution:
 * the enclosing body only runs it if it also calls `jcs(...)`. Without this the
 * OCG-PROOF block — an IIFE that declares a dozen helpers and then only assigns
 * `window.__ocgSign = sign` — reads as a load-time canon consumer, which it is
 * not. The declarations stay reachable through the `fns` map, so a real call is
 * still followed; only the free-floating text stops counting.
 */
function stripNestedNamedFunctions(bodyMask) {
  const out = bodyMask.split('');
  const re = /(?:^|[^.\w$])(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/g;
  let m;
  while ((m = re.exec(bodyMask))) {
    const parenOpen = bodyMask.indexOf('(', m.index + m[0].length - 1);
    if (parenOpen === -1) break;
    const parenClose = matchParen(bodyMask, parenOpen);
    if (parenClose === -1) break;
    const braceOpen = bodyMask.indexOf('{', parenClose);
    if (braceOpen === -1) break;
    const braceClose = matchBrace(bodyMask, braceOpen);
    if (braceClose === -1) break;
    // Blank the WHOLE declaration, header included: `function jcs(` would
    // otherwise still read as a call to `jcs` and re-open the path we just shut.
    let start = m.index;
    if (!/^(?:async[\s]|function)/.test(bodyMask.slice(start))) start += 1;
    for (let k = start; k <= braceClose; k++) if (out[k] !== '\n') out[k] = ' ';
    re.lastIndex = braceClose;
  }
  return out.join('');
}

/** Identifiers this body calls when it runs — nested declarations excluded. */
function calleesOf(bodyMask) {
  const out = new Set();
  const re = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  const scanned = stripNestedNamedFunctions(bodyMask);
  let m;
  while ((m = re.exec(scanned))) out.add(m[1]);
  return out;
}

/** Does this masked body reach a canon identifier, directly or through `fns`? */
function reachesHash(bodyMask, fns) {
  const seen = new Set();
  const queue = [bodyMask];
  while (queue.length) {
    const body = queue.shift();
    const callees = calleesOf(body);
    for (const id of HASH_IDS) if (callees.has(id)) return true;
    for (const name of callees) {
      if (seen.has(name) || !fns.has(name)) continue;
      seen.add(name);
      queue.push(fns.get(name).bodyMask);
    }
  }
  return false;
}

// ── the predicate ─────────────────────────────────────────────────────────────

/**
 * First script block that reaches a canon identifier at LOAD time.
 *
 * @param {string} html
 * @param {number} [limit] stop before this block index (default: scan all)
 * @returns {{index:number, tagStart:number}|null}
 */
export function findLoadTimeCanonConsumer(html, limit) {
  const blocks = scanScriptBlocks(html);
  const end = limit === undefined ? blocks.length : limit;

  // Every function declared in a preceding block is callable from the consumer.
  const fns = new Map();
  for (let i = 0; i < end; i++) {
    if (!blocks[i].isJs) continue;
    for (const [k, v] of collectFunctions(blocks[i].text, blocks[i].mask)) if (!fns.has(k)) fns.set(k, v);
  }

  for (let i = 0; i < end; i++) {
    const b = blocks[i];
    if (!b.isJs) continue;
    const depths = depthPrefix(b.mask);
    for (const iife of collectLoadTimeIifes(b.text, b.mask, depths)) {
      if (reachesHash(iife.bodyMask, fns)) return { index: i, tagStart: b.tagStart };
    }
  }
  return null;
}

/**
 * Analyse one page.
 * @returns {{violates:boolean, reason:string, declIndex:number, consumerIndex:number}}
 */
export function analyseHtml(html) {
  const blocks = scanScriptBlocks(html);
  const declIndex = blocks.findIndex(b => b.isJs && /function\s+__ocgCanonStr\s*\(/.test(b.mask));
  if (declIndex === -1) {
    return { violates: false, reason: 'no canon declaration', declIndex: -1, consumerIndex: -1 };
  }
  const hit = findLoadTimeCanonConsumer(html, declIndex);
  if (hit) {
    return {
      violates: true,
      reason: `load-time IIFE in script block #${hit.index + 1} reaches a canon identifier declared in block #${declIndex + 1}`,
      declIndex, consumerIndex: hit.index,
    };
  }
  return { violates: false, reason: 'canon declared before any load-time consumer', declIndex, consumerIndex: -1 };
}

// ── driver ────────────────────────────────────────────────────────────────────

function walk(dir, acc) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const listOnly = args.includes('--list');

  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(REPO_ROOT, d), files);

  const violations = [];
  const known = [];
  let withCanon = 0;
  for (const f of files.sort()) {
    const html = fs.readFileSync(f, 'utf8');
    if (!html.includes('__ocgCanonStr')) continue;
    const rel = path.relative(REPO_ROOT, f).replace(/\\/g, '/');
    const r = analyseHtml(html);
    if (r.declIndex !== -1) withCanon++;
    if (!r.violates) continue;
    if (KNOWN_DEBT.has(rel)) known.push({ file: rel, reason: r.reason });
    else violations.push({ file: rel, reason: r.reason });
  }

  // The allowlist is a ratchet: an entry that no longer violates must be removed.
  const stale = [...KNOWN_DEBT].filter(f => !known.some(k => k.file === f)).sort();

  if (asJson) {
    console.log(JSON.stringify({ withCanon, violations, known, stale }, null, 2));
  } else if (listOnly) {
    for (const v of violations) console.log(v.file);
  } else {
    for (const v of violations) console.error(`FAIL ${v.file} — ${v.reason}`);
    for (const s of stale) console.error(`FAIL ${s} — listed in KNOWN_DEBT but no longer violates; remove it from the list`);
    if (violations.length || stale.length) {
      if (violations.length) {
        console.error(`\ncheck-canon-order: ${violations.length} of ${withCanon} canon-bearing pages load their canon block AFTER a load-time consumer.`);
        console.error('Move the `OCG-CANON v1` <script> block so it precedes the script block that consumes it.');
      }
    } else {
      console.log(`check-canon-order: OK — ${withCanon} canon-bearing pages, 0 new ordering violations, ${known.length} known-debt pages.`);
    }
  }
  process.exit(violations.length || stale.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
