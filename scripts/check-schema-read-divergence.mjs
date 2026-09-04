#!/usr/bin/env node
/**
 * check-schema-read-divergence.mjs — SCHEMA-READ-DIVERGENCE-SWEEP-1.
 *
 * Mechanical, both-directions sweep of every live kernel's input-field READS against its
 * DECLARED input schema, per kernel:
 *
 *   READ side    — the fields compute() reads off its policy-parameters object, extracted
 *                  statically from `chaingraph/kernels/<tool_id>.kernel.mjs`. Handled idioms:
 *                  `pp.field`, `pp?.field`, `pp['field']`, `pp?.['field']`, destructuring
 *                  (`const {a, b: c, d = 1, e: {f}} = pp` — top-level key only), whole-object
 *                  aliases (`const q = pp ?? {}`, deep-clone aliases), member writes
 *                  (`pp.x = ...` counted conservatively as a read), `'x' in pp`,
 *                  `pp.hasOwnProperty('x')` / `hasOwnProperty.call(pp,'x')`, and ONE level of
 *                  same-file helper indirection (`helper(pp)` resolved into the helper's body
 *                  against its own first parameter; the helper and what it read are named).
 *
 *   DECLARE side — `manifests/<tool_id>.manifest.json` `input_schema.properties` (primary,
 *                  per the row; paired by the manifest's tool_id field, or by the node's
 *                  mcp_name), else the tool page's embedded ld+json `input_schema`
 *                  (chaingraph/<tool_id>.html#manifest — the row's cross-check surface, used
 *                  as the declared set only when no manifest file pairs). When BOTH exist the
 *                  two declared sets are diffed against EACH OTHER and the delta reported per
 *                  kernel — the manifest file and the page block are two writers, the exact
 *                  cross-surface drift class this row exists for. ⛔ docs/openapi.json is
 *                  NEVER read (527/1182 stub-or-wrong per the AgentSeer pilot).
 *
 *   VERDICT per kernel (one line, machine-consumable):
 *     CLEARED                — reads == declared, both directions
 *     DIVERGES <details>     — any directional mismatch, with triage class
 *     UNPARSEABLE <reason>   — extraction defeated; NEVER silently skipped, NEVER counted
 *                              clean (absence is not a pass, SO #34c). Dynamic enumeration
 *                              (Object.keys(pp), spread, rest elements, pp[var], for..in),
 *                              param shadowing, and unresolved helper indirection land here.
 *   A kernel with NO declared schema anywhere is DIVERGES [NO-DECLARED-SCHEMA] — never clean.
 *
 *   Triage classes (report-only; fix rows come from triage, ⛔ nothing is fixed here):
 *     ART09-CLASS         read-not-declared field whose canonical twin IS declared and never
 *                         read — the named-input mismatch that made 5/6 art-09 DORA criteria
 *                         unreachable by conforming callers.
 *     UNREACHABLE-INPUT   read-not-declared with NO canonical counterpart — input the kernel
 *                         needs that no conforming caller can ever supply.
 *     BENIGN-ALIAS        kernel reads BOTH names; verify by read, then widen the schema.
 *     STALE-SCHEMA        declared-but-never-read with no canonical reader — dead contract
 *                         surface, the caller-facing lie.
 *     NO-DECLARED-SCHEMA  no manifest record and no page block pair with this kernel.
 *
 * Exit codes: 0 always in default/--summary/--tsv modes (ADVISORY BY DESIGN — wired as a
 * non-blocking report; promotion to blocking is a SEPARATE follow-on row per the row's
 * gate-decision item). --strict exits 1 on any DIVERGES/UNPARSEABLE (for that future row;
 * NOT wired anywhere blocking today). The selftest exits 1 on any failed control.
 *
 * ⛔ Zero kernel bytes edited, zero manifest bytes edited — report-only gate. chaingraph.json
 *   is READ once for the tool_id→mcp_name index (an indexing read — SO #34 explicitly permits
 *   reading artifacts for indexing/reporting; it is never a self-check of this gate) and is
 *   NEVER written.
 *
 * Run: node scripts/check-schema-read-divergence.mjs [--tsv <path>] [--json <path>] [--summary]
 *      node scripts/check-schema-read-divergence.selftest.mjs   (controls; see that file)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const MANIFESTS_DIR = 'manifests';
const PAGES_DIR = 'chaingraph';

// ── Builtins that may receive pp whole but can never branch on its field names ──
const NON_READING_CALLEES = new Set([
  'Number', 'Boolean', 'String', 'BigInt', 'Symbol', 'Array', 'JSON', 'Math', 'Date', 'Object', 'Reflect', 'Proxy',
  'isArray', 'from', 'of', 'freeze', 'isFrozen', 'stringify', 'parse', 'executionHash', 'compute', 'buildArtifact',
]);

/** Canonical form for alias-pair detection: case- and separator-insensitive. */
export function canon(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Small abbreviation lexicon for PAIR HINTS (details only — the verdict is driven by the
// raw field sets, never by this table): mins→minutes, dt→datetime, fn→function, …
const TOKEN_LEXICON = {
  mins: 'minutes', min: 'minutes', dt: 'datetime', dtm: 'datetime', fn: 'function', tx: 'transaction',
  val: 'value', num: 'number', amt: 'amount', pct: 'percent', info: 'information', cur: 'currency',
  qty: 'quantity', yr: 'year', mo: 'month', id: 'identifier', ids: 'identifiers', loc: 'location',
  desc: 'description', ts: 'timestamp', org: 'organization', juris: 'jurisdiction', jur: 'jurisdiction',
  reg: 'regulatory', fin: 'financial', calc: 'calculation', max: 'maximum', minm: 'minimum',
};

/** Tokenize a field name into normalized semantic tokens (lexicon-mapped, plural-stripped). */
export function fieldTokens(name) {
  return String(name).split(/[^A-Za-z0-9]+/).filter(Boolean)
    .map((t) => {
      const mapped = TOKEN_LEXICON[t.toLowerCase()] ?? t.toLowerCase();
      return mapped.replace(/s$/, '');
    });
}

/** PAIR HINT: do the two field names plausibly name the same input (token subset either way)? */
export function likelyPair(a, b) {
  const ta = fieldTokens(a);
  const tb = new Set(fieldTokens(b));
  if (!ta.length || !tb.size) return false;
  return ta.every((t) => tb.has(t)) || [...tb].every((t) => ta.includes(t));
}

// ─────────────────────────────────────────────────────────────────────────────
// stripJS — blank comments, prose string contents and regex bodies, keep code.
// Offsets are preserved (blanked with spaces) so error notes stay locatable.
// Identifier-shaped short strings ('field_name') are PRESERVED — blanking them
// would hide pp['field'] reads. Template-literal TEXT is blanked; `${...}`
// interpolation interiors are lexed as code (a template frame keeps the brace
// depth it entered at; the `}` that returns to that depth resumes text mode).
// Hand-rolled because repo scripts are dependency-free in CI plain checkouts
// (SO #10) and a naive quote-matcher silently swallows code around regex
// literals like /['"]/ (the art-23 shape), which would HIDE reads.
// ─────────────────────────────────────────────────────────────────────────────
export function stripJS(src) {
  const out = src.split('');
  const n = src.length;
  const IDENTISH = /^[A-Za-z0-9_$]{1,64}$/;
  const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await', 'throw']);
  const isIdChar = (c) => /[A-Za-z0-9_$]/.test(c);
  const blankRange = (a, b) => { for (let k = a; k < b && k < n; k++) { if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' '; } };

  // frame stack: {kind:'code', braceDepth} | {kind:'template'}
  const stack = [{ kind: 'code', braceDepth: 0 }];
  let i = 0;
  let prevToken = '';

  // Scans template text from i (just past a backtick or a resumed position).
  // Returns index where it stopped: just past the closing backtick (frame popped by caller
  // semantics: template frame stays; caller keeps scanning text) — implemented inline below.
  while (i < n) {
    const frame = stack[stack.length - 1];
    const c = src[i];

    if (frame.kind === 'template') {
      if (c === '\\') { blankRange(i, i + 2); i += 2; continue; }
      if (c === '`') { out[i] = ' '; i++; prevToken = '""'; stack.pop(); continue; }
      if (c === '$' && src[i + 1] === '{') { blankRange(i, i + 2); i += 2; stack.push({ kind: 'code', braceDepth: 0 }); continue; }
      if (c !== '\n' && c !== '\r') out[i] = ' ';
      i++; continue;
    }

    // code frame
    if (c === '/' && src[i + 1] === '/') { const j = src.indexOf('\n', i); const e = j === -1 ? n : j; blankRange(i, e); i = e; continue; }
    if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); const e = j === -1 ? n : j + 2; blankRange(i, e); i = e; continue; }

    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '\n') break; // unterminated on this line — bail out
        j++;
      }
      if (j >= n || src[j] !== c) { blankRange(i, Math.min(j, n)); i = j; continue; }
      const content = src.slice(i + 1, j);
      if (!IDENTISH.test(content)) blankRange(i + 1, j); // keep 'field_name' accessors
      i = j + 1; prevToken = '""'; continue;
    }

    if (c === '`') { out[i] = ' '; i++; stack.push({ kind: 'template' }); continue; }

    if (c === '/') {
      const regexAllowed =
        prevToken === '' || prevToken === '(' || prevToken === ',' || prevToken === '=' || prevToken === ':' ||
        prevToken === '[' || prevToken === '!' || prevToken === '&' || prevToken === '|' || prevToken === '?' ||
        prevToken === '{' || prevToken === '}' || prevToken === ';' || prevToken === '+' || prevToken === '-' ||
        prevToken === '*' || prevToken === '%' || prevToken === '""' || KEYWORDS_BEFORE_REGEX.has(prevToken);
      if (regexAllowed) {
        let j = i + 1; let inClass = false; let closed = false;
        while (j < n) {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '[') inClass = true;
          else if (src[j] === ']') inClass = false;
          else if (src[j] === '/' && !inClass) { closed = true; break; }
          else if (src[j] === '\n') break; // newline ⇒ was never a regex
          j++;
        }
        let e = closed ? j + 1 : j;
        while (e < n && /[a-z]/.test(src[e])) e++; // flags
        blankRange(i, Math.min(e, n));
        i = e; prevToken = '""'; continue;
      }
      prevToken = '/'; i++; continue;
    }

    if (isIdChar(c)) {
      let j = i;
      while (j < n && isIdChar(src[j])) j++;
      prevToken = src.slice(i, j);
      i = j; continue;
    }

    if (c === '{') { frame.braceDepth++; prevToken = '{'; i++; continue; }
    if (c === '}') {
      if (frame.braceDepth === 0 && stack.length > 1 && stack[stack.length - 2].kind === 'template') {
        // closing `}` of a template interpolation — resume template text
        out[i] = ' '; i++; stack.pop(); continue;
      }
      if (frame.braceDepth > 0) frame.braceDepth--;
      prevToken = '}'; i++; continue;
    }

    if (!/\s/.test(c)) prevToken = c;
    i++;
  }
  return out.join('');
}

