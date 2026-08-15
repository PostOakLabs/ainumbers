#!/usr/bin/env node
/**
 * scripts/check-inline-ssot-sync.mjs — INLINESYNC-1 (+ INLINE-SSOT-PORTS-GATE-1)
 *
 * The site has no build step (CONTRACT.md: zero build, zero dependency drift,
 * portable static deployment), so kernel logic gets hand-pasted into otherwise
 * self-contained HTML pages. Before this gate NO generator or check existed for
 * keeping those hand-typed copies in sync with their SSOT — PROOFSYNC-SECURED-1
 * shipped a fix for 11 pages whose secured() copy was stale (missing an
 * empty-audit_signature cleanup, silently breaking sign-then-verify) precisely
 * because nothing would have caught that drift.
 *
 * Shape: one manifest (scripts/inline-ssot-sync-manifest.json) driving ONE
 * general algorithm over all pairs — same doctrine as scripts/published-dirs.json
 * driving regen-sitemap.mjs (generator/gate share one manifest so they can't
 * drift apart independently). Three extraction `mode`s cover every pair without
 * pair-specific code:
 *   - "line": the SSOT unit is a single minified inline function statement
 *     (secured(), __ocgCanon()) — extract the one SSOT line containing
 *     `trigger`, then every consumer line containing that same trigger must
 *     be byte-identical to it (or a pinned baseline variant — see below).
 *   - "wholeFileBlock": the SSOT unit is the ENTIRE kernel file, verbatim
 *     (kernels/_signverdict.inline.js's own header comment says as much) —
 *     a consuming page must contain the SSOT file's full trimmed text as a
 *     byte-identical substring.
 *   - "codeOnly": the SSOT unit is the ENTIRE kernel MODULE, ported inline into
 *     ONE named tool page — but a tool page cannot `import`, so the port
 *     necessarily strips `export` keywords and (in practice) omits the module's
 *     section-banner comments. A byte-compare therefore fails on a CORRECT
 *     port, which is why the first two modes could not express these pairs at
 *     all. See the normalizer contract below.
 * A file can carry more than one occurrence of a "line" pair (e.g. a tool
 * page embedding a second widget with its own copy) — every occurrence is
 * checked independently, not just the first.
 *
 * -- "codeOnly" NORMALIZER CONTRACT (INLINE-SSOT-PORTS-GATE-1) --------------
 * The normalizer removes ONLY what is provably incidental to a module-to-inline
 * port, and it is worthless if it ever removes more than that. Exactly three
 * classes are normalized away, applied IDENTICALLY to both sides:
 *   1. COMMENTS — line and block. A port omits the module's section banners.
 *      Comments carry no behavior, so removing them cannot mask a defect.
 *   2. ES-MODULE LINKAGE — the `export` keyword before a declaration, and a
 *      standalone `export { ... };` re-export statement (which a script-context
 *      port drops entirely, having nothing to export to). This is linkage, not
 *      logic. `export default`, `export *` and `import` are NOT handled: they
 *      raise and the gate fails CLOSED rather than guessing.
 *   3. INSIGNIFICANT WHITESPACE — leading/trailing whitespace per line, and
 *      blank lines. ONLY outside string/template/regex literals: the scanner
 *      masks literal interiors so a space inside a hash-domain string, or a
 *      newline inside a multi-line template, is never touched.
 * NOTHING ELSE IS NORMALIZED. Identifiers, numeric literals, string contents,
 * operators, quote characters and control flow all compare exactly, so a
 * one-character change to a domain separator or a comparison operator still
 * fails the gate. `--self-test` asserts exactly that with negative controls
 * (see scripts/check-inline-ssot-sync.fixtures.mjs) — a normalizer verified by
 * reading it would be the self-consistent-checker shape (STANDING-ORDERS #34)
 * one level up.
 * SAFETY: the normalized text of every side is COMPILED (never executed) with
 * node:vm to prove the scanner did not swallow code it mistook for a comment.
 * A scanner bug therefore surfaces as a loud parse error, not a silent pass.
 *
 * SYNC DEFINITION ("line"/"wholeFileBlock"): byte-identical to the current SSOT
 * text, OR byte-identical to a variant text explicitly pinned to that exact file
 * in scripts/inline-ssot-sync-baseline.json. The baseline exists for exactly one
 * known case (see that file): 33 chaingraph/chains + tools pages carry an
 * older, purely-stylistic ES5 transcription of __ocgCanon (function-expression
 * reduce callback instead of the current arrow-fn reduce) predating a
 * scripts/gen-chain-runners.mjs refactor, functionally identical for every
 * input but byte-different. Baseline entries are a ceiling, same ratchet
 * doctrine as scripts/copy-hallmarks-baseline.json: a file already listed may
 * keep its pinned variant, but a file NOT listed must match the live SSOT
 * exactly — no new hand-typed variant can join, and the list only shrinks as
 * pages get swept to canonical (a page edit, out of INLINESYNC-1's fence, not
 * done here). The baseline is NEVER used to shield a behavioral difference —
 * only confirmed-equivalent stylistic transcriptions may be added, by hand,
 * as a deliberate reviewed exception. codeOnly pairs take NO baseline: a
 * post-normalization difference in that mode is by construction a code
 * difference, and a code difference in a verifier is the defect this mode
 * exists to find.
 *
 * NO REGENERATION MODE: unlike regen-sitemap.mjs, this script is gate-only
 * (same shape as check-copy-hallmarks.mjs). There is no safe generic way to
 * auto-rewrite an arbitrary hand-authored inline <script> block back to the
 * SSOT text across ~600-page-scale consumer sets without risking a bad
 * surgical edit landing unreviewed on live tool pages — chaingraph/kernels/
 * fix-hash-scheme.mjs already does exactly that, but only for ONE narrow,
 * well-understood pattern (the Scheme-A array-replacer bug), applies it with
 * --apply as a deliberate hand-run step, and stays out of this gate's fence
 * (kernels/ is read-only here). A human fixing a real drift by hand, then
 * this gate turning green again, is the intended loop.
 *
 * Usage:
 *   node scripts/check-inline-ssot-sync.mjs            # verbose per-pair report
 *   node scripts/check-inline-ssot-sync.mjs --check    # terse gate (preflight + CI), exit 1 on drift
 *   node scripts/check-inline-ssot-sync.mjs --self-test # normalizer fixtures incl. negative controls
 *   node scripts/check-inline-ssot-sync.mjs --pair <id> --file <path>
 *                                                       # ad hoc: check ONE file against ONE pair's
 *                                                       # SSOT, even outside the normal consumer scan
 *                                                       # (used to reproduce a reconstructed pre-fix
 *                                                       # page against the current SSOT — see
 *                                                       # board/done/PROOFSYNC-SECURED-1.md)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = resolve(REPO, 'scripts', 'inline-ssot-sync-manifest.json');
const BASELINE_PATH = resolve(REPO, 'scripts', 'inline-ssot-sync-baseline.json');
const CHECK = process.argv.includes('--check');
const SELF_TEST = process.argv.includes('--self-test');

const pairArgIdx = process.argv.indexOf('--pair');
const fileArgIdx = process.argv.indexOf('--file');
const AD_HOC = pairArgIdx !== -1 && fileArgIdx !== -1;
const AD_HOC_PAIR = AD_HOC ? process.argv[pairArgIdx + 1] : null;
const AD_HOC_FILE = AD_HOC ? process.argv[fileArgIdx + 1] : null;

// Worktrees/tooling dirs that are not the live estate — same exclusion class
// as scripts/check-copy-hallmarks.mjs's SKIP_DIRS, plus worktree dirs (a
// worktree is a full checkout of the same tree and would otherwise double
// every count).
const SKIP_DIRS = new Set(['.git', '.claude', '.wt', '.wrangler', 'node_modules', '.github', '.githooks']);

function htmlFiles(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) htmlFiles(join(dir, e.name), out);
    } else if (e.name.endsWith('.html')) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

/**
 * Extract every occurrence of the exact `function name(...){...}` statement
 * starting at each place `trigger` appears in `text`, using balanced-brace
 * matching from the first `{` after the trigger to its matching close. This
 * is robust to a page having the ENTIRE surrounding IIFE minified onto one
 * physical line (10 of the 627 secured() consumers are shaped that way) —
 * a naive line-split would wrongly capture the whole line's unrelated code
 * as part of the "copy" and false-flag it as drifted. All three pairs' units
 * (secured(), __ocgCanon()) are self-contained helpers with no string
 * literals containing braces, so brace-depth counting alone is exact here.
 */
