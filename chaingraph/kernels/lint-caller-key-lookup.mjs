// @ts-nocheck: plain CLI utility script, never meant to be type-checked; it lives under
// chaingraph/kernels/ so tsc --checkJs sweeps it, same as lint-forbidden-hash.mjs.
// lint-caller-key-lookup.mjs: KERNEL-CALLER-KEY-LOOKUP-LINT-1.
//
// Three review escapes shipped through merged kernels because a caller-supplied value was used
// as a KEY into a plain object, or was coerced to a string before a type check:
//   A  computed member access TABLE[expr] (or TABLE.sub[expr]) on a plain object literal, or a
//      WRITE X[expr] = v on any object, where expr is not provably constant and no own-key guard
//      (Object.hasOwn / hasOwnProperty.call with the same object and key) precedes it in the same
//      function. "constructor", "__proto__" and "toString" resolve through the prototype chain.
//   B  enum validation by truthiness: if (!TABLE[value]) / TABLE[value] ? ... / TABLE[value] && ...
//      (or a variable assigned from the lookup and then tested for truthiness) with no guard.
//   C  a string helper that coerces with String(v) or '' + v before an emptiness test (.trim(),
//      === '', .length) without a typeof v === 'string' check, so false, {} and ["x"] pass as text.
//
// Key taint follows local bindings. A key is constant (clean) when it is a literal, a member of a
// const object literal, an element of a const array literal picked by a constant or loop index,
// a loop variable over a const array or Object.keys of a const object, or any local initialised
// only from such values. Everything else (pp.x, a local assigned from pp.x, Object.keys of a
// caller value, a parameter) is caller-derived. In a nested lookup X.y[expr] the key must be a
// literal or a const-object member (an array element does not count).
//
// The scan is a zero-dependency source heuristic over the whole kernel file (helpers outside
// compute() are in scope because compute() calls them). Comments are blanked and string
// contents are masked before matching (template ${} expressions stay visible), so prose and
// literals never trip a pattern.
//
// Policy: existing kernels are ADVISORY against scripts/caller-key-lookup-baseline.json (counts
// only go down; a count above baseline prints a WARN, exit 0). A kernel with no baseline entry
// (a newly added kernel) is BLOCKING on any hit. The baseline is never edited by a PR that adds
// a kernel; it is rewritten only with --write-baseline, by a row that burns debt down.
//
// Usage:
//   node chaingraph/kernels/lint-caller-key-lookup.mjs              fleet scan vs baseline
//   node chaingraph/kernels/lint-caller-key-lookup.mjs --only <id>  one kernel (kernel-preflight)
//   node chaingraph/kernels/lint-caller-key-lookup.mjs --self-test  red and green case per pattern
//   node chaingraph/kernels/lint-caller-key-lookup.mjs --write-baseline

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const KERNELS_DIR = HERE;
const BASELINE_PATH = resolve(REPO, 'scripts', 'caller-key-lookup-baseline.json');
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

// Blank comments and mask string/template contents, preserving offsets and newlines.
// Returns { code } (comments blanked, strings intact) and { masked } (strings also masked).
// Template literal text is masked, but the code inside ${ } is kept as code.
function prepare(src) {
  let code = '';
  let masked = '';
  const n = src.length;
  let i = 0;
  const push = (c, m) => { code += c; masked += m; };
  const tpl = []; // open-brace depth for each ${ } currently being scanned as code
  const tplBody = () => {
    while (i < n && src[i] !== '`') {
      if (src[i] === '$' && src[i + 1] === '{') { push('$', '$'); push('{', '{'); i += 2; tpl.push(0); return; }
      if (src[i] === '\\' && i + 1 < n) { push(src[i], 'x'); i++; }
      const ch = src[i];
      push(ch, ch === '\n' ? '\n' : 'x');
      i++;
    }
    if (i < n) { push('`', '`'); i++; }
  };
  while (i < n) {
    const c = src[i];
    if (tpl.length) {
      if (c === '{') tpl[tpl.length - 1]++;
      else if (c === '}') {
        if (tpl[tpl.length - 1] === 0) { tpl.pop(); push('}', '}'); i++; tplBody(); continue; }
        tpl[tpl.length - 1]--;
      }
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { push(' ', ' '); i++; }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        const keep = src[i] === '\n' ? '\n' : ' ';
        push(keep, keep); i++;
      }
      if (i < n) { push(' ', ' '); push(' ', ' '); i += 2; }
      continue;
    }
    if (c === '`') { push(c, c); i++; tplBody(); continue; }
    if (c === '\'' || c === '"') {
      const q = c;
      push(c, c); i++;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\' && i + 1 < n) { push(src[i], 'x'); i++; }
        const ch = src[i];
        push(ch, ch === '\n' ? '\n' : 'x');
        i++;
      }
      if (i < n) { push(q, q); i++; }
      continue;
    }
    push(c, c); i++;
  }
  return { code, masked };
}