/** Find the `compute` function (any param name, async or not, exported or not). */
export function findCompute(stripped) {
  const re = /\b(?:export\s+)?(?:async\s+)?function\s+compute\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/;
  const m = re.exec(stripped);
  if (!m) return null;
  const open = stripped.indexOf('{', m.index + m[0].length - 1);
  if (open === -1) return null;
  const close = matchBracket(stripped, open, '{', '}');
  if (close === -1) return null;
  return { param: m[1], start: open + 1, end: close, header: m.index };
}

/** Balance-scan: index of the closer matching the opener at openIdx. */
function matchBracket(text, openIdx, openCh, closeCh) {
  let depth = 0;
  for (let k = openIdx; k < text.length; k++) {
    if (text[k] === openCh) depth++;
    else if (text[k] === closeCh) { depth--; if (depth === 0) return k; }
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// extractReads — reads of `param` (and its aliases) within a function body of
// already-stripped source. Conservative: anything that enumerates or indexes
// dynamically is a DYNAMIC (→ kernel UNPARSEABLE), never a guess.
// ─────────────────────────────────────────────────────────────────────────────
export function extractReads(body, param) {
  const reads = new Set();
  const dynamics = [];
  const helpers = [];
  const aliases = new Map();
  let shadowed = false;

  const P = param.replace(/\$/g, '\\$');
  if (new RegExp(`\\b(?:const|let|var)\\s+${P}\\b`).test(body)) shadowed = true;

  // member reads/writes: pp.x  pp?.x  pp['x']  pp?.['x']  — a capture immediately followed
  // by '(' is a METHOD invocation (pp.hasOwnProperty('x')), never a field read, and is
  // handled by the dedicated hasOwnProperty arm below.
  const memberRe = new RegExp(
    `\\b${P}\\s*\\?\\.\\s*([A-Za-z_$][\\w$]*)` +
    `|\\b${P}\\s*\\.\\s*([A-Za-z_$][\\w$]*)` +
    `|\\b${P}\\s*\\?\\.?\\[\\s*'([\\w$]+)'\\s*\\]` +
    `|\\b${P}\\s*\\?\\.?\\[\\s*"([\\w$]+)"\\s*\\]` +
    `|\\b${P}\\s*\\[\\s*'([\\w$]+)'\\s*\\]` +
    `|\\b${P}\\s*\\[\\s*"([\\w$]+)"\\s*\\]`,
    'g');
  let m;
  while ((m = memberRe.exec(body))) {
    const f = m[1] || m[2] || m[3] || m[4] || m[5] || m[6];
    if (!f) continue;
    const after = body.slice(memberRe.lastIndex, memberRe.lastIndex + 8);
    if (/^\s*\(/.test(after)) continue; // method call, not a field read
    reads.add(f);
  }

  // dynamic bracket access pp[expr] / pp?.[expr] (non-string-literal index).
  // Class (regex source [^'"\]\s=]) excludes quotes (string-literal indexes are reads
  // taken by memberRe), the closing bracket, whitespace, and '='.
  const dynBracketRe = new RegExp(`\\b${P}\\s*\\??\\[\\s*[^'"\\]\\s=]`, 'g');
  while ((m = dynBracketRe.exec(body))) {
    const snippet = body.slice(m.index, Math.min(body.length, m.index + 40)).replace(/\s+/g, ' ');
    dynamics.push(`dynamic bracket access: …${snippet}…`);
  }

  // dynamic enumeration / cloning constructs. The (?![.\[]) lookahead after pp excludes
  // member forms (Object.assign({}, pp.x) is a MEMBER read, not an enumeration).
  const enumPatterns = [
    [new RegExp(`\\bObject\\s*\\.\\s*(?:keys|entries|values|assign|fromEntries|groupBy|getOwnPropertyNames)\\s*\\([^;()]{0,200}?\\b${P}\\b\\s*(?![.\\[])`, 'g'), 'Object enumeration over pp'],
    [new RegExp(`\\.\\s*\\.\\s*\\.\\s*${P}\\b`, 'g'), 'spread of pp'],
    [new RegExp(`\\bfor\\s*\\([^;{)]*\\bin\\s+${P}\\b`, 'g'), 'for..in over pp'],
    [new RegExp(`\\bJSON\\s*\\.\\s*stringify\\s*\\(\\s*${P}\\b\\s*(?![.\\[])`, 'g'), 'JSON.stringify(pp) whole-object use'],
    [new RegExp(`\\bstructuredClone\\s*\\(\\s*${P}\\s*\\)`, 'g'), 'structuredClone(pp) whole-object use'],
  ];
  for (const [re, label] of enumPatterns) while ((m = re.exec(body))) dynamics.push(`${label} (offset ${m.index})`);

  // hasOwnProperty / Reflect.has — literal key ⇒ read; dynamic key ⇒ DYNAMIC
  const hasOwnLiteralRe = new RegExp(`\\bhasOwnProperty\\s*\\.?\\s*(?:call\\s*)?\\(\\s*(?:[^()]{0,80}?)${P}\\s*,\\s*['"]([\\w$]+)['"]`, 'g');
  while ((m = hasOwnLiteralRe.exec(body))) reads.add(m[1]);
  const hasOwnDynRe = new RegExp(`\\bhasOwnProperty\\s*\\.?\\s*(?:call\\s*)?\\(\\s*(?:[^()]{0,80}?)${P}\\s*,\\s*[^'")]`, 'g');
  while ((m = hasOwnDynRe.exec(body))) dynamics.push(`hasOwnProperty(pp, dynamic key) (offset ${m.index})`);
  const reflHasRe = new RegExp(`\\bReflect\\s*\\.\\s*has\\s*\\(\\s*${P}\\s*,\\s*['"]([\\w$]+)['"]`, 'g');
  while ((m = reflHasRe.exec(body))) reads.add(m[1]);

  // `'x' in pp` — specific-field existence check ⇒ a read of x
  const inOpRe = new RegExp(`['"]([\\w$]+)['"]\\s+in\\s+${P}\\b`, 'g');
  while ((m = inOpRe.exec(body))) reads.add(m[1]);

  // pp.hasOwnProperty('x') — method form, literal key ⇒ a read of x
  const hasOwnMethodRe = new RegExp(`\\b${P}\\s*\\.\\s*hasOwnProperty\\s*\\(\\s*['"]([\\w$]+)['"]`, 'g');
  while ((m = hasOwnMethodRe.exec(body))) reads.add(m[1]);

  // declarations: destructuring from pp, whole-object aliases, deep-clone aliases.
  // Scans every (const|let|var) keyword and handles BOTH `const X = …` and
  // `const { … } = pp` (the destructuring form — a plain /const NAME =/ regex can
  // never match it, which silently disabled destructuring until the selftest caught it).
  const declKw = /\b(?:const|let|var)\s*/g;
  let dm;
  while ((dm = declKw.exec(body))) {
    let k = dm.index + dm[0].length;

    // destructuring: { … } = <param|alias>
    if (body[k] === '{') {
      const close = matchBracket(body, k, '{', '}');
      if (close === -1) { dynamics.push(`unbalanced destructuring at offset ${k}`); continue; }
      const after = body.slice(close + 1, close + 120);
      const eqM = after.match(/^\s*=\s*([A-Za-z_$][\w$]*)/);
      if (!eqM) continue; // plain object literal, not a destructuring target
      const srcName = eqM[1];
      if (srcName === param || aliases.has(srcName)) {
        const pattern = body.slice(k + 1, close);
        const parsed = parseDestructureKeys(pattern);
        for (const key of parsed.keys) reads.add(key);
        if (parsed.rest) dynamics.push(`destructuring REST element from ${srcName} (offset ${k}) — read set not enumerable`);
        if (parsed.unparsed) dynamics.push(`unparsed destructuring pattern (offset ${k}): ${parsed.unparsed}`);
      }
      continue;
    }

    // `const NAME = …` — alias forms
    const idM = body.slice(k, k + 200).match(/^([A-Za-z_$][\w$]*)\s*=\s*/);
    if (!idM) continue;
    const name = idM[1];
    const kk = k + idM[0].length;
    const rest = body.slice(kk, kk + 600);

    // whole-object alias: const X = pp  [?? {} | || {}] ;  (semicolon/ASI tolerated)
    const aliasM = rest.match(/^([A-Za-z_$][\w$]*)\s*(?:(?:\?\?|\|\|)\s*\{\s*\}\s*)?(?:;|\r?\n|$)/);
    if (aliasM && (aliasM[1] === param || aliases.has(aliasM[1]))) { aliases.set(name, aliasM[1]); continue; }
    // deep-clone alias
    const cloneM = rest.match(/^JSON\s*\.\s*parse\s*\(\s*JSON\s*\.\s*stringify\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\)\s*;/);
    if (cloneM && (cloneM[1] === param || aliases.has(cloneM[1]))) { aliases.set(name, cloneM[1]); continue; }
    const scM = rest.match(/^structuredClone\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*;/);
    if (scM && (scM[1] === param || aliases.has(scM[1]))) { aliases.set(name, scM[1]); continue; }
  }

  // reads through aliases
  for (const [alias] of aliases) {
    const A = alias.replace(/\$/g, '\\$');
    const aRe = new RegExp(
      `\\b${A}\\s*\\?\\.\\s*([A-Za-z_$][\\w$]*)|\\b${A}\\s*\\.\\s*([A-Za-z_$][\\w$]*)` +
      `|\\b${A}\\s*\\?\\.?\\[\\s*['"]([\\w$]+)['"]\\s*\\]|\\b${A}\\s*\\[\\s*['"]([\\w$]+)['"]\\s*\\]`, 'g');
    while ((m = aRe.exec(body))) reads.add(m[1] || m[2] || m[3] || m[4]);
    const aDyn = new RegExp(`\\b${A}\\s*\\??\\[\\s*[^'"\\]\\s=]`, 'g');
    while ((m = aDyn.exec(body))) dynamics.push(`dynamic bracket access on alias '${alias}' (offset ${m.index})`);
  }

  // helper indirection: callee(pp...) / callee(alias...) — resolve same-file ONE level
  const aliasNames = [...aliases.keys()];
  const argSrc = [param, ...aliasNames].map((s) => s.replace(/\$/g, '\\$')).join('|');
  const callRe = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*\\(\\s*(?:${argSrc})\\b\\s*[,)]`, 'g');
  while ((m = callRe.exec(body))) {
    const callee = m[1];
    if (NON_READING_CALLEES.has(callee)) continue;
    helpers.push(callee);
  }

  return { reads, dynamics, helpers, shadowed, aliases };
}

/** Parse a destructuring pattern's TOP-LEVEL keys. Conservative: anything unexpected → unparsed. */
export function parseDestructureKeys(pattern) {
  const keys = [];
  let rest = false;
  let unparsed = null;
  let i = 0;
  const n = pattern.length;
  while (i < n) {
    const c = pattern[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === ',') { i++; continue; }
    if (c === '.') {
      if (pattern[i + 1] === '.' && pattern[i + 2] === '.') {
        rest = true; i += 3;
        // consume the rest element's binding name — it is NOT a read key
        while (i < n && /[A-Za-z0-9_$\s]/.test(pattern[i])) i++;
        continue;
      }
      unparsed = `stray dot at ${i}`; return { keys, rest, unparsed };
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(pattern[j])) j++;
      const key = pattern.slice(i, j);
      keys.push(key);
      i = j;
      let k = i;
      while (k < n && /\s/.test(pattern[k])) k++;
      if (pattern[k] === ':') {
        k++;
        while (k < n && /\s/.test(pattern[k])) k++;
        if (pattern[k] === '{') { const j2 = matchBracket(pattern, k, '{', '}'); if (j2 === -1) { unparsed = 'unbalanced nested object pattern'; return { keys, rest, unparsed }; } k = j2 + 1; }
        else if (pattern[k] === '[') { const j2 = matchBracket(pattern, k, '[', ']'); if (j2 === -1) { unparsed = 'unbalanced nested array pattern'; return { keys, rest, unparsed }; } k = j2 + 1; }
        else if (/[A-Za-z_$]/.test(pattern[k] || '')) { while (k < n && /[A-Za-z0-9_$]/.test(pattern[k])) k++; }
        else { unparsed = `unexpected char after ':' at ${k}`; return { keys, rest, unparsed }; }
        i = k;
      }
      k = i;
      while (k < n && /\s/.test(pattern[k])) k++;
      if (pattern[k] === '=') {
        k++;
        let vdepth = 0;
        while (k < n) {
          const vc = pattern[k];
          if (vc === '{' || vc === '(' || vc === '[') vdepth++;
          else if (vc === '}' || vc === ')' || vc === ']') { if (vdepth === 0) break; vdepth--; }
          else if (vc === ',' && vdepth === 0) break;
          else if (vc === '"' || vc === "'" || vc === '`') { const q = vc; k++; while (k < n && pattern[k] !== q) { if (pattern[k] === '\\') k++; k++; } }
          k++;
        }
        i = k;
      }
      continue;
    }
    unparsed = `unexpected char '${c}' at ${i}`;
    return { keys, rest, unparsed };
  }
  return { keys, rest, unparsed };
}