function extractSnippets(text, trigger) {
  const out = [];
  let searchFrom = 0;
  while (true) {
    const start = text.indexOf(trigger, searchFrom);
    if (start === -1) break;
    const braceStart = text.indexOf('{', start);
    if (braceStart === -1) { searchFrom = start + trigger.length; continue; }
    let depth = 0, i = braceStart, end = -1;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end === -1) { searchFrom = start + trigger.length; continue; } // unbalanced — skip, don't crash
    out.push(text.slice(start, end));
    searchFrom = end;
  }
  return out;
}

// =========================================================================
// "codeOnly" normalizer — INLINE-SSOT-PORTS-GATE-1
// =========================================================================

const CODE = 0;    // character participates in the comparison
const LITERAL = 1; // character is inside a string/template/regex literal body

// `/` after one of these words starts a REGEX, not a division.
const REGEX_AFTER_WORD = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'case', 'do', 'else', 'yield', 'await', 'throw',
]);

function regexAllowed(prevSig, prevWord) {
  if (prevSig === '') return true;                              // start of input
  if (/[A-Za-z0-9_$]/.test(prevSig)) return REGEX_AFTER_WORD.has(prevWord);
  // `)` and `]` close a value => division. `}` is genuinely ambiguous; treat it
  // as division, the conservative call — mistaking a division for a regex would
  // swallow real code up to the next `/`, while the reverse merely leaves a
  // regex body as ordinary characters and is caught by the vm parse check.
  if (prevSig === ')' || prevSig === ']' || prevSig === '}') return false;
  return true;
}

