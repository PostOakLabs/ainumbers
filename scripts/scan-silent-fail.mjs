#!/usr/bin/env node
// SILENT-FAIL-AUDIT-1: static scanner for the CANON-ORDER-1 defect class.
// A1: cross-block declaration-after-use (identifier used synchronously in an
//     earlier inline <script> block, declared only in a later block).
// A2: catch blocks that write to the DOM without rethrow/console.error.
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
function blankNonCode(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let prevSignificant = '';
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const start = i;
      while (i < n && src[i] !== '\n') i++;
      out += ' '.repeat(i - start);
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(i + 2, n);
      out += (src.slice(start, i).replace(/[^\n]/g, ' '));
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      const start = i;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      i = Math.min(i + 1, n);
      out += src.slice(start, i).replace(/[^\n]/g, ' ');
      continue;
    }
    if (c === '/' && /[=([{,;:!&|?+\-*%^~<>]|^$|return|typeof/.test(prevSignificant.trim().slice(-6))) {
      const start = i;
      let j = i + 1;
      let inClass = false;
      let ok = false;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) { ok = true; j++; break; }
        else if (src[j] === '\n') break;
        j++;
      }
      if (ok) {
        i = j;
        while (i < n && /[a-z]/i.test(src[i])) i++;
        out += src.slice(start, i).replace(/[^\n]/g, ' ');
        continue;
      }
    }
    out += c;
    if (!/\s/.test(c)) prevSignificant += c;
    if (prevSignificant.length > 20) prevSignificant = prevSignificant.slice(-20);
    i++;
  }
  return out;
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

const IDENT_RE = /\b([A-Za-z_$][\w$]*)\b/g;

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
  for (const f of files) {
    try { a1.push(...analyzeFile(f)); } catch (e) { console.error('A1 scan error', f, e.message); }
    try { a2.push(...analyzeCatchDegrade(f)); } catch (e) { console.error('A2 scan error', f, e.message); }
  }

  console.log(`files scanned: ${files.length}`);
  console.log(`A1 candidates (cross-block declaration-after-use): ${a1.length}`);
  console.log(`A2 candidates (catch writes DOM w/o rethrow/log): ${a2.length}`);

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ filesScanned: files.length, a1, a2 }, null, 2));
    console.log('wrote', jsonOut);
  } else {
    for (const f of a1) console.log('A1', f.file, 'line', f.usedAtLine, 'identifier', f.identifier, 'block', f.usedInBlock, '-> declared block', f.declaredInBlock);
  }
}

if (process.argv[1] && process.argv[1].endsWith('scan-silent-fail.mjs')) main();

export { analyzeFile, blankNonCode, synchronousSpans, declaredGlobals, extractInlineScripts, braceDepths, structuralSyncSpans, collectAllFunctions, isNameCalledInSpans, funcNestDepths, isFunctionBrace };
