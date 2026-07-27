#!/usr/bin/env node
// SILENT-FAIL-AUDIT-1: static scanner for the CANON-ORDER-1 defect class.
// A1: cross-block declaration-after-use (identifier used synchronously in an
//     earlier inline <script> block, declared only in a later block).
// A2: catch blocks that write to the DOM without rethrow/console.error.
// A3 (SILENTSCAN-UNDECLARED-1): identifier used synchronously with NO
//     declaration anywhere in the file and not a known global -- the
//     strictly worse defect A1's predicate structurally cannot catch (the
//     ESCDAG case: 143 chain pages calling esc() that is never declared at
//     all, not merely declared late).
// Zero-dep, plain Node. Report-only tool — does not modify any file.
//
// Usage: node scan-silent-fail.mjs <dir> [<dir> ...] [--json out.json]

import fs from 'node:fs';
import path from 'node:path';

const KEYWORDS = new Set([
  'var','let','const','function','return','if','else','for','while','do','switch','case',
  'break','continue','try','catch','finally','throw','new','delete','typeof','instanceof',
  'in','of','this','null','undefined','true','false','void','yield','async','await','class',
  'extends','super','import','export','default','from','as','get','set','static','with',
  'window','document','console','Math','JSON','Object','Array','String','Number','Boolean',
  'Date','Error','Promise','Map','Set','RegExp','Symbol','Infinity','NaN','arguments',
  'fetch','localStorage','sessionStorage','navigator','location','history','parseInt',
  'parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','setTimeout',
  'setInterval','clearTimeout','clearInterval','requestAnimationFrame','Element','HTMLElement',
  'CustomEvent','Event','Blob','FormData','URL','URLSearchParams','Intl','structuredClone',
  'globalThis','self','crypto','TextEncoder','TextDecoder','performance','alert','confirm','prompt'
]);

// SILENTSCAN-UNDECLARED-1 case (b): additional known-global allowlist beyond
// KEYWORDS above, for the "never declared anywhere, and not a known global"
// predicate. Stated and justified per-entry in the accompanying report --
// this list is where the predicate lives or dies (too narrow = false-positive
// flood, too broad = re-hides real bugs).
const CASE_B_GLOBALS = new Set([
  // typed arrays / binary data -- ubiquitous in hash/crypto code on this site
  'Uint8Array','Uint16Array','Uint32Array','Int8Array','Int16Array','Int32Array',
  'Float32Array','Float64Array','ArrayBuffer','DataView','BigInt','BigInt64Array','BigUint64Array',
  // language/runtime builtins not already in KEYWORDS
  'WeakMap','WeakSet','Reflect','Proxy','SubtleCrypto','WebAssembly',
  // browser/DOM globals commonly referenced outside element-scoped code
  'MutationObserver','ResizeObserver','IntersectionObserver',
  'requestIdleCallback','cancelIdleCallback','atob','btoa','matchMedia',
  'getComputedStyle','indexedDB','CSS','Node','NodeList','DOMParser',
  'XMLSerializer','FileReader','ReadableStream','WritableStream','Worker',
  'Notification','Image','Audio','Option','requestAnimationFrame',
  'OffscreenCanvas','unescape','escape',
  // Error subclasses -- KEYWORDS above already has the base `Error`
  'TypeError','RangeError','SyntaxError','EvalError','URIError','ReferenceError','AggregateError',
  // CommonJS/AMD/UMD environment-detection idiom (`typeof module !==
  // 'undefined' && module.exports = ...`, `typeof define === 'function' &&
  // define.amd`). These appear ONLY inside a `typeof X !== 'undefined'`
  // guard in every occurrence found across the full re-scan of this site's
  // vendored bundles (Chart.js, PapaParse) and this site's own UMD-style
  // export footers (tools/525-iscc-content-code-generator.html). Even the
  // SECOND reference in `typeof module !== 'undefined' && module.exports`
  // is exception-safe: `&&` short-circuits, so `module.exports` is never
  // evaluated when `module` is actually undefined. Not real page globals;
  // never assigned to or read outside this exact guarded idiom.
  'module','exports','define','require',
]);

function findHtmlFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && e.name.endsWith('.html')) out.push(p);
    }
  }
  return out;
}

// Extract inline <script> blocks (no src=) in document order, with their
// character offset (for line-number reporting) and raw content.
function extractInlineScripts(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']*)["']/i);
    if (typeMatch && !/^(text\/javascript|module)$/i.test(typeMatch[1].trim())) continue;
    blocks.push({ offset: m.index, content: m[2] });
  }
  return blocks;
}

function lineOf(html, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < html.length; i++) if (html[i] === '\n') line++;
  return line;
}

// Strip strings/comments/regex-literals to a same-length blanked string so
// brace/paren depth tracking and identifier regexes don't trip on text
// inside quotes or comments. Hand-rolled heuristic lexer, not a real parser.
//
// SILENTSCAN-UNDECLARED-1 fix: the original version treated backtick
// template literals like a plain quoted string -- scan to the NEXT raw
// backtick. That breaks on a nested template literal inside a `${...}`
// hole (e.g. `${items.map(x => \`<div>${x}</div>\`).join('')}`): the first
// backtick INSIDE the hole was read as closing the OUTER literal, so the
// HTML markup between the two backticks was left un-blanked and parsed as
// live code -- flooding the never-declared-identifier scan (case b) with
// HTML tag/attribute names (div, span, href, width, style, ...) as fake
// "undeclared identifiers". blankTemplateLiteral below is hole-aware: it
// finds the matching `}` for each `${` (skipping over nested strings and
// template literals while counting), then recursively blanks the CODE
// inside that hole with the same lexer, so nested templates of arbitrary
// depth are handled correctly and brace/identifier positions stay accurate.
function blankNonCode(src) {
  return blankRange(src, 0, src.length).out;
}