/** Locate a same-file function/arrow definition by name; return { param, body } or null. */
export function findLocalHelper(stripped, name) {
  const N = name.replace(/\$/g, '\\$');
  let re = new RegExp(`\\bfunction\\s+${N}\\s*\\(\\s*([A-Za-z_$][\\w$]*)`);
  let m = re.exec(stripped);
  if (m) {
    const open = stripped.indexOf('{', m.index + m[0].length - 1);
    if (open !== -1) {
      const close = matchBracket(stripped, open, '{', '}');
      if (close !== -1) return { param: m[1], body: stripped.slice(open + 1, close) };
    }
  }
  re = new RegExp(`\\b(?:const|let|var)\\s+${N}\\s*=\\s*(?:async\\s*)?\\(\\s*([A-Za-z_$][\\w$]*)`);
  m = re.exec(stripped);
  if (m) {
    const closeParen = stripped.indexOf(')', m.index + m[0].length - 1);
    if (closeParen !== -1) {
      const arrow = stripped.slice(closeParen + 1).match(/^\s*=>\s*(\{)?/);
      if (arrow) {
        if (arrow[1] === '{') {
          const open = closeParen + 1 + arrow.index + arrow[0].length - 1;
          const close = matchBracket(stripped, open, '{', '}');
          if (close !== -1) return { param: m[1], body: stripped.slice(open + 1, close) };
        } else {
          const start = closeParen + 1 + arrow.index + arrow[0].length;
          let end = start; let paren = 0;
          while (end < stripped.length) {
            const ch = stripped[end];
            if (ch === '(') paren++;
            else if (ch === ')') { if (paren === 0) break; paren--; }
            else if ((ch === ';' || ch === ',') && paren === 0) break;
            end++;
          }
          return { param: m[1], body: stripped.slice(start, end) };
        }
      }
    }
  }
  return null;
}

// ── Declared-schema side ─────────────────────────────────────────────────────

/** Index manifests/*.manifest.json by tool_id and by mcp tool name. */
export function loadManifestIndex(repoRoot) {
  const dir = path.join(repoRoot, MANIFESTS_DIR);
  const byTool = new Map();
  const byMcp = new Map();
  let parseErrors = 0;
  let count = 0;
  let files;
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.manifest.json')); } catch { return { byTool, byMcp, parseErrors, count }; }
  for (const f of files) {
    count++;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const rec = { file: `${MANIFESTS_DIR}/${f}`, props: m?.input_schema?.properties ? Object.keys(m.input_schema.properties) : null, required: m?.input_schema?.required || [] };
      if (m?.tool_id && !byTool.has(m.tool_id)) byTool.set(m.tool_id, rec);
      const mcpName = m?.mcp_tool_definition?.name;
      if (mcpName && !byMcp.has(mcpName)) byMcp.set(mcpName, rec);
    } catch { parseErrors++; }
  }
  return { byTool, byMcp, parseErrors, count };
}