const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;
const escRe = (s) => s.replace(/[$]/g, '\\$');
const IDENT = '[A-Za-z_$][\\w$]*';

// Index of the bracket closing the one at s[open], or -1.
function matchClose(s, open) {
  let d = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) return i; }
  }
  return -1;
}

// End (exclusive) of the expression starting at s[start]: stops at a depth-0 ; , newline or a
// closing bracket that belongs to an outer construct.
function exprEnd(s, start) {
  let i = start;
  while (i < s.length && /\s/.test(s[i])) i++;
  let d = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') { if (d === 0) return i; d--; }
    else if (d === 0 && (c === ';' || c === ',' || c === '\n')) return i;
  }
  return s.length;
}

// Split e at depth-0 occurrences of op (a string such as '||', '+', ':').
function splitTop(e, op) {
  const parts = [];
  let d = 0; let last = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') d--;
    else if (d === 0 && e.startsWith(op, i)) {
      if (op === '+' && (e[i + 1] === '+' || e[i - 1] === '+' || e[i + 1] === '=')) continue;
      if (op === '?' && (e[i + 1] === '?' || e[i + 1] === '.' || e[i - 1] === '?')) continue;
      parts.push(e.slice(last, i)); i += op.length - 1; last = i + 1;
    }
  }
  parts.push(e.slice(last));
  return parts;
}

// Parse IDENT(.IDENT | [expr])* ; null for anything with a call or other syntax.
function parseChain(e) {
  const m = new RegExp(`^(${IDENT})`).exec(e);
  if (!m) return null;
  let i = m[0].length;
  const segs = [];
  while (i < e.length) {
    while (i < e.length && /\s/.test(e[i])) i++;
    if (i >= e.length) break;
    if (e[i] === '.') {
      const mm = new RegExp(`^\\.\\s*${IDENT}`).exec(e.slice(i));
      if (!mm) return null;
      segs.push({ type: 'dot' }); i += mm[0].length;
    } else if (e[i] === '[') {
      const j = matchClose(e, i);
      if (j < 0) return null;
      segs.push({ type: 'idx', expr: e.slice(i + 1, j) }); i = j + 1;
    } else return null;
  }
  return { root: m[1], segs };
}

const LOOP_VARS = new Set(['i', 'j', 'k', 'n', 'm', 'idx', 'index', 'ix', 'len']);
const FILE_SCOPE = { start: 0, end: Infinity };

// Index every function (declaration, expression, arrow) with its params, body range and name.
function findFunctions(masked) {
  const fns = [];
  const add = (name, start, bodyStart, end, params) => {
    const paramNames = params.split(',').map((p) => p.trim().replace(/=.*$/s, '').trim()).filter((p) => new RegExp(`^${IDENT}$`).test(p));
    fns.push({ name, start, bodyStart, end, paramNames });
  };
  let m;
  const fre = new RegExp(`\\bfunction\\b\\s*\\*?\\s*(${IDENT})?\\s*\\(`, 'g');
  while ((m = fre.exec(masked))) {
    const open = m.index + m[0].length - 1;
    const close = matchClose(masked, open);
    if (close < 0) continue;
    let a = close + 1;
    while (a < masked.length && /\s/.test(masked[a])) a++;
    if (masked[a] !== '{') continue;
    const end = matchClose(masked, a);
    if (end < 0) continue;
    add(m[1] || '<fn>', m.index, a, end, masked.slice(open + 1, close));
  }
  const are = /=>/g;
  while ((m = are.exec(masked))) {
    let j = m.index - 1;
    while (j >= 0 && /\s/.test(masked[j])) j--;
    let start; let params;
    if (masked[j] === ')') {
      let d = 0; let o = j;
      for (; o >= 0; o--) { if (masked[o] === ')') d++; else if (masked[o] === '(') { d--; if (d === 0) break; } }
      if (o < 0) continue;
      start = o; params = masked.slice(o + 1, j);
    } else {
      const im = new RegExp(`(${IDENT})$`).exec(masked.slice(0, j + 1));
      if (!im) continue;
      start = j + 1 - im[1].length; params = im[1];
    }
    let a = m.index + 2;
    while (a < masked.length && /\s/.test(masked[a])) a++;
    const end = masked[a] === '{' ? matchClose(masked, a) : exprEnd(masked, a);
    if (end < 0) continue;
    const nm = new RegExp(`(?:const|let|var)\\s+(${IDENT})\\s*=\\s*(?:async\\s*)?$`).exec(masked.slice(Math.max(0, start - 80), start));
    add(nm ? nm[1] : '<arrow>', start, a, end, params);
  }
  return fns;
}

