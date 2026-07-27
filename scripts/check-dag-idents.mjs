#!/usr/bin/env node
// check-dag-idents.mjs — hard gate for the ESCDAG defect class.
//
// Defect: a chain page's load-time `buildDag()` IIFE calls a helper (e.g. `esc`)
// that the page never defines, or defines only in a LATER <script> block.
// Classic-script function declarations hoist within their own block but not
// across block boundaries, so the IIFE throws a ReferenceError at load and the
// topology diagram renders as an empty box, with no console signal and no CI signal.
//
// Root cause this guards against: build-chain-pages.mjs has a build-time `esc()`
// in its own module scope, so `esc(` written inside the emitted template literal
// looks defined to the author while the emitted page has no such function.
//
// Predicate — for every chaingraph/chains/*.html containing a buildDag IIFE,
// every identifier CALLED inside that IIFE must be resolvable when it runs:
//   - declared inside the IIFE itself (local var / function / parameter), or
//   - declared in the SAME <script> block (function declarations hoist), or
//   - declared in an EARLIER <script> block, or
//   - a known JS/DOM builtin.
// Anything else is a hard fail.
//
// Usage: node scripts/check-dag-idents.mjs        (exit 1 on any violation)

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CHAINS = resolve(REPO, 'chaingraph', 'chains');

const BUILTINS = new Set([
  'Array', 'Boolean', 'Date', 'Error', 'Function', 'JSON', 'Map', 'Math', 'Number',
  'Object', 'Promise', 'RegExp', 'Set', 'String', 'Symbol', 'TextEncoder', 'TextDecoder',
  'URL', 'WeakMap', 'WeakSet', 'BigInt', 'Intl', 'Proxy', 'Reflect',
  'atob', 'btoa', 'decodeURIComponent', 'encodeURIComponent', 'decodeURI', 'encodeURI',
  'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'fetch', 'structuredClone',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'queueMicrotask',
  'requestAnimationFrame', 'alert', 'confirm', 'prompt',
  'document', 'window', 'console', 'navigator', 'location', 'crypto', 'performance',
  // control-flow / operator keywords that the call regex can brush against
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'new',
  'do', 'else', 'try', 'throw', 'await', 'yield', 'delete', 'void', 'in', 'of', 'case',
]);

/** [start,end) content spans of every <script> block. */
function scriptBlocks(src) {
  const out = [];
  const re = /<script\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1] || '';
    const type = /type\s*=\s*["']?([^"'\s>]+)/i.exec(attrs);
    // Only classic/module JS blocks execute as script; skip JSON-LD etc.
    if (type && !/^(text\/javascript|application\/javascript|module)$/i.test(type[1])) continue;
    const start = m.index + m[0].length;
    const end = src.indexOf('</script>', start);
    out.push([start, end < 0 ? src.length : end]);
  }
  return out;
}

/**
 * Blank out string/template literals, comments and regex literals, preserving
 * length and newlines so every index and line number stays exact. Without this,
 * SVG markup inside string literals (`'...url(#darr)...'`) reads as a call.
 */
function stripLiterals(text) {
  const out = text.split('');
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  // A `/` in these positions starts a regex literal, not a division.
  const REGEX_PRECEDER = /[(,=:[!&|?{};+\-*%~^<>]$/;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === c) break;
        j++;
      }
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      let j = text.indexOf('\n', i);
      if (j < 0) j = text.length;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      let j = text.indexOf('*/', i + 2);
      j = j < 0 ? text.length : j + 2;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/') {
      const before = text.slice(0, i).replace(/\s+$/, '');
      if (REGEX_PRECEDER.test(before)) {
        let j = i + 1;
        let inClass = false;
        while (j < text.length) {
          if (text[j] === '\\') { j += 2; continue; }
          if (text[j] === '[') inClass = true;
          else if (text[j] === ']') inClass = false;
          else if (text[j] === '/' && !inClass) break;
          else if (text[j] === '\n') break;
          j++;
        }
        blank(i + 1, j);
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return out.join('');
}

const blockIndexOf = (blocks, i) => blocks.findIndex(([a, b]) => i >= a && i < b);
const lineOf = (src, i) => src.slice(0, i).split('\n').length;

/** Body span of the buildDag IIFE, via brace matching from its opening brace. */
function buildDagSpan(src) {
  const m = /\(function buildDag\s*\([^)]*\)\s*\{/.exec(src);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return [m.index, open + 1, i];
    }
  }
  return null;
}