/** tool_id → mcp_name from the assembled chaingraph.json. READ-ONLY indexing read. */
export function loadMcpNameIndex(repoRoot) {
  try {
    const g = JSON.parse(fs.readFileSync(path.join(repoRoot, 'chaingraph', 'chaingraph.json'), 'utf8'));
    const map = new Map();
    for (const n of g?.nodes || []) if (n?.tool_id && n?.mcp_name) map.set(n.tool_id, n.mcp_name);
    return map;
  } catch { return new Map(); }
}

/**
 * The tool page's embedded manifest — the row's cross-check surface. Two embedding forms
 * exist in the estate: an HTML comment `<!-- manifest.json { … } -->` (art-09 shape) and a
 * ld+json script block carrying input_schema. Returns { props, required, file } or null.
 */
export function loadPageSchema(repoRoot, toolId) {
  const p = path.join(repoRoot, PAGES_DIR, `${toolId}.html`);
  let html;
  try { html = fs.readFileSync(p, 'utf8'); } catch { return null; }
  const from = (j) => j?.input_schema?.properties
    ? { props: Object.keys(j.input_schema.properties), required: j.input_schema.required || [], file: `${PAGES_DIR}/${toolId}.html#manifest` }
    : null;
  // form 1: comment-embedded manifest.json
  const cOpen = html.indexOf('<!-- manifest.json');
  if (cOpen !== -1) {
    const cClose = html.indexOf('-->', cOpen);
    const blob = html.slice(cOpen + '<!-- manifest.json'.length, cClose === -1 ? html.length : cClose);
    const a = blob.indexOf('{');
    const b = blob.lastIndexOf('}');
    if (a !== -1 && b > a) {
      try {
        const j = JSON.parse(blob.slice(a, b + 1));
        const r = from(j);
        if (r) return r;
      } catch { /* fall through to ld+json */ }
    }
  }
  // form 2: ld+json script block
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const j = JSON.parse(m[1].trim());
      const r = from(j);
      if (r) return r;
    } catch { /* try the next block */ }
  }
  return null;
}