/**
 * Character scanner over JavaScript source. Removes comments and reports, for
 * every surviving character, whether it sits inside a literal body (so the
 * whitespace pass can leave literal interiors alone). Comment removal is
 * substitution, not deletion: a comment containing a newline becomes a newline
 * (it is an ASI line terminator, so dropping it outright could change
 * parsing), any other comment becomes a single space (so it can never fuse two
 * adjacent tokens into one).
 */
export function stripComments(text, where = '<input>') {
  const out = [];
  const mask = [];
  const emit = (ch, m) => { out.push(ch); mask.push(m); };
  const stack = [{ kind: 'code', brace: 0, sub: false }];
  let prevSig = '';
  let prevWord = '';
  let i = 0;
  const n = text.length;

  while (i < n) {
    const top = stack[stack.length - 1];
    const c = text[i];

    // -- inside a template literal body --
    if (top.kind === 'template') {
      if (c === '\\') { emit(c, LITERAL); if (i + 1 < n) emit(text[i + 1], LITERAL); i += 2; continue; }
      if (c === '$' && text[i + 1] === '{') {
        emit('$', CODE); emit('{', CODE); i += 2;
        stack.push({ kind: 'code', brace: 0, sub: true });
        prevSig = '{'; prevWord = '';
        continue;
      }
      if (c === '`') { emit(c, CODE); i++; stack.pop(); prevSig = '`'; prevWord = ''; continue; }
      emit(c, LITERAL); i++;
      continue;
    }

    // -- code context --
    if (c === '/' && text[i + 1] === '/') {
      let j = i + 2;
      while (j < n && text[j] !== '\n') j++;
      emit(' ', CODE);          // the newline itself is emitted by the normal path
      i = j;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) throw new Error(`${where}: unterminated block comment`);
      const body = text.slice(i, end + 2);
      emit(body.includes('\n') ? '\n' : ' ', CODE);
      i = end + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      emit(c, CODE);            // the quote character itself is significant
      const quote = c;
      i++;
      let closed = false;
      while (i < n) {
        const ch = text[i];
        if (ch === '\\') { emit(ch, LITERAL); if (i + 1 < n) emit(text[i + 1], LITERAL); i += 2; continue; }
        if (ch === quote) { emit(ch, CODE); i++; closed = true; break; }
        if (ch === '\n') throw new Error(`${where}: unterminated string literal`);
        emit(ch, LITERAL); i++;
      }
      if (!closed) throw new Error(`${where}: unterminated string literal`);
      prevSig = quote; prevWord = '';
      continue;
    }
    if (c === '`') {
      emit(c, CODE); i++;
      stack.push({ kind: 'template', brace: 0, sub: false });
      prevSig = '`'; prevWord = '';
      continue;
    }
    if (c === '/' && regexAllowed(prevSig, prevWord)) {
      emit(c, CODE);
      i++;
      let inClass = false, closed = false;
      while (i < n) {
        const ch = text[i];
        if (ch === '\\') { emit(ch, LITERAL); if (i + 1 < n) emit(text[i + 1], LITERAL); i += 2; continue; }
        if (ch === '\n') throw new Error(`${where}: unterminated regex literal`);
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) { emit(ch, CODE); i++; closed = true; break; }
        emit(ch, LITERAL); i++;
      }
      if (!closed) throw new Error(`${where}: unterminated regex literal`);
      while (i < n && /[a-z]/.test(text[i])) { emit(text[i], CODE); i++; } // flags
      prevSig = '/'; prevWord = '';
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(text[j])) j++;
      const word = text.slice(i, j);
      for (const ch of word) emit(ch, CODE);
      prevWord = word; prevSig = word[word.length - 1];
      i = j;
      continue;
    }
    if (c === '{') { top.brace++; emit(c, CODE); i++; prevSig = '{'; prevWord = ''; continue; }
    if (c === '}') {
      if (top.sub && top.brace === 0) { emit(c, CODE); i++; stack.pop(); prevSig = '}'; prevWord = ''; continue; }
      top.brace--; emit(c, CODE); i++; prevSig = '}'; prevWord = '';
      continue;
    }
    emit(c, CODE);
    if (!/\s/.test(c)) { prevSig = c; prevWord = ''; }
    i++;
  }

  if (stack.length !== 1) throw new Error(`${where}: unterminated template literal`);
  return { code: out.join(''), mask };
}