// Own-key guards: Object.hasOwn(BASE, KEY), hasOwnProperty.call(BASE, KEY), BASE.hasOwnProperty(KEY).
function findGuards(masked) {
  const guards = [];
  const res = [
    /Object\.hasOwn\(\s*([\w$.]+)\s*,\s*([^)]*)\)/g,
    /hasOwnProperty\.call\(\s*([\w$.]+)\s*,\s*([^)]*)\)/g,
    /([\w$.]+)\.hasOwnProperty\(\s*([^)]*)\)/g,
  ];
  for (const re of res) {
    let m;
    while ((m = re.exec(masked))) guards.push({ base: m[1], key: m[2].replace(/\s+/g, ''), pos: m.index });
  }
  return guards;
}

export function findCallerKeyLookups(src) {
  const { code, masked } = prepare(src);
  const hits = [];
  const fns = findFunctions(masked);
  const innermost = (pos) => {
    let best = FILE_SCOPE;
    for (const f of fns) if (f.start <= pos && pos <= f.end && (best === FILE_SCOPE || f.end - f.start < best.end - best.start)) best = f;
    return best;
  };

  // Names bound to a plain object literal, and names that are safe containers.
  const objs = new Set();
  const safeBases = new Set();
  let m;
  const ore = new RegExp(`\\b(?:const|let|var)\\s+(${IDENT})\\s*=\\s*(?:Object\\.freeze\\(\\s*)?\\{`, 'g');
  while ((m = ore.exec(masked))) objs.add(m[1]);
  const sre = new RegExp(`\\b(?:const|let|var)\\s+(${IDENT})\\s*=\\s*(?:Object\\.create\\(\\s*null\\s*\\)|new\\s+(?:Map|Set|WeakMap|WeakSet)\\b)`, 'g');
  while ((m = sre.exec(masked))) safeBases.add(m[1]);

  // Declarations: const/let/var initialisers, for-of/in loop variables, parameters.
  const decls = [];
  const dre = new RegExp(`\\b(const|let|var)\\s+(${IDENT})\\s*=(?!=)\\s*`, 'g');
  while ((m = dre.exec(masked))) {
    const at = m.index + m[0].length;
    decls.push({ name: m[2], pos: m.index, kind: 'init', kw: m[1], counter: /\bfor\s*\(\s*$/.test(masked.slice(Math.max(0, m.index - 12), m.index)), init: masked.slice(at, exprEnd(masked, at)), scope: innermost(m.index), nameIdx: m.index + m[0].indexOf(m[2], m[1].length) });
  }
  // Bare declarations (var a, b;) are judged by the values later assigned to them.
  const bre = new RegExp(`\\b(let|var)\\s+(${IDENT}(?:\\s*,\\s*${IDENT})*)\\s*;`, 'g');
  while ((m = bre.exec(masked))) {
    for (const nm of m[2].split(',')) decls.push({ name: nm.trim(), pos: m.index, kind: 'init', kw: m[1], init: 'undefined', scope: innermost(m.index), nameIdx: -1 });
  }
  const fore = new RegExp(`\\bfor\\s*\\(\\s*(?:const|let|var)\\s+(?:(${IDENT})|\\[\\s*(${IDENT})\\s*,\\s*(${IDENT})\\s*\\])\\s+(of|in)\\s+`, 'g');
  while ((m = fore.exec(masked))) {
    const at = m.index + m[0].length;
    const iter = masked.slice(at, exprEnd(masked, at));
    for (const nm of [m[1], m[2], m[3]]) if (nm) decls.push({ name: nm, pos: m.index, kind: m[4] === 'of' ? 'forof' : 'forin', iter, scope: innermost(m.index) });
  }
  for (const f of fns) for (const p of f.paramNames) decls.push({ name: p, pos: f.start, kind: 'param', scope: f });
  const resolve_ = (name, pos) => {
    let best = null;
    for (const d of decls) {
      if (d.name !== name || d.pos > pos || pos < d.scope.start || pos > d.scope.end) continue;
      if (!best || d.pos >= best.pos) best = d;
    }
    return best;
  };

  const isConstContainer = (name, pos, depth) => {
    const d = resolve_(name, pos);
    if (!d || d.kind !== 'init' || depth > 8) return false;
    const init = d.init.trim();
    if (/^(?:Object\.freeze\(\s*)?\{\s*[^\s}]/.test(init) || /^\[\s*[^\s\]]/.test(init)) return true;
    if (/^Object\.(?:keys|values|entries)\(/.test(init)) return isConstIter(init, d.pos, depth + 1);
    const ch = parseChain(init);
    return !!ch && ch.segs.length > 0 && ch.segs.every((s) => s.type === 'dot') && isConstContainer(ch.root, d.pos, depth + 1);
  };
  const isConstIter = (expr, pos, depth) => {
    const e = expr.trim();
    if (depth > 8 || !e) return false;
    if (e[0] === '[' && matchClose(e, 0) === e.length - 1) return splitTop(e.slice(1, -1), ',').every((p) => !p.trim() || isConst(p, pos, depth + 1));
    const km = new RegExp(`^Object\\.(?:keys|values|entries)\\(\\s*(.+)\\)$`, 's').exec(e);
    if (km) {
      const ch = parseChain(km[1].trim());
      return !!ch && ch.segs.every((s) => s.type === 'dot') && isConstContainer(ch.root, pos, depth + 1);
    }
    const ch = parseChain(e);
    if (ch && !ch.segs.length) {
      const d = resolve_(ch.root, pos);
      return !!d && d.kind === 'init' && isConstIter(d.init, d.pos, depth + 1);
    }
    return false;
  };
  const isConstName = (name, pos, depth) => {
    const d = resolve_(name, pos);
    if (!d || d.kind === 'param') return LOOP_VARS.has(name);
    if (d.kind === 'forof') return isConstIter(d.iter, d.pos, depth + 1);
    if (d.kind === 'forin') { const ch = parseChain(d.iter.trim()); return !!ch && ch.segs.every((s) => s.type === 'dot') && isConstContainer(ch.root, d.pos, depth + 1); }
    if (d.kw !== 'const' && (d.counter || new RegExp(`(?<![\\w$.])(?:${escRe(name)}\\s*(?:\\+\\+|--|-=)|(?:\\+\\+|--)\\s*${escRe(name)}(?![\\w$]))`).test(masked.slice(d.scope.start, d.scope.end === Infinity ? masked.length : d.scope.end)))) return true;
    if (!isConst(d.init, d.pos, depth + 1)) return false;
    if (d.kw !== 'const') {
      const rre = new RegExp(`(?<![\\w$.])${escRe(name)}\\s*(?:[+\\-*/%|&^]|\\*\\*|\\?\\?|\\|\\||&&)?=(?!=)\\s*`, 'g');
      let r;
      while ((r = rre.exec(masked))) {
        if (r.index === d.nameIdx || r.index < d.scope.start || r.index > d.scope.end) continue;
        const rhs = masked.slice(r.index + r[0].length, exprEnd(masked, r.index + r[0].length));
        if (/^[+\-*/%|&^]|^\*\*/.test(r[0].slice(name.length).trim())) continue; // numeric accumulator
        if (!isConst(rhs, r.index, depth + 1)) return false;
      }
    }
    return true;
  };
  // strict: inside a nested lookup X.y[expr] an array element never counts as constant.
  const isConst = (expr, pos, depth = 0, strict = false) => {
    if (depth > 8) return false;
    let e = expr.trim();
    while (e[0] === '(' && matchClose(e, 0) === e.length - 1) e = e.slice(1, -1).trim();
    if (!e) return false;
    if (/^(['"`])x*\1$/.test(e)) return true;
    if (/^-?\d[\w.]*$/.test(e) || /^(true|false|null|undefined)$/.test(e)) return true;
    if (/\+\+|--/.test(e)) return true; // pos++ style cursor: numeric
    if (/^[\d\s+\-*/%()]+$/.test(e)) return true;
    // A numeric result (arithmetic, Math.*, .length) can never name a prototype key.
    if (/^(?:Math\.\w+|Number|parseInt|parseFloat)\(/.test(e) || /\.length$/.test(e)) return true;
    if (/[^\s+\-*/%|&^<>]\s*(?:[-*/%]|<<|>>>?|[|&^])\s*[^\s=]/.test(splitTop(e, '?').length > 1 ? '' : e.replace(/\[[^\]]*\]|\([^)]*\)/g, 'x'))) return true;
    const q = splitTop(e, '?');
    if (q.length > 1) {
      const rest = q.slice(1).join('?');
      const c = splitTop(rest, ':');
      return c.length === 2 && isConst(c[0], pos, depth + 1, strict) && isConst(c[1], pos, depth + 1, strict);
    }
    for (const op of ['||', '??', '&&', '+']) {
      const parts = splitTop(e, op);
      if (parts.length > 1) return parts.every((p) => isConst(p, pos, depth + 1, strict));
    }
    const ch = parseChain(e);
    if (!ch) return false;
    if (!ch.segs.length) return isConstName(ch.root, pos, depth);
    if (!isConstContainer(ch.root, pos, depth)) return false;
    return ch.segs.every((s) => s.type === 'dot' || (!(strict && !/^(['"]x*['"]|\d+)$/.test(s.expr.trim())) && isConst(s.expr, pos, depth + 1)));
  };

  // A and B: computed access on a plain-object literal (reads) or any object (writes).
  const guards = findGuards(masked);
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== '[' || !/[\w$]/.test(masked[i - 1] || '')) continue;
    let bs = i;
    while (bs > 0 && /[\w$.]/.test(masked[bs - 1])) bs--;
    const base = masked.slice(bs, i);
    if (!base || /^[\d.]/.test(base) || base.startsWith('.') || /^(?:return|typeof|in|of|case|new|delete|void|yield|await)$/.test(base)) continue;
    const close = matchClose(masked, i);
    if (close < 0) continue;
    const keyExpr = masked.slice(i + 1, close);
    const after = masked.slice(close + 1, masked.indexOf('\n', close) < 0 ? masked.length : masked.indexOf('\n', close));
    const isWrite = /^\s*(?:(?:[+\-*/%&|^]|\*\*|\?\?|\|\||&&|<<|>>>?)?=(?!=)|\+\+|--)/.test(after);
    const root = base.split('.')[0];
    const nested = base.includes('.');
    if (safeBases.has(root) || root === 'this') continue;
    // Reads: a plain-literal root, or a nested X.y[ks[i]] (a key picked from an enumerated list).
    if (!isWrite && !objs.has(root) && !(nested && /^[\w$]+\s*\[[^\]]*\]\s*$/.test(keyExpr.trim()))) continue;
    if (!keyExpr.trim() || isConst(keyExpr, i, 0, nested)) continue;
    const keyNorm = keyExpr.replace(/\s+/g, '');
    const fn = innermost(i);
    if (guards.some((g) => g.base === base && g.key === keyNorm && g.pos < i && innermost(g.pos).start <= fn.start && innermost(g.pos).end >= fn.end)) continue;
    const line = lineOf(masked, i);
    const token = `${base}[${keyExpr.trim()}]`;
    if (isWrite) {
      hits.push({ pattern: 'A', line, token, note: 'caller-derived key written into an object without an own-key guard' });
      continue;
    }
    const lineStart = masked.lastIndexOf('\n', bs - 1) + 1;
    const before = masked.slice(lineStart, bs);
    let truthy = /!\s*$/.test(before) || /^\s*(\?|&&|\|\|)/.test(after) || /(\bif|\bwhile|&&|\|\|)\s*\(?\s*$/.test(before);
    if (!truthy) {
      const vm = new RegExp(`(?:const|let|var)\\s+(${IDENT})\\s*=\\s*$`).exec(masked.slice(Math.max(0, bs - 80), bs));
      if (vm) {
        const ve = escRe(vm[1]);
        const rest = masked.slice(close + 1, Math.min(fn.end, masked.length));
        truthy = new RegExp(`!\\s*${ve}\\b|\\b(?:if|while)\\s*\\(\\s*${ve}\\s*[)&|?]|(?<![\\w$.])${ve}\\s*(?:\\?(?![.?])|&&|\\|\\|)`).test(rest);
      }
    }
    if (truthy) hits.push({ pattern: 'B', line, token, note: 'enum validated by truthiness of a plain-object lookup' });
    else hits.push({ pattern: 'A', line, token, note: 'caller-derived key into an unguarded plain object' });
  }

  // C: string helper coercing with String(param) or '' + param before an emptiness test, no typeof check.
  for (const f of fns) {
    const bodyM = masked.slice(f.bodyStart, f.end + 1);
    const bodyC = code.slice(f.bodyStart, f.end + 1);
    for (const p of f.paramNames) {
      const pe = escRe(p);
      const coerce = `(?:String\\(\\s*${pe}\\s*\\)|(?:''|"")\\s*\\+\\s*${pe}(?![\\w$])|(?<![\\w$])${pe}\\s*\\+\\s*(?:''|""))`;
      const emptyTail = `\\)?\\s*(?:\\.\\s*trim\\(\\)|\\.\\s*length\\b|[!=]==?\\s*(?:''|""))`;
      let coerced = new RegExp(`${coerce}${emptyTail}`).test(bodyM);
      if (!coerced) {
        const are = new RegExp(`\\b(?:const|let|var)\\s+(${IDENT})\\s*=\\s*${coerce}`, 'g');
        let a;
        while (!coerced && (a = are.exec(bodyM))) {
          const al = escRe(a[1]);
          coerced = new RegExp(`(?<![\\w$.])${al}\\s*(?:\\.\\s*trim\\(\\)|\\.\\s*length\\b|[!=]==?\\s*(?:''|""))`).test(bodyM.slice(a.index + a[0].length));
        }
      }
      const typed = new RegExp(`typeof\\s+${pe}\\s*(?:===|!==|==|!=)\\s*['"]string['"]`).test(bodyC);
      if (coerced && !typed) {
        hits.push({ pattern: 'C', line: lineOf(masked, f.start), token: `${f.name}(${p})`, note: 'string coercion before emptiness test without typeof check' });
      }
    }
  }
  return hits.sort((a, b) => a.line - b.line);
}

const countBy = (hits) => {
  const c = { A: 0, B: 0, C: 0 };
  for (const h of hits) c[h.pattern]++;
  return c;
};
const total = (c) => c.A + c.B + c.C;

// ---- self-test: red and green cases (GATE-SELFTEST-META-1). A red case must raise its pattern;
// a green case must raise nothing at all. ----
const CASES = [
  { name: 'A red: unguarded TABLE[caller key]', pattern: 'A', red: true,
    src: "const FUND_FROM = { reserve: 1 };\nfunction compute(pp) { const f = FUND_FROM[pp.funded_from]; return f; }\n" },
  { name: 'A green: guarded by Object.hasOwn', pattern: 'A', red: false,
    src: "const FUND_FROM = { reserve: 1 };\nfunction compute(pp) { const f = Object.hasOwn(FUND_FROM, pp.k) ? FUND_FROM[pp.k] : null; return f; }\n" },
  { name: 'A green: Map and Object.create(null) are not plain literals', pattern: 'A', red: false,
    src: "const T = new Map([['a', 1]]);\nconst U = Object.create(null);\nfunction compute(pp) { U[pp.k] = 1; return [T.get(pp.k), U[pp.k]]; }\n" },
  { name: 'B red: enum check by truthiness', pattern: 'B', red: true,
    src: "const ALLOWED = { yes: true, no: true };\nfunction compute(pp) { if (!ALLOWED[pp.answer]) return null; return 1; }\n" },
  { name: 'B green: own-key test on the same line', pattern: 'B', red: false,
    src: "const ALLOWED = { yes: true, no: true };\nfunction compute(pp) { if (!Object.hasOwn(ALLOWED, pp.answer) || !ALLOWED[pp.answer]) return null; return 1; }\n" },
  { name: 'C red: String(v) before trim test, no typeof', pattern: 'C', red: true,
    src: "function str(v) { const s = String(v); return s.trim() === '' ? null : s; }\n" },
  { name: 'C green: typeof string check first', pattern: 'C', red: false,
    src: "function str(v) { if (typeof v !== 'string') return null; const s = String(v); return s.trim() === '' ? null : s; }\n" },
  { name: 'comment and string mentions never trip', pattern: 'A', red: false,
    src: "const T = { a: 1 };\n// T[pp.x] in a comment\nconst s = 'T[pp.x]';\nfunction compute(pp) { return T.a; }\n" },
  { name: 'FN1 red: key aliased from pp through a local', pattern: 'A', red: true,
    src: "const TABLE = { a: 1 };\nfunction compute(pp) { const kind = pp.kind; const v = TABLE[kind]; return v; }\n" },
  { name: 'FN2 red: nested DEF.props[ks[i]] with ks from Object.keys of caller body', pattern: 'A', red: true,
    src: "const DEF = { props: { a: 1 } };\nfunction compute(pp) { const ks = Object.keys(pp.body); const out = []; for (let i = 0; i < ks.length; i++) out.push(DEF.props[ks[i]]); return out; }\n" },
  { name: 'FP1 green: write with a constant loop key', pattern: 'A', red: false,
    src: "const FIELDS = ['a', 'b'];\nfunction compute(pp) { const days = {}; for (const f of FIELDS) days[f] = pp[f]; return days; }\n" },
  { name: 'FP2 green: keys from the kernel own constants', pattern: 'A', red: false,
    src: "const FORMAT = { a: 1 };\nconst SPEC = { fmt: 'a' };\nconst TYPE_NAMES = ['a', 'b'];\nconst TYPES = { a: 1, b: 2 };\nfunction compute(pp) { const fmt = SPEC.fmt; let t = 0; for (let i = 0; i < TYPE_NAMES.length; i++) t += TYPES[TYPE_NAMES[i]]; return FORMAT[fmt] + t; }\n" },
  { name: 'A green: guard on the previous line, truthiness on the next', pattern: 'B', red: false,
    src: "const T = { a: 1 };\nfunction compute(pp) {\n  if (!Object.hasOwn(T, pp.k)) return null;\n  if (!T[pp.k]) return null;\n  return 1;\n}\n" },
  { name: 'A green: T[KEYS.a] is a constant member key', pattern: 'A', red: false,
    src: "const T = { x: 1 };\nconst KEYS = { a: 'x' };\nfunction compute(pp) { return T[KEYS.a]; }\n" },
  { name: 'A green: T[KEYS[i]] is a const array picked by loop index', pattern: 'A', red: false,
    src: "const KEYS = ['a', 'b'];\nconst T = { a: 1 };\nfunction compute(pp) { for (let i = 0; i < KEYS.length; i++) { const v = T[KEYS[i]]; if (v) return v; } return null; }\n" },
  { name: 'C green: trim is on another variable', pattern: 'C', red: false,
    src: "function f(v, w) { const s = String(v); return w.trim() === '' ? null : s; }\n" },
  { name: 'B red: lookup kept in a variable, guard comes after', pattern: 'B', red: true,
    src: "const ALLOWED = { yes: true };\nfunction compute(pp) { const ok = ALLOWED[pp.x]; if (!Object.hasOwn(ALLOWED, pp.x)) return null; if (!ok) return null; return 1; }\n" },
  { name: 'C red: concise arrow body', pattern: 'C', red: true,
    src: "const norm = (v) => String(v).trim() === '' ? null : String(v);\n" },
  { name: "C red: '' + v coercion", pattern: 'C', red: true,
    src: "function f(v) { const s = '' + v; return s.trim() === '' ? null : s; }\n" },
  { name: 'A red: lookup inside a template interpolation', pattern: 'A', red: true,
    src: "const T = { a: 1 };\nfunction compute(pp) { return `${T[pp.k]}`; }\n" },
  { name: 'A red: a guard in another function does not cover this one', pattern: 'A', red: true,
    src: "const T = { a: 1 };\nfunction a(pp) { if (Object.hasOwn(T, pp.x)) return T[pp.x]; return null; }\nfunction b(pp) { return T[pp.y]; }\n" },
  { name: 'A red: alias named k from pp', pattern: 'A', red: true,
    src: "const T = { a: 1 };\nfunction compute(pp) { const k = pp.x; return T[k]; }\n" },
  { name: 'A red: nested TABLES.t1[pp.k]', pattern: 'A', red: true,
    src: "const TABLES = { t1: { a: 1 } };\nfunction compute(pp) { return TABLES.t1[pp.k]; }\n" },
  { name: 'A red: nested A.b[ks[i]] with an array element key', pattern: 'A', red: true,
    src: "const A = { b: { a: 1 } };\nconst ks = ['a', 'b'];\nfunction compute(pp) { for (let i = 0; i < ks.length; i++) return A.b[ks[i]]; return null; }\n" },
  { name: 'A red: write X[pp.k] = v on a plain literal', pattern: 'A', red: true,
    src: "const X = {};\nfunction compute(pp) { X[pp.k] = pp.v; return X; }\n" },
  { name: 'A red: write out[pp.k] = v on a parameter object', pattern: 'A', red: true,
    src: "function compute(pp, out) { out[pp.k] = pp.v; return out; }\n" },
  { name: 'A red: caller index into a const array', pattern: 'A', red: true,
    src: "const KEYS = ['a', '__proto__'];\nconst T = { a: 1 };\nfunction compute(pp) { return T[KEYS[pp.i]]; }\n" },
  { name: 'A red: alias through a const array element', pattern: 'A', red: true,
    src: "const KEYS = ['a', 'b'];\nconst T = { a: 1 };\nfunction compute(pp) { const k = KEYS[pp.i]; return T[k]; }\n" },
];

export function runSelfTest() {
  let bad = 0;
  for (const c of CASES) {
    const all = findCallerKeyLookups(c.src);
    const got = c.red ? all.filter((h) => h.pattern === c.pattern).length : all.length;
    const ok = c.red ? got > 0 : got === 0;
    console.log(`${ok ? '✓' : '✗'} ${c.name}${ok ? '' : ` (hits=${got})`}`);
    if (!ok) bad++;
  }
  return bad;
}

function scanFleet() {
  const out = {};
  for (const f of readdirSync(KERNELS_DIR).filter((x) => x.endsWith('.kernel.mjs')).sort()) {
    const id = f.replace(/\.kernel\.mjs$/, '');
    const hits = findCallerKeyLookups(readFileSync(resolve(KERNELS_DIR, f), 'utf8'));
    out[id] = { hits, counts: countBy(hits) };
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) {
    const bad = runSelfTest();
    console.log(bad ? `✗ lint-caller-key-lookup self-test: ${bad} case(s) wrong` : `✓ lint-caller-key-lookup self-test: ${CASES.length} cases (red and green per pattern)`);
    process.exit(bad ? 1 : 0);
  }
  const fleet = scanFleet();
  if (argv.includes('--write-baseline')) {
    const kernels = {};
    for (const [id, r] of Object.entries(fleet)) if (total(r.counts)) kernels[id] = r.counts;
    writeFileSync(BASELINE_PATH, JSON.stringify({ note: 'KERNEL-CALLER-KEY-LOOKUP-LINT-1: per-kernel hit counts for existing kernels; counts only go down; a kernel absent here must be clean', kernels }, null, 2) + '\n');
    console.log(`wrote baseline: ${Object.keys(kernels).length} kernels with hits`);
    process.exit(0);
  }
  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).kernels : {};
  const oi = argv.indexOf('--only');
  const only = oi !== -1 ? argv[oi + 1] : null;
  if (only && !fleet[only]) { console.error(`✗ no kernel ${only}`); process.exit(2); }
  let blocking = 0; let warn = 0; let sum = 0; let kernelsWithHits = 0;
  for (const [id, r] of Object.entries(fleet)) {
    if (only && id !== only) continue;
    const t = total(r.counts);
    if (!t) continue;
    sum += t; kernelsWithHits++;
    const base = baseline[id];
    if (!base) {
      blocking++;
      console.log(`✗ ${id}: ${t} caller-key lookup hit(s) in a kernel with no baseline entry (new kernels must be clean)`);
      for (const h of r.hits) console.log(`    line ${h.line} [${h.pattern}] ${h.token}: ${h.note}`);
    } else if (total(r.counts) > total(base) || r.counts.A > base.A || r.counts.B > base.B || r.counts.C > base.C) {
      warn++;
      console.log(`! ADVISORY ${id}: hits ${JSON.stringify(r.counts)} exceed baseline ${JSON.stringify(base)}`);
    }
  }
  const stale = Object.keys(baseline).filter((id) => !fleet[id]);
  console.log(`${blocking ? '✗' : '✓'} caller-key lookup: ${sum} hit(s) in ${kernelsWithHits} kernel(s); ${blocking} blocking (new), ${warn} advisory (existing above baseline)${stale.length ? `; ${stale.length} baseline entr${stale.length === 1 ? 'y' : 'ies'} for removed kernels` : ''}`);
  process.exit(blocking ? 1 : 0);
}

if (IS_MAIN) main();
