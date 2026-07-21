// Headless hand-rolled workbook core (WORKBOOK-1-BUILD-SPEC.md §WB-1).
// Zero-dependency: JSON cell model + tokenizer/recursive-descent formula engine
// (~20 functions) + strict RFC 4180 CSV + range digests via the canonical
// chaingraph/kernels/_hash.mjs sha256 path. Runs unchanged in browsers, Workers,
// and Node — no imports beyond the shared hash module.
//
// Determinism is the product: same CSV in -> same digest out, forever. Malformed
// input is REJECTED, never repaired. Any NaN/Infinity produced by a formula
// becomes the terminal value `#NUM!` and never propagates as a live number
// (kernel-finite-gate doctrine, shared with the OCG kernels).
//
// This module does NOT hand-roll a second hash scheme — rangeDigest() calls the
// same executionHash()/cgCanon() the rest of the suite uses for execution_hash.

import { cgCanon, executionHash } from '../kernels/_hash.mjs';
import { serializeCsvField as sharedSerializeCsvField } from '../kernels/_csv_injection.mjs';

export class WorkbookError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
  }
}

const ERROR_CODES = new Set(['#REF!', '#DIV/0!', '#VALUE!', '#NUM!', '#NAME?', '#CYCLE!', '#PARSE!', '#ERROR!']);
export const isErrorValue = (v) => typeof v === 'string' && ERROR_CODES.has(v);

// ── cell reference arithmetic ──────────────────────────────────────────────
const CELL_RE = /^([A-Za-z]+)([1-9][0-9]*)$/;

export function colLettersToIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
export function indexToColLetters(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
export function parseCellRef(ref) {
  const m = CELL_RE.exec(ref);
  if (!m) throw new WorkbookError('#REF!', `invalid cell reference "${ref}"`);
  return { col: colLettersToIndex(m[1]), row: Number(m[2]) };
}
export function cellKey(col, row) { return `${indexToColLetters(col)}${row}`; }
export function expandRange(rangeRef) {
  const parts = rangeRef.split(':');
  if (parts.length !== 2) throw new WorkbookError('#REF!', `invalid range "${rangeRef}"`);
  const a = parseCellRef(parts[0]), b = parseCellRef(parts[1]);
  const c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
  const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row);
  const matrix = [];
  for (let r = r1; r <= r2; r++) {
    const row = [];
    for (let c = c1; c <= c2; c++) row.push(cellKey(c, r));
    matrix.push(row);
  }
  return matrix; // rows x cols matrix of cell keys, row-major, top-left origin
}
export function fullRangeRef(wb) {
  if (!wb.rows || !wb.cols) return null;
  return `A1:${indexToColLetters(wb.cols)}${wb.rows}`;
}

// ── tokenizer ───────────────────────────────────────────────────────────────
function tokenize(src) {
  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '"') {
      let j = i + 1, s = '';
      let closed = false;
      while (j < n) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') { s += '"'; j += 2; continue; }
          j++; closed = true; break;
        }
        s += src[j]; j++;
      }
      if (!closed) throw new WorkbookError('#PARSE!', 'unterminated string literal');
      toks.push({ t: 'STRING', v: s }); i = j; continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < n && /[0-9.]/.test(src[j])) j++;
      const numStr = src.slice(i, j);
      if (!/^[0-9]*\.?[0-9]+$/.test(numStr) && !/^[0-9]+\.?[0-9]*$/.test(numStr)) {
        throw new WorkbookError('#PARSE!', `bad number literal "${numStr}"`);
      }
      toks.push({ t: 'NUMBER', v: Number(numStr) }); i = j; continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j).toUpperCase();
      if (/^[A-Z]+[0-9]+$/.test(word)) {
        if (src[j] === ':') {
          let k = j + 1;
          while (k < n && /[A-Za-z0-9]/.test(src[k])) k++;
          const word2 = src.slice(j + 1, k).toUpperCase();
          if (/^[A-Z]+[0-9]+$/.test(word2)) { toks.push({ t: 'RANGE', v: `${word}:${word2}` }); i = k; continue; }
        }
        toks.push({ t: 'REF', v: word }); i = j; continue;
      }
      toks.push({ t: 'IDENT', v: word }); i = j; continue;
    }
    if (ch === '<' && src[i + 1] === '=') { toks.push({ t: 'OP', v: '<=' }); i += 2; continue; }
    if (ch === '>' && src[i + 1] === '=') { toks.push({ t: 'OP', v: '>=' }); i += 2; continue; }
    if (ch === '<' && src[i + 1] === '>') { toks.push({ t: 'OP', v: '<>' }); i += 2; continue; }
    if (ch === '(') { toks.push({ t: 'LPAREN', v: ch }); i++; continue; }
    if (ch === ')') { toks.push({ t: 'RPAREN', v: ch }); i++; continue; }
    if (ch === ',') { toks.push({ t: 'COMMA', v: ch }); i++; continue; }
    if ('=<>+-*/^&'.includes(ch)) { toks.push({ t: 'OP', v: ch }); i++; continue; }
    throw new WorkbookError('#PARSE!', `unexpected character "${ch}"`);
  }
  toks.push({ t: 'EOF', v: null });
  return toks;
}