// Is a `/` at this point the START OF A REGEX LITERAL, vs. a division
// operator? Decided by what precedes it: a regex can start after an
// operator/punctuator or `return`/`typeof`; division follows a value
// (identifier, number, `)`, `]`).
//
// SILENTSCAN-UNDECLARED-1 fix: the ORIGINAL heuristic (present before this
// row, inherited unchanged into blankTemplateLiteral's copy) tested
// `/[=([{,;:!&|?+\-*%^~<>]|^$|return|typeof/.test(tail.slice(-6))` --
// unanchored, so it matches if ANY of those chars appears ANYWHERE in the
// last 6 characters, not just at the very end. MEASURED: `cy-barH/2`
// (plain division inside a template-literal hole) has a `-` earlier in its
// 6-char tail ("y-barH"), so the old test wrongly classified the `/` as a
// regex opener, corrupting the hole-boundary scan and breaking the
// position-preserving invariant for the rest of the file (found via a
// blanked.length !== content.length sweep across all 1605 files, 27 hit
// before this fix -- e.g. tools/01-a2a-fee-route-optimizer.html).
function looksLikeRegexContext(prevSignificant) {
  const t = prevSignificant.trim();
  if (t === '') return true;
  if (/[=([{,;:!&|?+\-*%^~<>]$/.test(t)) return true;
  if (/(?:^|[^\w$])(?:return|typeof)$/.test(t)) return true;
  return false;
}

function blankRange(src, start, end) {
  let out = '';
  let i = start;
  let prevSignificant = '';
  while (i < end) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const s0 = i;
      while (i < end && src[i] !== '\n') i++;
      out += ' '.repeat(i - s0);
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const s0 = i;
      i += 2;
      while (i < end && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(i + 2, end);
      out += (src.slice(s0, i).replace(/[^\n]/g, ' '));
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      const s0 = i;
      i++;
      while (i < end && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      i = Math.min(i + 1, end);
      out += src.slice(s0, i).replace(/[^\n]/g, ' ');
      continue;
    }
    if (c === '`') {
      const r = blankTemplateLiteral(src, i, end);
      out += r.out;
      i = r.end;
      continue;
    }
    if (c === '/' && looksLikeRegexContext(prevSignificant)) {
      const s0 = i;
      let j = i + 1;
      let inClass = false;
      let ok = false;
      while (j < end) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) { ok = true; j++; break; }
        else if (src[j] === '\n') break;
        j++;
      }
      if (ok) {
        i = j;
        while (i < end && /[a-z]/i.test(src[i])) i++;
        out += src.slice(s0, i).replace(/[^\n]/g, ' ');
        continue;
      }
    }
    out += c;
    if (!/\s/.test(c)) prevSignificant += c;
    if (prevSignificant.length > 20) prevSignificant = prevSignificant.slice(-20);
    i++;
  }
  return { out, end: i };
}

// Blank one backtick template literal starting at src[start] === '`'.
// Literal text is blanked (it's not JS); each `${...}` hole's CODE is kept
// live by recursively running it back through blankRange, so nested
// templates/strings/comments/braces inside a hole are parsed correctly and
// the output stays exactly the same length as the input (position-
// preserving, required so callers' character offsets stay valid).
function blankTemplateLiteral(src, start, end) {
  let out = ' '; // opening backtick
  let i = start + 1;
  while (i < end) {
    const c = src[i];
    if (c === '\\') {
      out += (src[i + 1] === '\n') ? ' \n' : '  ';
      i += 2;
      continue;
    }
    if (c === '`') { out += ' '; i++; break; }
    if (c === '$' && src[i + 1] === '{') {
      const holeStart = i + 2;
      let depth = 1, j = holeStart;
      let prevSig = '';
      while (j < end && depth > 0) {
        if (src[j] === '{') { depth++; prevSig = ''; j++; }
        else if (src[j] === '}') { depth--; if (depth > 0) { prevSig = ''; j++; } }
        else if (src[j] === '`') { const t = blankTemplateLiteral(src, j, end); j = t.end; prevSig = ''; }
        else if (src[j] === '"' || src[j] === "'") {
          const q = src[j];
          let k = j + 1;
          while (k < end && src[k] !== q) { if (src[k] === '\\') k++; k++; }
          j = Math.min(k + 1, end);
          prevSig = '';
        } else if (src[j] === '/' && looksLikeRegexContext(prevSig)) {
          // A regex literal (`/"/g`, `/[{}]/`, ...) can contain quote/brace
          // chars that are NOT real strings/braces -- without this, this
          // hole-boundary scanner (a lighter-weight pass than blankRange,
          // just here to locate the matching `}`) misreads them as such and
          // desyncs the matched `}` position, corrupting every offset for
          // the rest of the file. MEASURED: `${String(c).replace(/"/g,
          // '""')}` inside a CSV-export template literal broke the
          // position-preserving invariant this whole scanner depends on
          // (blanked.length !== content.length) partway through
          // 09-a2a-reconciliation-workbench.html, producing garbage
          // "undeclared identifier" hits for the rest of that file.
          let k = j + 1, inClass = false, ok = false;
          while (k < end) {
            if (src[k] === '\\') { k += 2; continue; }
            if (src[k] === '[') inClass = true;
            else if (src[k] === ']') inClass = false;
            else if (src[k] === '/' && !inClass) { ok = true; k++; break; }
            else if (src[k] === '\n') break;
            k++;
          }
          if (ok) {
            while (k < end && /[a-z]/i.test(src[k])) k++;
            j = k;
            prevSig = '';
          } else { j++; prevSig = '/'; }
        } else {
          if (!/\s/.test(src[j])) { prevSig += src[j]; if (prevSig.length > 20) prevSig = prevSig.slice(-20); }
          j++;
        }
      }
      const holeCode = blankRange(src, holeStart, j).out;
      out += '  ' + holeCode + ' ';
      i = j + 1;
      continue;
    }
    out += c === '\n' ? '\n' : ' ';
    i++;
  }
  return { out, end: i };
}

function braceDepths(blanked) {
  const depths = new Array(blanked.length);
  let depth = 0;
  for (let i = 0; i < blanked.length; i++) {
    const c = blanked[i];
    if (c === '{') { depths[i] = depth; depth++; }
    else if (c === '}') { depth = Math.max(0, depth - 1); depths[i] = depth; }
    else depths[i] = depth;
  }
  return depths;
}

// Is the '{' at absolute position bracePos the opening of a FUNCTION BODY
// (function decl/expr, method, or block-bodied arrow)? vs. a control-flow or
// plain block brace (if/for/while/try/catch/finally/else/do/switch/{...}) or
// an object literal — those do NOT gate execution on being "called", so they
// must NOT count as a nesting level for reachability purposes. Getting this
// wrong was the root cause of the first cut of this scanner missing its own
// positive control: `(async function init(){ try { ...call... } })()` — the
// `try{` brace is not a function brace, so code inside it is still
// unconditionally executed once init() runs, but raw brace-depth treated it
// as one level deeper and excluded it from "synchronous" spans.
function isFunctionBrace(blanked, bracePos) {
  const window = blanked.slice(Math.max(0, bracePos - 400), bracePos);
  if (/=>\s*$/.test(window)) return true;
  if (/function\b[^{}]*\)\s*$/.test(window)) return true;
  return false;
}