// ── Per-kernel sweep ─────────────────────────────────────────────────────────

export function sweepKernel(repoRoot, kernelFile, manifestIndex, mcpNameByTool = new Map()) {
  const abs = path.join(repoRoot, kernelFile);
  const src = fs.readFileSync(abs, 'utf8');
  const tidM = src.match(/const\s+TOOL_ID\s*=\s*['"]([^'"]+)['"]/);
  const toolId = tidM ? tidM[1] : path.basename(kernelFile, '.kernel.mjs');
  const rec = {
    tool_id: toolId, kernel: kernelFile, verdict: null, reads: [], declared: [], declared_source: null,
    read_not_declared: [], declared_not_read: [], triage: null, page_delta: null,
    unparseable_reason: null, dynamics: [], helpers: [],
  };

  const stripped = stripJS(src);
  const comp = findCompute(stripped);
  if (!comp) {
    rec.verdict = 'UNPARSEABLE';
    rec.unparseable_reason = 'no extractable compute() function';
    return rec;
  }
  const body = stripped.slice(comp.start, comp.end);
  const r = extractReads(body, comp.param);
  if (r.shadowed) {
    rec.verdict = 'UNPARSEABLE';
    rec.unparseable_reason = `compute() param '${comp.param}' is redeclared inside its body — positional shadowing defeats static extraction`;
    return rec;
  }

  // Scope: compute() PLUS any other same-file EXPORTED function whose first parameter is an
  // input-like object (pp/params/policy_parameters/input(s)/raw) — those are caller-facing
  // pp consumers too (the art-508 `export function projectPolicyParameters(pp)` shape, whose
  // Object.keys(pp) enumeration is exactly the dynamic the sweep must not miss). buildArtifact
  // is excluded: it is wire-scaffolding that passes pp through untouched in the standard form.
  const bodies = [{ label: null, text: body, param: comp.param, first: r }];
  const exportRe = /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)/g;
  let ex;
  while ((ex = exportRe.exec(stripped))) {
    const [, name, param] = ex;
    if (name === 'compute' || name === 'buildArtifact') continue;
    if (!/^(pp|params|policy_parameters|input|inputs|raw)$/.test(param)) continue;
    const open = stripped.indexOf('{', ex.index + ex[0].length - 1);
    if (open === -1) continue;
    const close = matchBracket(stripped, open, '{', '}');
    if (close === -1) continue;
    const text = stripped.slice(open + 1, close);
    const first = extractReads(text, param);
    bodies.push({ label: `export:${name}`, text, param, first });
  }

  const reads = new Set();
  const dynamics = [];
  const helperNotes = [];
  for (const b of bodies) {
    for (const f of b.first.reads) reads.add(f);
    for (const d of b.first.dynamics) dynamics.push(b.label ? `in ${b.label}: ${d}` : d);
    if (b.label) helperNotes.push(`${b.label}{${[...b.first.reads].sort().join(',') || '∅'}}`);
  }

  // one level of same-file helper resolution, bounded and loop-guarded
  const resolved = new Set();
  const pending = [...bodies.flatMap((b) => b.first.helpers)];
  let guard = 0;
  while (pending.length && guard < 24) {
    guard++;
    const name = pending.shift();
    if (resolved.has(name)) continue;
    resolved.add(name);
    const h = findLocalHelper(stripped, name);
    if (!h) {
      dynamics.push(`unresolved helper indirection: ${name}(<pp>) — not a same-file function/arrow`);
      continue;
    }
    const hr = extractReads(h.body, h.param);
    for (const f of hr.reads) reads.add(f);
    for (const d of hr.dynamics) dynamics.push(`in helper ${name}(): ${d}`);
    for (const h2 of hr.helpers) if (!resolved.has(h2)) pending.push(h2);
    helperNotes.push(`${name}(){${[...hr.reads].sort().join(',') || '∅'}}`);
  }

  rec.reads = [...reads].sort();
  rec.dynamics = dynamics;
  rec.helpers = helperNotes;

  const hardDynamic = dynamics.filter((d) => !d.startsWith('note:'));
  if (hardDynamic.length) {
    rec.verdict = 'UNPARSEABLE';
    rec.unparseable_reason = `read pattern defeats static extraction — ${hardDynamic[0]}${hardDynamic.length > 1 ? ` (+${hardDynamic.length - 1} more)` : ''}`;
    return rec;
  }

  // Declared side: manifest file primary (by tool_id, else by node mcp_name); page cross-check.
  const mf = manifestIndex.byTool.get(toolId)
    || (mcpNameByTool.get(toolId) ? manifestIndex.byMcp.get(mcpNameByTool.get(toolId)) : null)
    || null;
  let declared = mf ? mf.props : null;
  let declaredSource = mf ? mf.file : null;
  const page = loadPageSchema(repoRoot, toolId);
  if (page) {
    if (declared) {
      const a = new Set(declared);
      const b = new Set(page.props);
      const onlyManifest = [...a].filter((x) => !b.has(x));
      const onlyPage = [...b].filter((x) => !a.has(x));
      if (onlyManifest.length || onlyPage.length) {
        rec.page_delta = { only_in_manifest: onlyManifest, only_in_page: onlyPage, page_file: page.file };
      }
    } else {
      declared = page.props;
      declaredSource = page.file;
    }
  }
  rec.declared_source = declaredSource;

  if (declared === null) {
    rec.declared = [];
    rec.verdict = 'DIVERGES';
    rec.read_not_declared = rec.reads.slice();
    rec.declared_not_read = [];
    rec.triage = {
      class: 'NO-DECLARED-SCHEMA',
      note: 'no manifests/*.manifest.json record and no page-embedded input_schema pairs with this kernel — the caller-facing declared surface does not exist (absence is not a pass, SO #34c)',
    };
    return rec;
  }
  rec.declared = declared.slice();

  const readSet = new Set(rec.reads);
  const declaredSet = new Set(declared);
  const rnd = rec.reads.filter((f) => !declaredSet.has(f));
  const dnr = declared.filter((f) => !readSet.has(f));
  rec.read_not_declared = rnd;
  rec.declared_not_read = dnr;

  if (!rnd.length && !dnr.length) {
    rec.verdict = 'CLEARED';
    return rec;
  }

  const declaredNotReadSet = new Set(dnr);
  const aliasPairs = [];
  const benignAlias = [];
  const unreachableExtra = [];
  const pairedDeclared = new Set();
  for (const f of rnd) {
    // PAIR HINT (details only): token-subset match against a declared-but-never-read field
    let counterpart = null;
    for (const d of dnr) {
      if (pairedDeclared.has(d)) continue;
      if (likelyPair(f, d)) { counterpart = d; break; }
    }
    if (counterpart) {
      pairedDeclared.add(counterpart);
      if (readSet.has(counterpart)) benignAlias.push({ read: f, declared_counterpart: counterpart });
      else aliasPairs.push({ read: f, declared_counterpart: counterpart });
    } else {
      unreachableExtra.push(f);
    }
  }
  const staleSchema = dnr.filter((f) => !pairedDeclared.has(f));
  const cls = aliasPairs.length ? 'ART09-CLASS'
    : unreachableExtra.length && staleSchema.length ? 'MIXED'
    : unreachableExtra.length ? 'UNREACHABLE-INPUT'
    : benignAlias.length ? 'BENIGN-ALIAS'
    : 'STALE-SCHEMA';
  rec.triage = {
    class: cls,
    alias_pairs: aliasPairs,
    benign_alias: benignAlias,
    unreachable_extra: unreachableExtra,
    stale_schema: staleSchema,
  };
  rec.verdict = 'DIVERGES';
  return rec;
}