// ── recursive-descent parser ───────────────────────────────────────────────
class Parser {
  constructor(toks) { this.toks = toks; this.i = 0; }
  peek() { return this.toks[this.i]; }
  next() { return this.toks[this.i++]; }
  expect(t) { const tok = this.next(); if (tok.t !== t) throw new WorkbookError('#PARSE!', `expected ${t}, got ${tok.t}`); return tok; }
  parseExpr() { return this.parseComparison(); }
  parseComparison() {
    let left = this.parseConcat();
    while (this.peek().t === 'OP' && ['=', '<>', '<', '>', '<=', '>='].includes(this.peek().v)) {
      const op = this.next().v; left = { type: 'binop', op, left, right: this.parseConcat() };
    }
    return left;
  }
  parseConcat() {
    let left = this.parseAdd();
    while (this.peek().t === 'OP' && this.peek().v === '&') { this.next(); left = { type: 'binop', op: '&', left, right: this.parseAdd() }; }
    return left;
  }
  parseAdd() {
    let left = this.parseMul();
    while (this.peek().t === 'OP' && (this.peek().v === '+' || this.peek().v === '-')) {
      const op = this.next().v; left = { type: 'binop', op, left, right: this.parseMul() };
    }
    return left;
  }
  parseMul() {
    let left = this.parseUnary();
    while (this.peek().t === 'OP' && (this.peek().v === '*' || this.peek().v === '/')) {
      const op = this.next().v; left = { type: 'binop', op, left, right: this.parseUnary() };
    }
    return left;
  }
  parseUnary() {
    if (this.peek().t === 'OP' && this.peek().v === '-') { this.next(); return { type: 'neg', expr: this.parseUnary() }; }
    if (this.peek().t === 'OP' && this.peek().v === '+') { this.next(); return this.parseUnary(); }
    return this.parsePow();
  }
  parsePow() {
    const left = this.parsePrimary();
    if (this.peek().t === 'OP' && this.peek().v === '^') { this.next(); return { type: 'binop', op: '^', left, right: this.parseUnary() }; }
    return left;
  }
  parsePrimary() {
    const tok = this.peek();
    if (tok.t === 'NUMBER') { this.next(); return { type: 'num', value: tok.v }; }
    if (tok.t === 'STRING') { this.next(); return { type: 'str', value: tok.v }; }
    if (tok.t === 'REF') { this.next(); return { type: 'ref', ref: tok.v }; }
    if (tok.t === 'RANGE') { this.next(); return { type: 'range', ref: tok.v }; }
    if (tok.t === 'LPAREN') { this.next(); const e = this.parseExpr(); this.expect('RPAREN'); return e; }
    if (tok.t === 'IDENT') {
      this.next();
      const name = tok.v;
      if (name === 'TRUE') return { type: 'bool', value: true };
      if (name === 'FALSE') return { type: 'bool', value: false };
      this.expect('LPAREN');
      const args = [];
      if (this.peek().t !== 'RPAREN') {
        args.push(this.parseExpr());
        while (this.peek().t === 'COMMA') { this.next(); args.push(this.parseExpr()); }
      }
      this.expect('RPAREN');
      return { type: 'call', name, args };
    }
    throw new WorkbookError('#PARSE!', `unexpected token ${tok.t}`);
  }
}
export function parseFormula(src) {
  const p = new Parser(tokenize(src));
  const ast = p.parseExpr();
  p.expect('EOF');
  return ast;
}