// Function-nesting depth per character (whole-string absolute indices used
// for isFunctionBrace's backward window regardless of range boundaries
// passed by callers). Stack-based so every '}' pops exactly what its
// matching '{' pushed, function-brace or not.
function funcNestDepths(blanked) {
  const depths = new Array(blanked.length);
  const stack = []; // matching stack (every brace, for correct pop pairing)
  let funcDepth = 0; // count of function-type braces currently open — the exposed depth
  for (let i = 0; i < blanked.length; i++) {
    const c = blanked[i];
    if (c === '{') {
      depths[i] = funcDepth;
      const isFn = isFunctionBrace(blanked, i);
      stack.push(isFn);
      if (isFn) funcDepth++;
    } else if (c === '}') {
      const wasFn = stack.pop();
      if (wasFn) funcDepth = Math.max(0, funcDepth - 1);
      depths[i] = funcDepth;
    } else {
      depths[i] = funcDepth;
    }
  }
  return depths;
}

function mergeSpans(spans) {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const sp of sorted) {
    if (merged.length && sp[0] <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], sp[1]);
    } else merged.push([...sp]);
  }
  return merged;
}

// Structural-only synchronous spans within [start,end): FUNCTION-nesting-
// depth-0-of-this-range statements (control-flow/plain-block/object-literal
// braces do NOT gate — only function-body braces do, per isFunctionBrace),
// plus (recursively) the interiors of IIFEs invoked at that depth. Does NOT
// expand named function bodies — those are only "reached" if actually
// called, a file-wide question handled separately below.
function structuralSyncSpans(blanked, fdepths, start, end, _depth) {
  const depth = _depth || 0;
  if (depth > 12) return []; // pathological-nesting backstop
  const baseline = fdepths[start] !== undefined ? fdepths[start] : 0;
  const slice = blanked.slice(start, end);

  const spans = [];
  let s = null;
  for (let i = 0; i <= slice.length; i++) {
    const atTop = i < slice.length && (fdepths[start + i] - baseline) === 0;
    if (atTop && s === null) s = i;
    if (!atTop && s !== null) { spans.push([start + s, start + i]); s = null; }
  }

  const iifeRe = /\(\s*(?:async\s+)?function\b[^{]*\{|\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{|!\s*function\b[^{]*\{/g;
  let im;
  while ((im = iifeRe.exec(slice))) {
    if ((fdepths[start + im.index] - baseline) !== 0) continue;
    const braceStartRel = slice.indexOf('{', im.index);
    if (braceStartRel === -1) continue;
    const braceStartAbs = start + braceStartRel;
    let d = 0, j = braceStartRel;
    for (; j < slice.length; j++) {
      if (slice[j] === '{') d++;
      else if (slice[j] === '}') { d--; if (d === 0) break; }
    }
    const tail = slice.slice(j + 1, j + 6);
    if (/^\s*\)?\s*\(/.test(tail) || /^\s*\)/.test(tail)) {
      spans.push(...structuralSyncSpans(blanked, fdepths, braceStartAbs + 1, start + j, depth + 1));
    }
  }

  return mergeSpans(spans);
}

// Every named function declaration anywhere in the block (any nesting depth),
// name -> body interior [start,end) (braces excluded). Used-defined-only —
// a call site inside one function calling into ANOTHER function declared in
// a different (e.g. outer, or sibling-IIFE) scope is a normal, legal JS
// pattern (CANON-ORDER-1's own init() -> sha256hex() shape spans exactly one
// block but two different declaration sites), so reachability below is
// computed file-wide, not scoped per nesting level.
function collectAllFunctions(blanked) {
  const fnDeclRe = /(^|[;{}])\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
  const fnBodies = new Map();
  let fm;
  while ((fm = fnDeclRe.exec(blanked))) {
    const braceStart = blanked.indexOf('{', fm.index + fm[0].length - 1);
    if (braceStart === -1) continue;
    let d = 0, j = braceStart;
    for (; j < blanked.length; j++) {
      if (blanked[j] === '{') d++;
      else if (blanked[j] === '}') { d--; if (d === 0) break; }
    }
    fnBodies.set(fm[2], [braceStart + 1, j]);
  }
  return fnBodies;
}

function isNameCalledInSpans(blanked, name, curSpans) {
  const callRe = new RegExp('(^|[^\\w$.])' + name.replace(/[$]/g, '\\$') + '\\s*\\(', 'g');
  for (const [a, b] of curSpans) {
    const seg = blanked.slice(a, b);
    let cm;
    callRe.lastIndex = 0;
    while ((cm = callRe.exec(seg))) {
      const idxInSeg = cm.index + cm[0].indexOf(name);
      const before = seg.slice(Math.max(0, idxInSeg - 12), idxInSeg);
      if (/function\s*$/.test(before)) continue; // it's the declaration, not a call
      return true;
    }
  }
  return false;
}

// Full synchronous spans for a block: structural spans, plus a file-wide
// fixed point over every named function — reached (and its own structural
// interior added) if its name is called anywhere inside a span already known
// synchronous, regardless of which scope declared it or which scope calls it.
function synchronousSpans(blanked) {
  const fdepths = funcNestDepths(blanked);
  let spans = structuralSyncSpans(blanked, fdepths, 0, blanked.length, 0);
  const allFns = collectAllFunctions(blanked);
  const reached = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, bodySpan] of allFns) {
      if (reached.has(name)) continue;
      if (isNameCalledInSpans(blanked, name, spans)) {
        reached.add(name);
        spans = mergeSpans([...spans, ...structuralSyncSpans(blanked, fdepths, bodySpan[0], bodySpan[1], 0)]);
        changed = true;
      }
    }
  }
  return spans;
}

// `\b` treats `$` as a NON-word char (per its `\w`-based definition), even
// though `$` is a legal, common JS identifier character (`fmt$`, `$el`,
// jQuery's `$`, ...). A trailing `\b` after `[\w$]*` forces the regex
// engine to backtrack off any trailing `$` to find a word-boundary
// position, silently truncating `fmt$` to `fmt` -- MEASURED: this made
// `fmt$`-style helper names (a real declared function) look like a call to
// an undeclared `fmt(...)` in 10 art-2xx/pf pages. Fixed with lookaround
// that treats `$`/word-chars uniformly as "identifier chars" on both sides.
const IDENT_RE = /(?<![\w$])([A-Za-z_$][\w$]*)(?![\w$])/g;

function declaredGlobals(raw, blanked) {
  const decl = new Set();
  const depths = braceDepths(blanked);
  let m;
  const fnRe = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = fnRe.exec(blanked))) if (depths[m.index] === 0) decl.add(m[1]);
  const varRe = /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = varRe.exec(blanked))) if (depths[m.index] === 0) decl.add(m[1]);
  const winRe = /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = winRe.exec(blanked))) decl.add(m[1]);
  const destructRe = /\b(?:var|let|const)\s*\{([^}]*)\}\s*=/g;
  while ((m = destructRe.exec(blanked))) {
    if (depths[m.index] !== 0) continue;
    for (const part of m[1].split(',')) {
      const name = part.split(':').pop().trim().split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) decl.add(name);
    }
  }
  return decl;
}