/** Index of the previous character that is masked, or unmasked and non-whitespace. -1 if none. */
function prevCodeCharIdx(code, mask, from) {
  for (let k = from; k >= 0; k--) {
    if (mask[k] !== CODE) return k;
    if (!/\s/.test(code[k])) return k;
  }
  return -1;
}

/**
 * Remove ES-module linkage that a script-context inline port cannot carry:
 * a leading `export ` before a declaration, and a standalone `export { ... };`
 * re-export statement. Refuses (throws — fail CLOSED) on `export default`,
 * `export *` and any `import`, rather than guessing at a shape nobody has
 * proven incidental.
 */
export function stripModuleLinkage(code, mask, where = '<input>') {
  const removals = [];

  for (const m of code.matchAll(/\bimport\b/g)) {
    if (mask[m.index] !== CODE) continue;
    const p = prevCodeCharIdx(code, mask, m.index - 1);
    if (p !== -1 && mask[p] === CODE && /[A-Za-z0-9_$.]/.test(code[p])) continue; // `foo.import`, not a statement
    throw new Error(`${where}: 'import' is unsupported in codeOnly mode — an inline port cannot carry a module import, and silently dropping one would hide a dependency change.`);
  }

  for (const m of code.matchAll(/\bexport\b/g)) {
    const start = m.index;
    if (mask[start] !== CODE) continue;
    const p = prevCodeCharIdx(code, mask, start - 1);
    const prevCh = p === -1 ? '' : code[p];
    // statement position only — never an `obj.export` / `x = export` fragment
    if (!(p === -1 || (mask[p] === CODE && (prevCh === ';' || prevCh === '}' || prevCh === '{')))) continue;

    let j = start + 'export'.length;
    while (j < code.length && mask[j] === CODE && /\s/.test(code[j])) j++;

    if (code.startsWith('default', j) || code[j] === '*') {
      throw new Error(`${where}: 'export default' / 'export *' is unsupported in codeOnly mode — fail closed rather than guess.`);
    }

    if (code[j] === '{') {
      // a whole `export { ... } [from '...'] ;` statement disappears in a port
      let depth = 0, k = j, end = -1;
      for (; k < code.length; k++) {
        if (mask[k] !== CODE) continue;
        if (code[k] === '{') depth++;
        else if (code[k] === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
      }
      if (end === -1) throw new Error(`${where}: unbalanced 'export { ... }' statement`);
      while (end < code.length && mask[end] === CODE && /\s/.test(code[end])) end++;
      if (code.startsWith('from', end)) {
        end += 'from'.length;
        while (end < code.length && mask[end] === CODE && /\s/.test(code[end])) end++;
        const q = code[end];
        if (q !== "'" && q !== '"') throw new Error(`${where}: malformed 're-export from' clause`);
        end++;
        while (end < code.length && code[end] !== q) end++;
        end++;
      }
      while (end < code.length && mask[end] === CODE && /\s/.test(code[end])) end++;
      if (code[end] === ';') end++;
      removals.push([start, end]);
      continue;
    }

    // plain `export const|let|var|function|async|class ...` — drop the keyword only
    removals.push([start, j]);
  }

  if (!removals.length) return { code, mask };
  removals.sort((a, b) => a[0] - b[0]);
  const outCode = [];
  const outMask = [];
  let cursor = 0;
  for (const [s, e] of removals) {
    for (let k = cursor; k < s; k++) { outCode.push(code[k]); outMask.push(mask[k]); }
    cursor = Math.max(cursor, e);
  }
  for (let k = cursor; k < code.length; k++) { outCode.push(code[k]); outMask.push(mask[k]); }
  return { code: outCode.join(''), mask: outMask };
}

/**
 * Drop blank lines and per-line leading/trailing whitespace — but ONLY where
 * that whitespace is outside a literal. A newline inside a multi-line template
 * is masked, so such a template is never split and never trimmed.
 */
export function normalizeWhitespace(code, mask) {
  const lines = [];
  let cur = [];
  let curMask = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n' && mask[i] === CODE) {
      lines.push({ text: cur.join(''), mask: curMask });
      cur = []; curMask = [];
    } else { cur.push(code[i]); curMask.push(mask[i]); }
  }
  lines.push({ text: cur.join(''), mask: curMask });

  const out = [];
  for (const ln of lines) {
    let s = 0, e = ln.text.length;
    while (s < e && ln.mask[s] === CODE && /\s/.test(ln.text[s])) s++;
    while (e > s && ln.mask[e - 1] === CODE && /\s/.test(ln.text[e - 1])) e--;
    const t = ln.text.slice(s, e);
    if (t.length === 0) continue;
    out.push(t);
  }
  return out.join('\n');
}