// ── evaluation primitives ──────────────────────────────────────────────────
function propagateIfError(v) { if (isErrorValue(v)) throw new WorkbookError(v); }
function finiteNum(n) { if (!Number.isFinite(n)) throw new WorkbookError('#NUM!'); return n; }
function toNum(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'string') { const n = Number(v); if (Number.isNaN(n)) throw new WorkbookError('#VALUE!'); return n; }
  throw new WorkbookError('#VALUE!');
}
function toStr(v) { if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'; return String(v); }
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') { const u = v.toUpperCase(); if (u === 'TRUE') return true; if (u === 'FALSE') return false; }
  throw new WorkbookError('#VALUE!');
}
function looseEq(l, r) {
  if (typeof l === 'number' || typeof r === 'number') { try { return toNum(l) === toNum(r); } catch { return false; } }
  return toStr(l).toUpperCase() === toStr(r).toUpperCase();
}
function evalBinop(op, l, r) {
  propagateIfError(l); propagateIfError(r);
  switch (op) {
    case '+': return finiteNum(toNum(l) + toNum(r));
    case '-': return finiteNum(toNum(l) - toNum(r));
    case '*': return finiteNum(toNum(l) * toNum(r));
    case '/': { const rn = toNum(r); if (rn === 0) throw new WorkbookError('#DIV/0!'); return finiteNum(toNum(l) / rn); }
    case '^': return finiteNum(Math.pow(toNum(l), toNum(r)));
    case '&': return toStr(l) + toStr(r);
    case '=': return looseEq(l, r);
    case '<>': return !looseEq(l, r);
    case '<': return toNum(l) < toNum(r);
    case '>': return toNum(l) > toNum(r);
    case '<=': return toNum(l) <= toNum(r);
    case '>=': return toNum(l) >= toNum(r);
    default: throw new WorkbookError('#PARSE!', `unknown operator "${op}"`);
  }
}
function matchCriteria(value, crit) {
  if (typeof crit === 'string') {
    const m = /^(<=|>=|<>|=|<|>)(.*)$/.exec(crit);
    if (m) {
      const [, op, rhsRaw] = m;
      const rhsNum = Number(rhsRaw);
      const rhs = Number.isNaN(rhsNum) ? rhsRaw : rhsNum;
      try { return evalBinop(op, value, rhs); } catch { return false; }
    }
  }
  return looseEq(value, crit);
}

function evalAst(ast, ctx) {
  switch (ast.type) {
    case 'num': return ast.value;
    case 'str': return ast.value;
    case 'bool': return ast.value;
    case 'neg': { const v = evalAst(ast.expr, ctx); propagateIfError(v); return finiteNum(-toNum(v)); }
    case 'binop': return evalBinop(ast.op, evalAst(ast.left, ctx), evalAst(ast.right, ctx));
    case 'ref': return ctx.getCell(ast.ref);
    case 'range': throw new WorkbookError('#VALUE!', 'range used outside a function');
    case 'call': return evalCall(ast.name, ast.args, ctx);
    default: throw new WorkbookError('#PARSE!', `unknown AST node "${ast.type}"`);
  }
}

function collectNumbers(args, ctx) {
  const out = [];
  for (const a of args) {
    if (a.type === 'range') {
      for (const row of expandRange(a.ref)) for (const key of row) {
        const v = ctx.getCell(key);
        propagateIfError(v);
        if (typeof v === 'number') out.push(v);
      }
    } else {
      const v = evalAst(a, ctx);
      propagateIfError(v);
      if (typeof v === 'number') out.push(v);
      else if (typeof v === 'boolean') out.push(v ? 1 : 0);
      else throw new WorkbookError('#VALUE!', 'expected a number');
    }
  }
  return out;
}
function collectRaw(argNode, ctx) {
  if (argNode.type === 'range') {
    const out = [];
    for (const row of expandRange(argNode.ref)) for (const key of row) out.push(ctx.getCell(key));
    return out;
  }
  return [evalAst(argNode, ctx)];
}
function requireArgs(name, args, min, max = min) {
  if (args.length < min || args.length > max) throw new WorkbookError('#VALUE!', `${name} expects ${min === max ? min : `${min}-${max}`} arg(s), got ${args.length}`);
}