/** Declared names in a source span: function decls, var/let/const, and params. */
function declaredNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/(?<![A-Za-z0-9_$.])function\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of text.matchAll(/(?<![A-Za-z0-9_$.])(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  // additional declarators in `var a = 1, b = 2;`
  for (const m of text.matchAll(/(?<![A-Za-z0-9_$.])(?:var|let|const)\s+([^;\n]+)/g)) {
    for (const part of m[1].split(',')) {
      const n = /^\s*([A-Za-z_$][\w$]*)/.exec(part);
      if (n) names.add(n[1]);
    }
  }
  // function parameters (incl. anonymous/arrow callbacks) — locals, never a hazard
  for (const m of text.matchAll(/function\s*[A-Za-z_$][\w$]*?\s*\(([^)]*)\)|function\s*\(([^)]*)\)/g)) {
    for (const p of (m[1] || m[2] || '').split(',')) {
      const n = /^\s*\{?\s*([A-Za-z_$][\w$]*)/.exec(p);
      if (n) names.add(n[1]);
    }
  }
  for (const m of text.matchAll(/\(([^()]*)\)\s*=>/g)) {
    for (const p of m[1].split(',')) {
      const n = /^\s*([A-Za-z_$][\w$]*)/.exec(p);
      if (n) names.add(n[1]);
    }
  }
  return names;
}

const files = readdirSync(CHAINS).filter((f) => f.endsWith('.html')).sort();
const violations = [];
let scanned = 0;

for (const f of files) {
  const raw = readFileSync(join(CHAINS, f), 'utf8');
  const blocks = scriptBlocks(raw);
  // Strip literals/comments inside each <script> body only, preserving length and
  // line breaks, so indices and line numbers computed on `src` stay exact.
  let src = raw;
  for (const [a, b] of blocks) {
    src = src.slice(0, a) + stripLiterals(src.slice(a, b)) + src.slice(b);
  }
  const span = buildDagSpan(src);
  if (!span) continue;
  scanned++;
  const [iifeStart, bodyStart, bodyEnd] = span;
  const body = src.slice(bodyStart, bodyEnd);
  const myBlock = blockIndexOf(blocks, iifeStart);

  const local = declaredNames(body);

  // Names resolvable at buildDag execution time.
  const visible = new Set();
  blocks.forEach(([a, b], idx) => {
    if (idx > myBlock) return;                    // later block: not yet parsed
    const text = src.slice(a, b);
    if (idx === myBlock) {
      // same block: function declarations hoist regardless of position
      for (const m of text.matchAll(/(?<![A-Za-z0-9_$.])function\s+([A-Za-z_$][\w$]*)/g)) visible.add(m[1]);
      // var/let/const only count if they precede the IIFE
      const before = src.slice(a, iifeStart);
      for (const n of declaredNames(before)) visible.add(n);
    } else {
      for (const n of declaredNames(text)) visible.add(n);
    }
  });

  const seen = new Set();
  for (const m of body.matchAll(/(?<![A-Za-z0-9_$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    if (BUILTINS.has(name) || local.has(name) || visible.has(name)) continue;
    violations.push({
      file: f,
      name,
      line: lineOf(src, bodyStart + m.index),
      note: new RegExp(`(?<![A-Za-z0-9_$.])(?:function\\s+${name}\\b|(?:var|let|const)\\s+${name}\\b)`).test(src)
        ? 'declared in a LATER <script> block (does not hoist across blocks)'
        : 'never declared anywhere in the page',
    });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ scanned, violations }, null, 2));
  process.exit(violations.length ? 1 : 0);
}

if (violations.length) {
  console.error(`check-dag-idents: FAIL — ${violations.length} unresolvable identifier(s) called inside buildDag across ${new Set(violations.map((v) => v.file)).size} file(s) (of ${scanned} buildDag pages scanned)\n`);
  for (const v of violations.slice(0, 40)) {
    console.error(`  chaingraph/chains/${v.file}:${v.line}  ${v.name}()  — ${v.note}`);
  }
  if (violations.length > 40) console.error(`  ... and ${violations.length - 40} more`);
  console.error('\nbuildDag runs at page load; an unresolvable call throws a ReferenceError and the');
  console.error('DAG renders as an empty box. Declare the helper in the same <script> block, ahead');
  console.error('of the IIFE, and fix chaingraph/chains/build-chain-pages.mjs so it emits it.');
  process.exit(1);
}

console.log(`check-dag-idents: OK — ${scanned} buildDag page(s), all called identifiers resolvable at load`);