/**
 * Full codeOnly normalization. `where` names the side for error messages.
 * The result is COMPILED (never executed) to prove the scanner did not eat
 * code it mistook for a comment — a compile is a parse, it runs nothing, so
 * this cannot execute kernel bytes (STANDING-ORDERS #34 security rider).
 */
export function normalizeCode(text, where = '<input>') {
  const stripped = stripComments(text, where);
  const linked = stripModuleLinkage(stripped.code, stripped.mask, where);
  const normalized = normalizeWhitespace(linked.code, linked.mask);
  try {
    new Script(normalized, { filename: `${where}.normalized.js` }); // compile only — never run
  } catch (e) {
    throw new Error(`${where}: normalized text does not parse as JavaScript (${e.message}). The normalizer mis-scanned the source, so the comparison is NOT trustworthy and the gate fails closed instead of reporting a result.`);
  }
  return normalized;
}

/**
 * Read a file for codeOnly comparison with CRLF folded to LF. A Windows
 * checkout stores the same commit with `\r\n`, so without this the gate would
 * answer differently on two clones of one tree. `\r` outside a literal is
 * whitespace the normalizer already trims; folding it here just makes the
 * region markers match too. Byte-compare modes are untouched.
 */
function readTextLF(abs) {
  return readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
}

/** Locate a marker exactly once; ambiguity and absence are both failures. */
function locateOnce(haystack, marker, label, where) {
  const first = haystack.indexOf(marker);
  if (first === -1) throw new Error(`${where}: ${label} not found — the inline port's delimiters moved. Fix the manifest (or the page) rather than trusting a partial region.`);
  if (haystack.indexOf(marker, first + 1) !== -1) throw new Error(`${where}: ${label} appears more than once — an ambiguous region is not a region. Pick a unique delimiter in scripts/inline-ssot-sync-manifest.json.`);
  return first;
}