export const WORKBOOK_FUNCTIONS = Object.freeze([
  'SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'COUNTIF', 'IF', 'AND', 'OR', 'NOT',
  'ROUND', 'ABS', 'CONCAT', 'LEN', 'LEFT', 'RIGHT', 'TRIM', 'UPPER', 'LOWER', 'SUMIF',
]);

function evalCall(name, args, ctx) {
  switch (name) {
    case 'SUM': return finiteNum(collectNumbers(args, ctx).reduce((a, b) => a + b, 0));
    case 'AVG': { const ns = collectNumbers(args, ctx); if (!ns.length) throw new WorkbookError('#DIV/0!'); return finiteNum(ns.reduce((a, b) => a + b, 0) / ns.length); }
    case 'MIN': { const ns = collectNumbers(args, ctx); return ns.length ? finiteNum(Math.min(...ns)) : 0; }
    case 'MAX': { const ns = collectNumbers(args, ctx); return ns.length ? finiteNum(Math.max(...ns)) : 0; }
    case 'COUNT': return collectNumbers(args, ctx).length;
    case 'COUNTIF': { requireArgs(name, args, 2); const vals = collectRaw(args[0], ctx); const crit = evalAst(args[1], ctx); propagateIfError(crit); return vals.filter((v) => !isErrorValue(v) && matchCriteria(v, crit)).length; }
    case 'IF': { requireArgs(name, args, 2, 3); const c = evalAst(args[0], ctx); propagateIfError(c); return toBool(c) ? evalAst(args[1], ctx) : (args[2] !== undefined ? evalAst(args[2], ctx) : false); }
    case 'AND': return args.every((a) => { const v = evalAst(a, ctx); propagateIfError(v); return toBool(v); });
    case 'OR': return args.some((a) => { const v = evalAst(a, ctx); propagateIfError(v); return toBool(v); });
    case 'NOT': { requireArgs(name, args, 1); const v = evalAst(args[0], ctx); propagateIfError(v); return !toBool(v); }
    case 'ROUND': { requireArgs(name, args, 2); const v = evalAst(args[0], ctx), d = evalAst(args[1], ctx); propagateIfError(v); propagateIfError(d); const f = Math.pow(10, toNum(d)); return finiteNum(Math.round(toNum(v) * f) / f); }
    case 'ABS': { requireArgs(name, args, 1); const v = evalAst(args[0], ctx); propagateIfError(v); return finiteNum(Math.abs(toNum(v))); }
    case 'CONCAT': return args.map((a) => { const v = evalAst(a, ctx); propagateIfError(v); return toStr(v); }).join('');
    case 'LEN': { requireArgs(name, args, 1); const v = evalAst(args[0], ctx); propagateIfError(v); return toStr(v).length; }
    case 'LEFT': { requireArgs(name, args, 1, 2); const v = evalAst(args[0], ctx); propagateIfError(v); const nRaw = args[1] !== undefined ? evalAst(args[1], ctx) : 1; propagateIfError(nRaw); return toStr(v).slice(0, Math.max(0, toNum(nRaw))); }
    case 'RIGHT': { requireArgs(name, args, 1, 2); const v = evalAst(args[0], ctx); propagateIfError(v); const nRaw = args[1] !== undefined ? evalAst(args[1], ctx) : 1; propagateIfError(nRaw); const n = Math.max(0, toNum(nRaw)); const s = toStr(v); return n === 0 ? '' : s.slice(-n); }
    case 'TRIM': { requireArgs(name, args, 1); const v = evalAst(args[0], ctx); propagateIfError(v); return toStr(v).trim().replace(/\s+/g, ' '); }
    case 'UPPER': { requireArgs(name, args, 1); const v = evalAst(args[0], ctx); propagateIfError(v); return toStr(v).toUpperCase(); }
    case 'LOWER': { requireArgs(name, args, 1); const v = evalAst(args[0], ctx); propagateIfError(v); return toStr(v).toLowerCase(); }
    case 'SUMIF': {
      requireArgs(name, args, 2, 3);
      const rangeNode = args[0];
      if (rangeNode.type !== 'range') throw new WorkbookError('#VALUE!', 'SUMIF requires a range as its first argument');
      const critVal = evalAst(args[1], ctx); propagateIfError(critVal);
      const sumNode = args[2] !== undefined ? args[2] : rangeNode;
      if (sumNode.type !== 'range') throw new WorkbookError('#VALUE!', 'SUMIF sum_range must be a range');
      const matrix = expandRange(rangeNode.ref), sumMatrix = expandRange(sumNode.ref);
      if (matrix.length !== sumMatrix.length || matrix[0].length !== sumMatrix[0].length) throw new WorkbookError('#VALUE!', 'SUMIF range/sum_range size mismatch');
      let total = 0;
      for (let r = 0; r < matrix.length; r++) for (let c = 0; c < matrix[r].length; c++) {
        const cv = ctx.getCell(matrix[r][c]);
        if (isErrorValue(cv)) throw new WorkbookError(cv);
        if (matchCriteria(cv, critVal)) {
          const sv = ctx.getCell(sumMatrix[r][c]);
          if (isErrorValue(sv)) throw new WorkbookError(sv);
          if (typeof sv === 'number') total += sv;
        }
      }
      return finiteNum(total);
    }
    default: throw new WorkbookError('#NAME?', `unknown function "${name}"`);
  }
}