// --- SILENTSCAN-UNDECLARED-1 case (b): parameter/local-scope tracking ---
//
// CHOSEN APPROACH (stated per row instruction): add parameter/local-scope
// tracking rather than accept the high false-positive rate. Scope is
// FILE-WIDE, not per-lexical-scope (the scanner has no real scope graph,
// same zero-dep-heuristic posture as declaredGlobals/synchronousSpans
// above) -- a name bound as a parameter or local ANYWHERE in the file
// suppresses case-(b) flagging for every use of that name in the file. This
// is deliberately coarser than real JS scoping: it directly fixes the two
// known false-positive shapes from SILENT-FAIL-AUDIT-1 (`wb`, `evidence` --
// function-parameter shadowing of a later-declared global) at the cost of a
// theoretical over-suppression risk (a genuinely undeclared global sharing a
// name with an unrelated parameter elsewhere in the same file would be
// masked). That risk is accepted explicitly: without this tracking, every
// parameter name in every function becomes a candidate false positive,
// which would drown the real findings this row exists to surface.

// Split a comma-separated list on TOP-LEVEL commas only (depth-aware over
// (), [], {} so nested destructuring/defaults/calls don't fragment).
function splitTopLevel(str) {
  const parts = [];
  let depth = 0, cur = '';
  for (const c of str) {
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

// Extract bound identifier names from one binding pattern -- handles nested
// object/array destructuring, renames (`{a: b}` binds `b` not `a`),
// shorthand (`{a}` binds `a`), defaults (`{a=1}`, `x=1`), and rest (`...x`).
// Heuristic regex-based extraction, not a real parser -- consistent with the
// rest of this file's hand-rolled-lexer style.
function extractPatternNames(pattern, out) {
  const p = pattern.trim().replace(/^\.\.\./, '');
  if (!p) return;
  if (p.startsWith('{') && p.endsWith('}')) {
    for (const part of splitTopLevel(p.slice(1, -1))) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;
      const colonIdx = trimmedPart.indexOf(':');
      if (colonIdx === -1) {
        // shorthand {a} or {a = 1} -- the key IS the bound name
        const eqIdx = trimmedPart.indexOf('=');
        const name = (eqIdx === -1 ? trimmedPart : trimmedPart.slice(0, eqIdx)).trim().replace(/^\.\.\./, '');
        if (/^[A-Za-z_$][\w$]*$/.test(name)) out.add(name);
      } else {
        // {key: bound} or {key: bound = default} or {key: {nested}}
        const rest = trimmedPart.slice(colonIdx + 1).trim();
        if (rest.startsWith('{') || rest.startsWith('[')) extractPatternNames(rest, out);
        else {
          const eqIdx = rest.indexOf('=');
          const name = (eqIdx === -1 ? rest : rest.slice(0, eqIdx)).trim();
          if (/^[A-Za-z_$][\w$]*$/.test(name)) out.add(name);
        }
      }
    }
  } else if (p.startsWith('[') && p.endsWith(']')) {
    for (const part of splitTopLevel(p.slice(1, -1))) {
      const trimmedPart = part.trim().replace(/^\.\.\./, '');
      if (!trimmedPart) continue;
      if (trimmedPart.startsWith('{') || trimmedPart.startsWith('[')) extractPatternNames(trimmedPart, out);
      else {
        const eqIdx = trimmedPart.indexOf('=');
        const name = (eqIdx === -1 ? trimmedPart : trimmedPart.slice(0, eqIdx)).trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) out.add(name);
      }
    }
  } else {
    const eqIdx = p.indexOf('=');
    const name = (eqIdx === -1 ? p : p.slice(0, eqIdx)).trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) out.add(name);
  }
}