/** Enumerate kernel files (SO #52: git ls-files, never a filesystem walk; SO #57: scrubbed env). */
export function listKernelFiles(repoRoot) {
  const out = execSync('git ls-files "chaingraph/kernels/*.kernel.mjs"', { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: gitEnv() });
  return out.split('\n').map((s) => s.trim()).filter(Boolean).sort();
}

export function sweepAll(repoRoot, { quiet = false } = {}) {
  const kernels = listKernelFiles(repoRoot);
  const manifestIndex = loadManifestIndex(repoRoot);
  const mcpNameByTool = loadMcpNameIndex(repoRoot);
  const records = kernels.map((k) => sweepKernel(repoRoot, k, manifestIndex, mcpNameByTool));
  const summary = summarize(records, kernels.length, manifestIndex);
  if (!quiet) printReport(records, summary);
  return { records, summary, kernel_count: kernels.length, enumeration: 'git ls-files "chaingraph/kernels/*.kernel.mjs"' };
}

export function summarize(records, kernelCount, manifestIndex) {
  const byVerdict = { CLEARED: 0, DIVERGES: 0, UNPARSEABLE: 0 };
  const byClass = {};
  let fieldsDnr = 0, fieldsRnd = 0, noSchema = 0, pageDeltaCount = 0;
  for (const r of records) {
    byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1;
    if (r.triage?.class) byClass[r.triage.class] = (byClass[r.triage.class] || 0) + 1;
    fieldsDnr += r.declared_not_read.length;
    fieldsRnd += r.read_not_declared.length;
    if (r.triage?.class === 'NO-DECLARED-SCHEMA') noSchema++;
    if (r.page_delta) pageDeltaCount++;
  }
  return {
    kernels: kernelCount,
    verdicts: byVerdict,
    triage_classes: byClass,
    declared_not_read_fields: fieldsDnr,
    read_not_declared_fields: fieldsRnd,
    no_declared_schema_kernels: noSchema,
    manifest_parse_errors: manifestIndex?.parseErrors || 0,
    manifests_seen: manifestIndex?.count || 0,
    page_manifest_delta_kernels: pageDeltaCount,
    hit_rate: kernelCount ? (byVerdict.DIVERGES + byVerdict.UNPARSEABLE) / kernelCount : 0,
  };
}