export function extractRegion(src, consumer, where) {
  const s = locateOnce(src, consumer.startMarker, 'startMarker', where);
  const from = s + consumer.startMarker.length;
  const e = locateOnce(src, consumer.endMarker, 'endMarker', where);
  if (e <= from) throw new Error(`${where}: endMarker precedes startMarker — the region is inverted.`);
  const region = src.slice(from, e);
  if (!region.trim()) throw new Error(`${where}: extracted region is empty.`);
  return region;
}

/** Compact line diff — the first differing block with context, capped. */
function renderDiff(expected, actual, maxLines = 24) {
  const a = expected.split('\n');
  const b = actual.split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const aBlock = a.slice(head, a.length - tail);
  const bBlock = b.slice(head, b.length - tail);
  const lines = [];
  lines.push(`first difference at normalized line ${head + 1} (SSOT has ${a.length} code line(s), inline copy has ${b.length})`);
  const shown = Math.min(maxLines, Math.max(aBlock.length, bBlock.length));
  for (let i = 0; i < shown; i++) {
    if (i < aBlock.length) lines.push(`        - SSOT  : ${aBlock[i]}`);
    if (i < bBlock.length) lines.push(`        + inline: ${bBlock[i]}`);
  }
  const remaining = Math.max(aBlock.length, bBlock.length) - shown;
  if (remaining > 0) lines.push(`        ... ${remaining} further differing line(s) suppressed`);
  return lines.join('\n');
}

function loadCanonical(pair) {
  if (pair.mode === 'codeOnly') {
    return normalizeCode(readTextLF(resolve(REPO, pair.ssotFile)), `[${pair.id}] SSOT ${pair.ssotFile}`);
  }
  const ssotText = readFileSync(resolve(REPO, pair.ssotFile), 'utf8');
  if (pair.mode === 'line') {
    const snippets = extractSnippets(ssotText, pair.trigger);
    if (snippets.length !== 1) {
      throw new Error(`[${pair.id}] SSOT ${pair.ssotFile}: expected exactly 1 occurrence of "${pair.trigger}", found ${snippets.length} — manifest/extraction is stale, fix scripts/inline-ssot-sync-manifest.json before trusting this gate.`);
    }
    return snippets[0];
  }
  if (pair.mode === 'wholeFileBlock') return ssotText.trim();
  throw new Error(`[${pair.id}] unknown mode "${pair.mode}" in scripts/inline-ssot-sync-manifest.json`);
}

/** Returns an array of failure strings (empty = fully in sync) for one file against one pair. */
function checkFile(pair, canonical, pinnedVariants, relPath, src) {
  const out = [];
  if (pair.mode === 'line') {
    const occurrences = extractSnippets(src, pair.trigger);
    for (const occ of occurrences) {
      if (occ === canonical) continue;
      const pinned = pinnedVariants.find((v) => v.text === occ && v.files.includes(relPath));
      if (pinned) continue;
      out.push(`[${pair.id}] ${relPath}: inline copy does not byte-match SSOT (${pair.ssotFile}) and is not a pinned baseline variant for this file.\n        found:  ${occ}\n        wanted: ${canonical}`);
    }
  } else { // wholeFileBlock
    if (!src.includes(pair.trigger)) return out; // page doesn't carry this snippet at all
    if (src.includes(canonical)) return out;
    const pinned = pinnedVariants.find((v) => src.includes(v.text) && v.files.includes(relPath));
    if (pinned) return out;
    out.push(`[${pair.id}] ${relPath}: inline copy does not byte-match SSOT whole-file block (${pair.ssotFile}) and is not a pinned baseline variant for this file.`);
  }
  return out;
}