// A binding LIST is either a param list (`a, {b}, c=1`) or a declarator list
// (`a = 1, {b, c} = obj`) -- both are top-level-comma-separated bindings,
// each optionally followed by `= <init>` which must be stripped before
// pattern extraction (an init expression can itself contain `{`/`[`/`,`).
function extractBindingListNames(listStr) {
  const out = new Set();
  for (const part of splitTopLevel(listStr)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    let pattern = trimmed;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const open = trimmed[0], close = open === '{' ? '}' : ']';
      let depth = 0, i = 0;
      for (; i < trimmed.length; i++) {
        if (trimmed[i] === open) depth++;
        else if (trimmed[i] === close) { depth--; if (depth === 0) { i++; break; } }
      }
      pattern = trimmed.slice(0, i);
    } else {
      const eqIdx = trimmed.indexOf('=');
      pattern = eqIdx === -1 ? trimmed : trimmed.slice(0, eqIdx);
    }
    extractPatternNames(pattern, out);
  }
  return out;
}

// Every name bound as a function parameter, local var/let/const/destructure,
// catch parameter, or class name, ANYWHERE in the block (any nesting depth).
// File-wide/block-wide, not scope-precise -- see rationale in the comment
// above this section.
function collectAllLocalNames(blanked) {
  const names = new Set();
  let m;

  const fnNameRe = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = fnNameRe.exec(blanked))) names.add(m[1]);

  const classRe = /\bclass\s+([A-Za-z_$][\w$]*)/g;
  while ((m = classRe.exec(blanked))) names.add(m[1]);

  const catchRe = /catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g;
  while ((m = catchRe.exec(blanked))) names.add(m[1]);

  // ES module import bindings: `import { a, b as c } from '...'`,
  // `import def from '...'`, `import * as ns from '...'`. MEASURED gap:
  // chaingraph/kernel-vm.html's `<script type="module">` genuinely imports
  // `runKernelInVM` (`import { runKernelInVM } from './vm/kernel-vm.mjs'`)
  // -- a real, correct declaration this scanner had no notion of at all,
  // flagging it as "never declared" even though it plainly is.
  const importDefaultRe = /\bimport\s+([A-Za-z_$][\w$]*)\s*(?:,\s*)?(?:\{|from)/g;
  while ((m = importDefaultRe.exec(blanked))) names.add(m[1]);
  const importNamespaceRe = /\bimport\s+\*\s*as\s+([A-Za-z_$][\w$]*)\s+from/g;
  while ((m = importNamespaceRe.exec(blanked))) names.add(m[1]);
  const importNamedRe = /\bimport\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from/g;
  while ((m = importNamedRe.exec(blanked))) {
    for (const part of splitTopLevel(m[1])) {
      const bound = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(bound)) names.add(bound);
    }
  }

  // Find the index of the char matching blanked[openIdx] (openCh), scanning
  // forward with depth counting -- used everywhere below instead of a naive
  // `[^)]*` regex capture, which breaks the instant a param list contains
  // ANY nested parens before its true close (a default value calling a
  // function, a destructured call result, etc.). MEASURED: `[^)]*` matched
  // `Array.from({ length: 256 }, (_, i) => ...)`'s OUTER `Array.from(`
  // paren and stopped at the INNER `(_, i)`'s close (the first `)` it
  // could find), producing a garbled, unusable capture and silently
  // dropping `_`/`i` as locals -- root cause of `_` being the single
  // highest-count false positive in the full re-scan before this fix.
  function findMatchingClose(s, openIdx, openCh, closeCh) {
    let depth = 1, i = openIdx + 1;
    while (i < s.length && depth > 0) {
      if (s[i] === openCh) depth++;
      else if (s[i] === closeCh) depth--;
      if (depth > 0) i++;
    }
    return i;
  }

  // function/method param lists: `function name(...)`, `function(...)`
  const fnKwRe = /\bfunction\b(?:\s*[A-Za-z_$][\w$]*)?\s*\(/g;
  while ((m = fnKwRe.exec(blanked))) {
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = findMatchingClose(blanked, openIdx, '(', ')');
    for (const n of extractBindingListNames(blanked.slice(openIdx + 1, closeIdx))) names.add(n);
  }

  // arrow param lists: `(...) =>` (any nesting inside the parens) and
  // single-identifier `x =>`. Anchored on `=>` and scanned BACKWARD to the
  // matching open paren (or bare identifier), rather than forward from `(`,
  // for the same depth-correctness reason as findMatchingClose above.
  const arrowRe = /=>/g;
  while ((m = arrowRe.exec(blanked))) {
    let k = m.index - 1;
    while (k >= 0 && /\s/.test(blanked[k])) k--;
    if (k >= 0 && blanked[k] === ')') {
      let depth = 1, p = k - 1;
      while (p >= 0 && depth > 0) {
        if (blanked[p] === ')') depth++;
        else if (blanked[p] === '(') depth--;
        if (depth > 0) p--;
      }
      for (const n of extractBindingListNames(blanked.slice(p + 1, k))) names.add(n);
    } else if (k >= 0 && /[\w$]/.test(blanked[k])) {
      let start = k;
      while (start >= 0 && /[\w$]/.test(blanked[start])) start--;
      const name = blanked.slice(start + 1, k + 1);
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }

  // ES6 method-shorthand param lists: `name(params) {` inside an object or
  // class body (`download(manifest, filename) { ... }`) -- no `function`
  // keyword, so fnKwRe above never sees it. Recognized by: the token
  // immediately before it (skipping whitespace) is `{`, `,`, `;`, `}`, or
  // start of string -- i.e. "start of a new member" (a CLASS body has NO
  // separator between consecutive methods, just the previous method's
  // closing `}` -- MEASURED: `peek(){...} next(){...} expect(t){...}` in
  // tools/554-workbook-table-editor.html's `class Parser` had every method
  // AFTER THE FIRST missed, because `}` wasn't in the allowed preceding-char
  // set, misreading each method's own NAME as a call to an undeclared
  // function of the same name) -- and the name is not a control-flow
  // keyword (which has the identical `kw(...) {` shape).
  // MEASURED false-positive source before this fix: 01-a2a-fee-route-
  // optimizer.html's `download(manifest, filename) {` made `manifest` and
  // `filename` look like undeclared globals across every file using the
  // same object-literal-with-methods pattern (`toolId`, `toolSlug`, `sab`,
  // ... -- 129+ hits on some names before this was added).
  const CONTROL_KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'do', 'with']);
  const methodStartRe = /(?:^|[{,;}])\s*(?:async\s+)?(?:get\s+|set\s+|static\s+)*([A-Za-z_$][\w$]*)\s*\(/g;
  const methodDefNameOffsets = new Set();
  while ((m = methodStartRe.exec(blanked))) {
    if (CONTROL_KW.has(m[1])) continue;
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = findMatchingClose(blanked, openIdx, '(', ')');
    let k = closeIdx + 1;
    while (k < blanked.length && /\s/.test(blanked[k])) k++;
    if (blanked[k] !== '{') continue; // not a method def (e.g. a plain call)
    for (const n of extractBindingListNames(blanked.slice(openIdx + 1, closeIdx))) names.add(n);
    // Same match also tells us WHERE the method's own name sits -- needed
    // separately (see analyzeNeverDeclared) because the method-shorthand
    // NAME itself (`download` in `download(manifest, filename) {`) reads
    // identically to a call to an undeclared function `download(...)` to
    // the generic identifier-use scan below, which has no notion of
    // "this identifier position is a definition, not a use."
    const nameIdxInMatch = m[0].lastIndexOf(m[1]);
    if (nameIdxInMatch !== -1) methodDefNameOffsets.add(m.index + nameIdxInMatch);
  }

  // var/let/const declarator lists -- DEPTH-AWARE scan for the statement
  // end. A lazy `up to the next ;` regex breaks when the initializer itself
  // contains a nested statement with its own semicolon, e.g.
  // `var obs = new MutationObserver(function(){ var sab = ...; ... });` --
  // the FIRST `;` in the text is INSIDE the callback, so a naive lazy match
  // truncates the outer `obs` declarator at that inner semicolon and the
  // regex engine's next search resumes AFTER it, so the inner `var sab`
  // match point is consumed as part of the (wrongly-bounded) outer match
  // and never gets its own turn. MEASURED: this exact minified-IIFE shape
  // (`(function(){...var obs=new MutationObserver(function(){var sab=...;
  // ...});...})()`) recurs across ~40 OCG-§16-UI chaingraph pages and hid
  // `sab` as a real local in every one, producing 129 false-positive
  // "undeclared identifier" hits before this fix. Fix: track paren/bracket/
  // brace depth from just after the keyword and stop only at a `;` or
  // newline seen at depth 0 (or a `}`/`)`/`]` that would go negative --
  // i.e. the statement is closed by an enclosing scope, not by itself).
  const declKwRe = /\b(?:var|let|const)\s+/g;
  while ((m = declKwRe.exec(blanked))) {
    const declStart = declKwRe.lastIndex;
    let depth = 0, j = declStart;
    for (; j < blanked.length; j++) {
      const c = blanked[j];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
      else if ((c === ';' || c === '\n') && depth === 0) break;
    }
    // `for (const x of iterable)` / `for (const x in obj)` -- the binding
    // is followed by ` of `/` in ` instead of `=`. extractBindingListNames
    // only knows to stop a declarator at `=`; without this, the whole
    // "x of iterable" text is treated as one unparseable pattern and
    // SILENTLY DROPS the loop variable as a local. MEASURED: this exact
    // shape (`for (const k of Object.keys(v).sort())`, `for (const ti of
    // def.tamper)`, `for (const f of files)`) hid `k`/`ti`/`f` as reals
    // locals across 3 chaingraph files. Only apply when `of`/`in` appears
    // BEFORE any top-level `=` (an initializer can legitimately use the
    // `in` OPERATOR, e.g. `const has = 'x' in obj`, which must NOT be cut).
    let decl = blanked.slice(declStart, j);
    const eqIdx = decl.indexOf('=');
    const forSepM = /\b(?:of|in)\b/.exec(decl);
    if (forSepM && (eqIdx === -1 || forSepM.index < eqIdx)) decl = decl.slice(0, forSepM.index);
    for (const n of extractBindingListNames(decl)) names.add(n);
  }

  return { names, methodDefNameOffsets };
}