function fmtList(a) {
  if (!a || !a.length) return '';
  const s = a.join(', ');
  return s.length > 220 ? s.slice(0, 217) + '…' : s;
}

/** The ONE LINE per kernel. */
export function verdictLine(r) {
  if (r.verdict === 'UNPARSEABLE') return `UNPARSEABLE ${r.unparseable_reason}`;
  if (r.verdict === 'CLEARED') return 'CLEARED';
  const t = r.triage || {};
  const parts = [];
  if (t.class === 'NO-DECLARED-SCHEMA') parts.push('NO-DECLARED-SCHEMA (no manifest record, no page block)');
  if (t.alias_pairs?.length) parts.push(`ART09-CLASS alias-pairs: ${fmtList(t.alias_pairs.map((p) => `${p.read}≠${p.declared_counterpart}`))}`);
  if (t.unreachable_extra?.length) parts.push(`read-never-declared: ${fmtList(t.unreachable_extra)}`);
  if (t.benign_alias?.length) parts.push(`benign-alias reads-both: ${fmtList(t.benign_alias.map((p) => `${p.read}~${p.declared_counterpart}`))}`);
  if (t.stale_schema?.length) parts.push(`declared-never-read: ${fmtList(t.stale_schema)}`);
  if (r.page_delta) parts.push(`page↔manifest delta: page-only[${fmtList(r.page_delta.only_in_page)}] manifest-only[${fmtList(r.page_delta.only_in_manifest)}]`);
  if (r.helpers?.length) parts.push(`helpers: ${fmtList(r.helpers)}`);
  return `DIVERGES [${parts.join(' | ')}]`;
}