/** codeOnly: one SSOT module vs its named inline port region(s). Fails CLOSED. */
function checkCodeOnlyPair(pair, canonical) {
  const failures = [];
  let checked = 0;
  const consumers = pair.consumers ?? [];
  if (!consumers.length) {
    failures.push(`[${pair.id}] mode "codeOnly" declares no consumers — an unenforced pair is not a pair. Fix scripts/inline-ssot-sync-manifest.json.`);
    return { failures, checked };
  }
  for (const consumer of consumers) {
    const where = `[${pair.id}] ${consumer.file}`;
    const abs = resolve(REPO, consumer.file);
    if (!existsSync(abs)) {
      failures.push(`${where}: consumer file is MISSING. A registered inline port that cannot be found is a failure, never a pass (STANDING-ORDERS #34c).`);
      continue;
    }
    let actual;
    try {
      actual = normalizeCode(extractRegion(readTextLF(abs), consumer, where), where);
    } catch (e) {
      failures.push(`${where}: ${e.message}`);
      continue;
    }
    checked++;
    if (actual === canonical) continue;
    failures.push(`${where}: inline port has DRIFTED from its SSOT module (${pair.ssotFile}) — the difference survives comment/export/whitespace normalization, so it is a CODE difference.\n        ${renderDiff(canonical, actual)}`);
  }
  return { failures, checked };
}

// -- --self-test: prove the normalizer, including negative controls ---------
if (SELF_TEST) {
  const { CASES } = await import('./check-inline-ssot-sync.fixtures.mjs');
  let pass = 0;
  const bad = [];
  for (const c of CASES) {
    let got;
    try {
      const l = normalizeCode(c.ssot, 'fixture-ssot');
      const r = normalizeCode(c.port, 'fixture-port');
      got = l === r ? 'insync' : 'drift';
    } catch (e) {
      got = `throws: ${e.message.split('\n')[0]}`;
    }
    const ok = c.expect === 'throws' ? got.startsWith('throws') : got === c.expect;
    if (ok) pass++;
    else bad.push(`  x ${c.name}\n      expected: ${c.expect}\n      got:      ${got}`);
  }
  if (bad.length) {
    console.error(`check-inline-ssot-sync --self-test: ${bad.length} of ${CASES.length} normalizer fixture(s) FAILED:\n${bad.join('\n')}`);
    process.exit(1);
  }
  const negatives = CASES.filter((c) => c.expect === 'drift').length;
  console.log(`check-inline-ssot-sync --self-test: OK — ${pass}/${CASES.length} normalizer fixtures pass (incl. ${negatives} negative controls that MUST be detected as drift).`);
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};

// -- --print-normalized: show the gate's work ------------------------------
// A comparison gate whose normalization a human cannot inspect is only
// trustworthy by assertion. This dumps exactly the text either side is reduced
// to, so a reviewer can diff them with ordinary tools instead of taking the
// gate's verdict on faith. Read-only; never part of the pass/fail path.
const pnIdx = process.argv.indexOf('--print-normalized');
if (pnIdx !== -1) {
  const id = process.argv[pnIdx + 1];
  const sideIdx = process.argv.indexOf('--side');
  const side = sideIdx === -1 ? 'ssot' : process.argv[sideIdx + 1];
  const pair = manifest.pairs.find((p) => p.id === id);
  if (!pair || pair.mode !== 'codeOnly') { console.error(`--print-normalized needs a codeOnly pair id. Known: ${manifest.pairs.filter((p) => p.mode === 'codeOnly').map((p) => p.id).join(', ')}`); process.exit(2); }
  if (side === 'ssot') {
    console.log(normalizeCode(readTextLF(resolve(REPO, pair.ssotFile)), pair.ssotFile));
  } else {
    for (const consumer of pair.consumers ?? []) {
      console.log(normalizeCode(extractRegion(readTextLF(resolve(REPO, consumer.file)), consumer, consumer.file), consumer.file));
    }
  }
  process.exit(0);
}

// -- Ad hoc single-file mode (acceptance-test / spot-check tool) ------------
if (AD_HOC) {
  const pair = manifest.pairs.find((p) => p.id === AD_HOC_PAIR);
  if (!pair) { console.error(`Unknown --pair "${AD_HOC_PAIR}". Known pairs: ${manifest.pairs.map((p) => p.id).join(', ')}`); process.exit(2); }
  const canonical = loadCanonical(pair);
  const pinnedVariants = (baseline[pair.id] && baseline[pair.id].variants) || [];
  let failures;
  if (pair.mode === 'codeOnly') {
    const relFile = relative(REPO, resolve(AD_HOC_FILE)).replace(/\\/g, '/');
    const consumer = (pair.consumers ?? []).find((c) => c.file === relFile) ?? (pair.consumers ?? [])[0];
    if (!consumer) { console.error(`[${pair.id}] no consumer definition (region markers) available for ad hoc use.`); process.exit(2); }
    failures = checkCodeOnlyPair({ ...pair, consumers: [{ ...consumer, file: relFile }] }, canonical).failures;
  } else {
    failures = checkFile(pair, canonical, pinnedVariants, AD_HOC_FILE, readFileSync(AD_HOC_FILE, 'utf8'));
  }
  if (failures.length) {
    console.error(`check-inline-ssot-sync --pair ${pair.id} --file ${AD_HOC_FILE}: DRIFT DETECTED\n  ` + failures.join('\n  '));
    process.exit(1);
  }
  console.log(`check-inline-ssot-sync --pair ${pair.id} --file ${AD_HOC_FILE}: in sync.`);
  process.exit(0);
}