function usedInSpans(blanked, spans, localDecl) {
  const out = [];
  for (const [s, e] of spans) {
    const seg = blanked.slice(s, e);
    let m;
    IDENT_RE.lastIndex = 0;
    while ((m = IDENT_RE.exec(seg))) {
      const id = m[1];
      if (KEYWORDS.has(id)) continue;
      const before = seg.slice(Math.max(0, m.index - 1), m.index);
      if (before === '.') continue;
      // `typeof x` NEVER throws even when x is undeclared (it's the one
      // place the language lets you probe an unbound name safely) -- this
      // is the standard UMD-wrapper feature-detection idiom
      // (`typeof exports === 'object' ? ... : typeof define === 'function'
      // ? ... : ...`), pervasive in vendored bundled libraries on this
      // site (Chart.js-derived widgets etc.). Flagging it would report a
      // pattern that is safe by language semantics, not a hazard.
      const beforeWindow = seg.slice(Math.max(0, m.index - 10), m.index);
      if (/\btypeof\s*$/.test(beforeWindow)) continue;
      const afterIdx = m.index + id.length;
      const after = seg.slice(afterIdx, afterIdx + 4);
      if (/^\s*:/.test(after)) continue; // rough object-literal key skip
      if (localDecl.has(id)) continue;
      out.push({ id, at: s + m.index });
    }
  }
  return out;
}