function printReport(records, summary) {
  console.log(`\n== SCHEMA-READ-DIVERGENCE sweep: ${summary.kernels} kernels ==`);
  for (const r of records) console.log(`${r.tool_id} | ${verdictLine(r)}`);
  console.log('\n== summary ==');
  console.log(JSON.stringify(summary, null, 2));
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const getOpt = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };
  const tsvPath = getOpt('--tsv');
  const jsonPath = getOpt('--json');
  const summaryOnly = args.includes('--summary');
  const strict = args.includes('--strict');

  const { records, summary } = sweepAll(REPO, { quiet: summaryOnly });

  if (tsvPath) {
    const lines = [
      '# SCHEMA-READ-DIVERGENCE-SWEEP-1 — per-kernel verdict lines (one line per kernel)',
      `# enumeration: git ls-files "chaingraph/kernels/*.kernel.mjs" (${records.length} files) — SO #52`,
      `# summary: ${JSON.stringify(summary)}`,
      'tool_id\tkernel\tverdict\tdetails',
    ];
    for (const r of records) {
      const det = r.verdict === 'CLEARED' ? '' : verdictLine(r).replace(/\t/g, ' ');
      lines.push(`${r.tool_id}\t${r.kernel}\t${r.verdict}\t${det}`);
    }
    fs.writeFileSync(tsvPath, lines.join('\n') + '\n');
    console.error(`wrote ${records.length} kernel lines -> ${tsvPath}`);
  }
  if (jsonPath) {
    fs.writeFileSync(jsonPath, JSON.stringify({ summary, records }, null, 2));
    console.error(`wrote full JSON -> ${jsonPath}`);
  }
  console.log(`SCHEMA-READ-DIVERGENCE summary: ${summary.kernels} kernels | CLEARED ${summary.verdicts.CLEARED} | DIVERGES ${summary.verdicts.DIVERGES} | UNPARSEABLE ${summary.verdicts.UNPARSEABLE} | declared-not-read fields ${summary.declared_not_read_fields} | read-not-declared fields ${summary.read_not_declared_fields} | no-declared-schema kernels ${summary.no_declared_schema_kernels} | hit rate ${(summary.hit_rate * 100).toFixed(1)}%`);
  if (strict && (summary.verdicts.DIVERGES > 0 || summary.verdicts.UNPARSEABLE > 0)) process.exit(1);
  process.exit(0);
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check-schema-read-divergence.mjs')) main();