// -- Full estate scan ------------------------------------------------------
const allFiles = htmlFiles(REPO).map((f) => relative(REPO, f).replace(/\\/g, '/'));
const failures = [];
const summaries = [];
let totalOccurrences = 0;

for (const pair of manifest.pairs) {
  let canonical;
  try { canonical = loadCanonical(pair); }
  catch (e) { failures.push(e.message); summaries.push(`  [${pair.id}] ERROR — ${e.message.split('\n')[0]}`); continue; }

  if (pair.mode === 'codeOnly') {
    // Not an estate scan: the SSOT here is a whole MODULE ported into ONE named
    // page, so the manifest names the consumer and the region markers, and a
    // missing file/marker fails closed instead of scanning nothing and passing.
    const { failures: f, checked } = checkCodeOnlyPair(pair, canonical);
    const declared = (pair.consumers ?? []).length;
    totalOccurrences += checked;
    summaries.push(`  [${pair.id}] ${declared} declared inline port(s), ${declared - f.length} in sync${f.length ? `, ${f.length} DRIFTED/ERRORED` : ''} (SSOT: ${pair.ssotFile}, ${canonical.split('\n').length} normalized code lines)`);
    failures.push(...f);
    continue;
  }

  const pinnedVariants = (baseline[pair.id] && baseline[pair.id].variants) || [];
  let occurrences = 0;
  let drifted = 0;
  const pairFailures = [];

  for (const rel of allFiles) {
    if (rel === pair.ssotFile) continue; // never compare the SSOT to itself
    const src = readFileSync(resolve(REPO, rel), 'utf8');
    if (pair.mode === 'line') {
      const n = extractSnippets(src, pair.trigger).length;
      if (!n) continue;
      occurrences += n;
    } else {
      if (!src.includes(pair.trigger)) continue;
      occurrences += 1;
    }
    const fileFailures = checkFile(pair, canonical, pinnedVariants, rel, src);
    if (fileFailures.length) { drifted += fileFailures.length; pairFailures.push(...fileFailures); }
  }

  totalOccurrences += occurrences;
  summaries.push(`  [${pair.id}] ${occurrences} occurrence(s) across consuming pages, ${occurrences - drifted} in sync${drifted ? `, ${drifted} DRIFTED` : ''} (SSOT: ${pair.ssotFile})`);
  failures.push(...pairFailures);
}

if (!CHECK) {
  console.log(`check-inline-ssot-sync: ${manifest.pairs.length} SSOT/inline pair(s), ${totalOccurrences} total occurrence(s) scanned.`);
  console.log(summaries.join('\n'));
}

if (failures.length) {
  console.error(`\ncheck-inline-ssot-sync: ${failures.length} FAILURE(s) — inline copy drifted from its SSOT:\n  ` + failures.join('\n  '));
  console.error('\nFix: hand-copy the exact SSOT text into the drifted page. If the drift is a deliberate, reviewed stylistic exception (never a behavioral one), pin it in scripts/inline-ssot-sync-baseline.json — same ratchet doctrine as scripts/copy-hallmarks-baseline.json. codeOnly pairs take no baseline: fix the page to match the module, never the module to match the page.');
  process.exit(1);
}
console.log(`check-inline-ssot-sync: OK — all ${totalOccurrences} inline occurrence(s) across ${manifest.pairs.length} pair(s) match their SSOT (byte-identical, a pinned baseline exception, or code-identical for codeOnly ports).`);