// ── cell / workbook model ──────────────────────────────────────────────────
export function createWorkbook() { return { cells: {}, rows: 0, cols: 0 }; }

export function setCell(wb, ref, raw) {
  const { col, row } = parseCellRef(ref);
  if (raw === '' || raw === null || raw === undefined) { delete wb.cells[ref]; }
  else { wb.cells[ref] = { raw }; }
  wb.rows = Math.max(wb.rows || 0, row);
  wb.cols = Math.max(wb.cols || 0, col);
  return wb;
}

function coerceLiteral(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : '#NUM!';
  if (typeof raw === 'boolean') return raw;
  const s = String(raw);
  if (/^-?[0-9]+(\.[0-9]+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : '#NUM!';
  }
  const u = s.toUpperCase();
  if (u === 'TRUE') return true;
  if (u === 'FALSE') return false;
  return s;
}

// Recalculates every formula cell via memoized DFS: lazily evaluating a cell's
// dependencies before the cell itself IS a topological evaluation order — the
// memo (`results`) doubles as the "already in final position" set, and the
// `state` map turns a re-entrant visit (a back-edge) into `#CYCLE!` instead of
// infinite recursion.
export function recalc(wb) {
  const results = {};
  const state = new Map(); // ref -> 'visiting' | 'done'

  function getCell(ref) {
    if (Object.prototype.hasOwnProperty.call(results, ref)) return results[ref];
    const cell = wb.cells[ref];
    if (!cell) return null; // blank cell
    return evaluateCell(ref, cell);
  }

  function evaluateCell(ref, cell) {
    if (state.get(ref) === 'visiting') return '#CYCLE!';
    state.set(ref, 'visiting');
    let value;
    if (typeof cell.raw !== 'string' || !cell.raw.startsWith('=')) {
      value = coerceLiteral(cell.raw);
    } else {
      try {
        const ast = parseFormula(cell.raw.slice(1));
        value = evalAst(ast, { getCell });
      } catch (e) {
        value = e instanceof WorkbookError ? e.code : '#ERROR!';
      }
    }
    state.set(ref, 'done');
    results[ref] = value;
    return value;
  }

  for (const ref of Object.keys(wb.cells)) getCell(ref);
  for (const ref of Object.keys(wb.cells)) wb.cells[ref].value = results[ref];
  return wb;
}

// ── strict RFC 4180 CSV ─────────────────────────────────────────────────────
export function parseCSV(text) {
  if (typeof text !== 'string') throw new WorkbookError('#VALUE!', 'CSV input must be a string');
  const rows = [];
  let row = [], field = '', i = 0;
  const n = text.length;
  let state = 'FIELD_START'; // FIELD_START | UNQUOTED | QUOTED | AFTER_QUOTE
  const endField = () => { row.push(field); field = ''; state = 'FIELD_START'; };
  const endRow = () => { endField(); rows.push(row); row = []; };
  while (i < n) {
    const ch = text[i];
    if (state === 'FIELD_START') {
      if (ch === '"') { state = 'QUOTED'; i++; continue; }
      if (ch === ',') { endField(); i++; continue; }
      if (ch === '\r') { if (text[i + 1] === '\n') i++; endRow(); i++; continue; }
      if (ch === '\n') { endRow(); i++; continue; }
      field += ch; state = 'UNQUOTED'; i++; continue;
    }
    if (state === 'UNQUOTED') {
      if (ch === '"') throw new WorkbookError('#PARSE!', `malformed CSV: unexpected quote inside unquoted field at position ${i}`);
      if (ch === ',') { endField(); i++; continue; }
      if (ch === '\r') { if (text[i + 1] === '\n') i++; endRow(); i++; continue; }
      if (ch === '\n') { endRow(); i++; continue; }
      field += ch; i++; continue;
    }
    if (state === 'QUOTED') {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        state = 'AFTER_QUOTE'; i++; continue;
      }
      field += ch; i++; continue; // commas/newlines are literal inside quotes
    }
    if (state === 'AFTER_QUOTE') {
      if (ch === ',') { endField(); i++; continue; }
      if (ch === '\r') { if (text[i + 1] === '\n') i++; endRow(); i++; continue; }
      if (ch === '\n') { endRow(); i++; continue; }
      throw new WorkbookError('#PARSE!', `malformed CSV: unexpected character after closing quote at position ${i}`);
    }
  }
  if (state === 'QUOTED') throw new WorkbookError('#PARSE!', 'malformed CSV: unterminated quoted field');
  if (state !== 'FIELD_START' || field !== '' || row.length) endRow();
  return rows;
}