function analyzeFile(file) {
  const html = fs.readFileSync(file, 'utf8');
  const blocks = extractInlineScripts(html);
  const perBlock = blocks.map((b) => {
    const blanked = blankNonCode(b.content);
    return {
      offset: b.offset,
      declared: declaredGlobals(b.content, blanked),
      spans: synchronousSpans(blanked),
      blanked,
    };
  });

  const findings = [];
  for (let i = 0; i < perBlock.length; i++) {
    const blk = perBlock[i];
    const uses = usedInSpans(blk.blanked, blk.spans, blk.declared);
    for (const use of uses) {
      let declaredEarlier = blk.declared.has(use.id);
      for (let k = 0; k < i && !declaredEarlier; k++) {
        if (perBlock[k].declared.has(use.id)) declaredEarlier = true;
      }
      if (declaredEarlier) continue;
      let laterBlockIdx = -1;
      for (let k = i + 1; k < perBlock.length; k++) {
        if (perBlock[k].declared.has(use.id)) { laterBlockIdx = k; break; }
      }
      if (laterBlockIdx === -1) continue;
      const line = lineOf(html, blk.offset + use.at);
      findings.push({
        file,
        identifier: use.id,
        usedInBlock: i,
        usedAtLine: line,
        declaredInBlock: laterBlockIdx,
      });
    }
  }
  return findings;
}

// --- A3 (SILENTSCAN-UNDECLARED-1 case b): synchronous use of an identifier
// with NO declaration anywhere in the file and not a known global. ---
function analyzeNeverDeclared(file) {
  const html = fs.readFileSync(file, 'utf8');
  const blocks = extractInlineScripts(html);

  // A page that loads any local <script src=...> could define globals this
  // scanner cannot see -- skip case (b) entirely for that file rather than
  // risk false positives (stated in the report per the row's allowlist
  // requirement: "the page's own <script src> imports" are treated as an
  // unknown-safe exemption, not silently ignored).
  if (/<script\b[^>]*\bsrc\s*=/i.test(html)) return { findings: [], skippedScriptSrc: true };

  const perBlock = blocks.map((b) => {
    const blanked = blankNonCode(b.content);
    const local = collectAllLocalNames(blanked);
    return {
      offset: b.offset,
      declaredTop: declaredGlobals(b.content, blanked),
      localNames: local.names,
      methodDefNameOffsets: local.methodDefNameOffsets,
      spans: synchronousSpans(blanked),
      blanked,
    };
  });

  const declaredAnywhere = new Set();
  for (const blk of perBlock) {
    for (const n of blk.declaredTop) declaredAnywhere.add(n);
    for (const n of blk.localNames) declaredAnywhere.add(n);
  }

  const findings = [];
  for (let i = 0; i < perBlock.length; i++) {
    const blk = perBlock[i];
    const uses = usedInSpans(blk.blanked, blk.spans, blk.localNames);
    for (const use of uses) {
      const id = use.id;
      if (KEYWORDS.has(id) || CASE_B_GLOBALS.has(id)) continue;
      if (declaredAnywhere.has(id)) continue;
      // Skip the identifier position that IS a method-shorthand definition
      // name (`download` in `download(manifest, filename) {`) -- it reads
      // like a call to an undeclared function `download(...)` but is a
      // property key, not a reference. See the comment in
      // collectAllLocalNames where methodDefNameOffsets is built.
      if (blk.methodDefNameOffsets.has(use.at)) continue;
      const line = lineOf(html, blk.offset + use.at);
      findings.push({ file, identifier: id, usedInBlock: i, usedAtLine: line });
    }
  }
  return { findings, skippedScriptSrc: false };
}