// CSV-injection prefix rule lives in the shared helper (kernels/_csv_injection.mjs)
// so the workbook engine and any other CSV-emitting surface share one implementation.
export const serializeCSVField = sharedSerializeCsvField;
export function serializeCSV(rows) {
  return rows.map((row) => row.map(serializeCSVField).join(',')).join('\r\n') + '\r\n';
}

export function csvToWorkbook(text) {
  const rows = parseCSV(text);
  const wb = createWorkbook();
  let maxCol = 0;
  rows.forEach((r, ri) => {
    maxCol = Math.max(maxCol, r.length);
    r.forEach((val, ci) => { if (val !== '') setCell(wb, cellKey(ci + 1, ri + 1), val); });
  });
  wb.rows = Math.max(wb.rows, rows.length);
  wb.cols = Math.max(wb.cols, maxCol);
  recalc(wb);
  return wb;
}

function cellDisplayValue(wb, ref) {
  const cell = wb.cells[ref];
  if (!cell) return '';
  const v = cell.value !== undefined ? cell.value : coerceLiteral(cell.raw);
  return toStr(v);
}

export function workbookToCSV(wb, rangeRef) {
  const range = rangeRef || fullRangeRef(wb);
  if (!range) return '';
  const matrix = expandRange(range).map((row) => row.map((ref) => cellDisplayValue(wb, ref)));
  return serializeCSV(matrix);
}

// ── canonicalization + range digests (reuses _hash.mjs, no second hash path) ─
export function canonicalWorkbook(wb) { return cgCanon({ cells: wb.cells, rows: wb.rows, cols: wb.cols }); }

export function rangeValuesMatrix(wb, rangeRef) {
  return expandRange(rangeRef).map((row) => row.map((ref) => {
    const cell = wb.cells[ref];
    if (!cell) return null;
    return cell.value !== undefined ? cell.value : coerceLiteral(cell.raw);
  }));
}

export async function rangeDigest(wb, rangeRef) {
  const values = rangeValuesMatrix(wb, rangeRef);
  return executionHash(values, {}); // canonical JSON of the range's values, sha256 via _hash.mjs
}

export async function csvDigest(text) {
  const wb = csvToWorkbook(text);
  const range = fullRangeRef(wb);
  if (!range) return executionHash([], {});
  return rangeDigest(wb, range);
}