// --- A2: catch blocks writing to DOM without rethrow/console.error ---
function analyzeCatchDegrade(file) {
  const html = fs.readFileSync(file, 'utf8');
  const blocks = extractInlineScripts(html);
  const findings = [];
  for (const b of blocks) {
    const blanked = blankNonCode(b.content);
    // severity: is the catch itself on a path reached unconditionally at
    // load (inside this block's synchronous spans), or only reachable from
    // a function that is exclusively called by an event handler (i.e. NOT
    // in the synchronous spans)? Same span computation A1 uses.
    const syncSpans = synchronousSpans(blanked);
    const catchRe = /catch\s*\(([^)]*)\)\s*\{/g;
    let m;
    while ((m = catchRe.exec(blanked))) {
      const braceStart = blanked.indexOf('{', m.index + m[0].length - 1);
      if (braceStart === -1) continue;
      let d = 0, j = braceStart;
      for (; j < blanked.length; j++) {
        if (blanked[j] === '{') d++;
        else if (blanked[j] === '}') { d--; if (d === 0) break; }
      }
      const body = b.content.slice(braceStart, j + 1);
      const writesDOM = /\.(textContent|innerHTML|innerText)\s*=|\.setAttribute\s*\(|\.classList\.(add|remove)\s*\(/.test(body);
      const rethrowsOrLogs = /\bthrow\b/.test(body) || /console\.(error|warn)\s*\(/.test(body);
      if (writesDOM && !rethrowsOrLogs) {
        const line = lineOf(html, b.offset + braceStart);
        const onLoadPath = syncSpans.some(([a, e]) => m.index >= a && m.index < e);
        findings.push({ file, line, snippet: body.trim().slice(0, 160).replace(/\s+/g, ' '), severity: onLoadPath ? 'high-load-time' : 'lower-user-action' });
      }
    }
  }
  return findings;
}

function main() {
  const args = process.argv.slice(2);
  const dirs = args.filter((a) => !a.startsWith('--'));
  const jsonIdx = args.indexOf('--json');
  const jsonOut = jsonIdx !== -1 ? args[jsonIdx + 1] : null;

  if (!dirs.length) {
    console.error('usage: node scan-silent-fail.mjs <dir> [<dir> ...] [--json out.json]');
    process.exit(2);
  }

  let files = [];
  for (const d of dirs) files = files.concat(findHtmlFiles(d));
  files = [...new Set(files)].sort();

  const a1 = [];
  const a2 = [];
  const a3 = [];
  let a3SkippedScriptSrc = 0;
  for (const f of files) {
    try { a1.push(...analyzeFile(f)); } catch (e) { console.error('A1 scan error', f, e.message); }
    try { a2.push(...analyzeCatchDegrade(f)); } catch (e) { console.error('A2 scan error', f, e.message); }
    try {
      const r = analyzeNeverDeclared(f);
      a3.push(...r.findings);
      if (r.skippedScriptSrc) a3SkippedScriptSrc++;
    } catch (e) { console.error('A3 scan error', f, e.message); }
  }

  console.log(`files scanned: ${files.length}`);
  console.log(`A1 candidates (cross-block declaration-after-use): ${a1.length}`);
  console.log(`A2 candidates (catch writes DOM w/o rethrow/log): ${a2.length}`);
  console.log(`A3 candidates (never declared, not a known global): ${a3.length} (files skipped for <script src>: ${a3SkippedScriptSrc})`);

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ filesScanned: files.length, a1, a2, a3, a3SkippedScriptSrc }, null, 2));
    console.log('wrote', jsonOut);
  } else {
    for (const f of a1) console.log('A1', f.file, 'line', f.usedAtLine, 'identifier', f.identifier, 'block', f.usedInBlock, '-> declared block', f.declaredInBlock);
    for (const f of a3) console.log('A3', f.file, 'line', f.usedAtLine, 'identifier', f.identifier, 'block', f.usedInBlock);
  }
}

if (process.argv[1] && process.argv[1].endsWith('scan-silent-fail.mjs')) main();

export { analyzeFile, analyzeNeverDeclared, blankNonCode, synchronousSpans, declaredGlobals, collectAllLocalNames, extractBindingListNames, extractPatternNames, splitTopLevel, extractInlineScripts, braceDepths, structuralSyncSpans, collectAllFunctions, isNameCalledInSpans, funcNestDepths, isFunctionBrace };
