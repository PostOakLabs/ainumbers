#!/usr/bin/env node
/**
 * scripts/check-derived-declare-parity.mjs — DERIVED-DECLARE-PARITY-1
 *
 * ── WHY THIS GATE EXISTS ─────────────────────────────────────────────────────
 * The 2026-08-20 enrolment incident: `--enroll` started writing
 * `chaingraph/chaingraph.meta.json`, that write was never added to
 * `derived-artifacts.mjs`'s declared `artifacts` list, and the main-side
 * regen workflow's own anti-escape guard (".github/workflows/
 * derived-artifacts-regen.yml", "prove nothing escaped the set") then failed
 * the WHOLE regen run on every push — dead regen, count drift, Land
 * Verify/Deploy red, merge-queue lock, four red surfaces from one missing
 * declaration (SO #47).
 *
 * This gate is the mechanical kill for that defect class: it statically
 * parses what each `COVERED` entry's `regen` command actually writes and
 * asserts that set is a subset of the entry's declared `artifacts`. It runs
 * with no execution and no network — pure source-text analysis of the
 * generator scripts named in `scripts/derived-artifacts.mjs`.
 *
 * ── WHAT IT CHECKS ───────────────────────────────────────────────────────────
 *   1. Parse the write targets of every `regen:` command (`writeFileSync`/
 *      `writeFile` calls, resolved through the `resolve(...)`/`join(...)`/
 *      template-literal chains this codebase actually uses). An entry whose
 *      writes cannot be statically resolved (non-JS generator, or a write
 *      target built from a runtime variable rather than a literal) MUST carry
 *      an explicit `writes:` list on its `COVERED` entry — absence of both is
 *      RED, naming the entry (honest refusal, never assumed clean).
 *   2. Assert measured writes ⊆ declared `artifacts`. Excess is RED, naming
 *      the file and the entry that writes it.
 *   3. Self-repairing check: if a generator's own source gates a write behind
 *      `process.argv.includes('--write'|'--fix')`, the entry's `regen:`
 *      command must include that literal flag (FINDINGS-HELD line 47 —
 *      `kernel-index`'s missing `--write` regressed to a no-op regen).
 *   4. Dedupe check: no path appears more than once across the flat list of
 *      every `COVERED` entry's `artifacts` (FINDINGS-HELD line 52 —
 *      `fv-explainer.html` listed twice in the `counts` entry). `coveredPaths()`
 *      already dedupes via `Set`, which is exactly why this was silent —
 *      recomputed here on the flat array, before any Set collapses it.
 *      Deliberately a WARN, not a fail: several pages are legitimately
 *      touched by more than one generator by design (e.g. `counts` patches
 *      sentinel numbers into pages `openapi`/`catalog`/`stats` also write —
 *      "counts last: they read numbers the earlier generators establish"),
 *      so cross-entry overlap alone is not a defect. The gate surfaces every
 *      duplicate so it stays visible rather than silently absorbed by `Set`.
 *
 * Usage:
 *   node scripts/check-derived-declare-parity.mjs           # human output
 *   node scripts/check-derived-declare-parity.mjs --check   # exit 0/1, wired into preflight
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COVERED, REPO } from './derived-artifacts.mjs';

const HERE_HEADER = dirname(fileURLToPath(import.meta.url));
void HERE_HEADER; // this script's own dir is not itself a subject of analysis

// ── tiny JS source evaluator ────────────────────────────────────────────────
// Resolves the small closed set of path-construction patterns this codebase
// actually uses: `dirname(fileURLToPath(import.meta.url))` (a script's own
// directory), `resolve(BASE, 'lit', ...)` / `join(BASE, 'lit', ...)` chains,
// `'..'` segment pops, template literals `` `${VAR}/tail` ``, and a single
// top-level ternary (fallback/else branch only — the codebase's two ternary
// path vars both gate on an env var that is unset in static analysis).
// Anything outside this set resolves to `null` — UNRESOLVED, not guessed.

function splitLit(s) {
  return s.split('/').filter(Boolean);
}

function stripComments(src) {
  // Line comments only (block comments in these generators are all doc
  // headers, never mid-expression) — good enough for const-decl scanning.
  return src.replace(/\/\/[^\n]*/g, '');
}

/** Extract balanced-paren args string given the index of the opening '('. */
function extractParenArgs(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return { argsStr: src.slice(openIdx + 1, i), end: i };
    }
  }
  return null;
}

function skipString(src, i) {
  const quote = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === quote) return i;
    i++;
  }
  return i;
}

/** Split a top-level-comma-separated argument list, respecting nesting and strings. */
function splitTopLevelArgs(argsStr) {
  const args = [];
  let depth = 0, cur = '';
  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];
    if (c === '"' || c === "'" || c === '`') {
      const end = skipString(argsStr, i);
      cur += argsStr.slice(i, end + 1);
      i = end;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function stringLiteral(s) {
  const m = s.match(/^(['"`])([\s\S]*)\1$/);
  return m ? m[2] : null;
}

const HERE_EXPR_RE = /^dirname\(fileURLToPath\(import\.meta\.url\)\)$/;

/** Find the top-level `:` matching a top-level `?` (single ternary, no nesting). */
function ternaryElseBranch(expr) {
  let depth = 0, qAt = -1;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(expr, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (depth === 0 && c === '?' && qAt === -1) qAt = i;
    else if (depth === 0 && c === ':' && qAt !== -1) return expr.slice(i + 1).trim();
  }
  return null;
}

/**
 * Evaluate an expression to an array of REPO-relative path segments, or
 * `null` if it cannot be statically resolved.
 */
function evalExpr(expr, table, scriptDir) {
  expr = expr.trim();
  if (HERE_EXPR_RE.test(expr.replace(/\s+/g, ''))) return splitLit(scriptDir);
  if (/^__dirname$/.test(expr)) {
    return Object.prototype.hasOwnProperty.call(table, '__dirname') ? table.__dirname : null;
  }

  const elseBranch = ternaryElseBranch(expr);
  if (elseBranch !== null) return evalExpr(elseBranch, table, scriptDir);

  const lit = stringLiteral(expr);
  if (lit !== null) {
    if (expr[0] === '`') {
      const tmpl = expr.match(/^`\$\{(\w+)\}([\s\S]*)`$/);
      if (tmpl) {
        const base = table[tmpl[1]];
        if (!base) return null;
        return [...base, ...splitLit(tmpl[2])];
      }
      return /\$\{/.test(lit) ? null : splitLit(lit);
    }
    return splitLit(lit);
  }

  const callMatch = expr.match(/^([\w.]+)\(/);
  if (callMatch) {
    const fnName = callMatch[1];
    const openIdx = expr.indexOf('(', callMatch[1].length - callMatch[0].length + callMatch[0].length - 1);
    const idx = expr.indexOf('(');
    const extracted = extractParenArgs(expr, idx);
    if (!extracted || extracted.end !== expr.length - 1) return null; // trailing junk = not a bare call
    void openIdx;
    if (fnName !== 'resolve' && fnName !== 'join') return null; // e.g. process.env.X — unresolved
    const args = splitTopLevelArgs(extracted.argsStr);
    if (args.length === 0) return null;
    let base = evalExpr(args[0], table, scriptDir);
    if (!base) return null;
    base = [...base];
    for (let i = 1; i < args.length; i++) {
      const segLit = stringLiteral(args[i]);
      if (segLit === null) return null; // non-literal segment — unresolved
      if (segLit === '..') { base.pop(); continue; }
      base.push(...splitLit(segLit));
    }
    return base;
  }

  // bare identifier
  if (/^\w+$/.test(expr)) {
    return Object.prototype.hasOwnProperty.call(table, expr) ? table[expr] : null;
  }
  return null;
}

/** Scan a JS source file: build the const-name → segments table, and every writeFileSync target. */
function analyzeJsFile(absPath, scriptRelDir) {
  const src = stripComments(readFileSync(absPath, 'utf8'));
  const table = {};
  const constRe = /\bconst\s+(\w+)\s*=\s*/g;
  let m;
  while ((m = constRe.exec(src))) {
    const name = m[1];
    const rhsStart = constRe.lastIndex;
    const rhs = readRhsUntilTopLevelSemicolonOrNewline(src, rhsStart);
    if (rhs === null) continue;
    table[name] = evalExpr(rhs, table, scriptRelDir);
  }

  const writeTargets = [];
  const writeRe = /\b(?:writeFileSync|writeFile)\s*\(/g;
  let wm;
  while ((wm = writeRe.exec(src))) {
    const openIdx = wm.index + wm[0].length - 1;
    const extracted = extractParenArgs(src, openIdx);
    if (!extracted) continue;
    const args = splitTopLevelArgs(extracted.argsStr);
    if (args.length === 0) continue;
    const segs = evalExpr(args[0], table, scriptRelDir);
    writeTargets.push(segs); // may be null — caller treats null as unresolved
  }

  const requiredFlags = [];
  const flagRe = /process\.argv\.includes\(\s*['"](--write|--fix)['"]\s*\)/g;
  let fm;
  while ((fm = flagRe.exec(src))) requiredFlags.push(fm[1]);

  return { writeTargets, requiredFlags: [...new Set(requiredFlags)] };
}

/**
 * Read the RHS of a `const NAME = ` declaration up to the statement's top-
 * level terminator (`;` or a bare newline outside any bracket/string nesting).
 */
function readRhsUntilTopLevelSemicolonOrNewline(src, start) {
  let depth = 0, i = start;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(src, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
    else if (c === ';' && depth === 0) return src.slice(start, i).trim();
    else if (c === '\n' && depth === 0) {
      // multi-line RHS (ternary) continues if the next non-space char is `?` or `:`
      const rest = src.slice(i + 1).trimStart();
      if (rest[0] === ':' || rest[0] === '?') continue;
      // also continue if the line so far ends mid-ternary (`? resolve(...)`)
      const soFar = src.slice(start, i);
      if (/\?\s*$/.test(soFar) || /\?[\s\S]*$/.test(soFar) && !/;\s*$/.test(soFar) && soFar.includes('?') && !soFar.includes(':')) continue;
      return src.slice(start, i).trim();
    }
  }
  return src.slice(start, i).trim();
}

// ── per-entry parsing ────────────────────────────────────────────────────────

function primaryScriptPath(regenCmd) {
  const tokens = regenCmd.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (t === 'node' || t === 'python' || t === 'python3' || t.startsWith('-')) continue;
    return t;
  }
  return null;
}

function measureEntry(entry) {
  if (entry.writes) {
    return { measured: [...entry.writes], unresolved: false, reason: null, flagIssues: [] };
  }
  const scriptRel = primaryScriptPath(entry.regen);
  if (!scriptRel) {
    return { measured: null, unresolved: true, reason: 'could not identify a script path in regen command', flagIssues: [] };
  }
  const ext = extname(scriptRel);
  if (ext !== '.mjs' && ext !== '.js') {
    return { measured: null, unresolved: true, reason: `non-JS generator (${scriptRel}) — static parse not implemented`, flagIssues: [] };
  }
  const abs = resolve(REPO, scriptRel);
  if (!existsSync(abs)) {
    return { measured: null, unresolved: true, reason: `script not found on disk: ${scriptRel}`, flagIssues: [] };
  }
  const scriptRelDir = dirname(scriptRel);
  const { writeTargets, requiredFlags } = analyzeJsFile(abs, scriptRelDir);
  if (writeTargets.length === 0) {
    return { measured: null, unresolved: true, reason: `no writeFileSync/writeFile call found in ${scriptRel}`, flagIssues: [] };
  }
  if (writeTargets.some((t) => t === null)) {
    return { measured: null, unresolved: true, reason: `a write target in ${scriptRel} could not be statically resolved`, flagIssues: [] };
  }
  const measured = [...new Set(writeTargets.map((segs) => segs.join('/')))];

  const flagIssues = requiredFlags.filter((flag) => !entry.regen.includes(flag));
  return { measured, unresolved: false, reason: null, flagIssues };
}

// ── run ──────────────────────────────────────────────────────────────────────

function run() {
  const excessFindings = [];
  const refusals = [];
  const flagFindings = [];
  const dupeFindings = [];

  // Recompute duplicates over the FLAT array — the same shape coveredPaths()
  // builds before its own `new Set(...)` silently collapses them.
  const flat = COVERED.flatMap((e) => e.artifacts.map((p) => ({ id: e.id, path: p })));
  const countByPath = new Map();
  for (const { path } of flat) countByPath.set(path, (countByPath.get(path) || 0) + 1);
  const reported = new Set();
  for (const { id, path } of flat) {
    if (countByPath.get(path) > 1 && !reported.has(path)) {
      reported.add(path);
      const owners = flat.filter((f) => f.path === path).map((f) => f.id);
      dupeFindings.push({ path, count: countByPath.get(path), owners });
    }
    void id;
  }

  for (const entry of COVERED) {
    if (!entry.regen) continue;
    const { measured, unresolved, reason, flagIssues } = measureEntry(entry);
    if (unresolved) {
      refusals.push({ id: entry.id, reason });
      continue;
    }
    const declared = new Set(entry.artifacts);
    for (const path of measured) {
      if (!declared.has(path)) {
        excessFindings.push({ id: entry.id, path, regen: entry.regen });
      }
    }
    for (const flag of flagIssues) {
      flagFindings.push({ id: entry.id, flag, regen: entry.regen });
    }
  }

  return { excessFindings, refusals, flagFindings, dupeFindings };
}

function printReport(result) {
  const { excessFindings, refusals, flagFindings, dupeFindings } = result;

  console.log(`derived-declare-parity: ${COVERED.length} COVERED entries checked\n`);

  if (refusals.length) {
    console.log(`⚠ HONEST REFUSAL — ${refusals.length} entry(ies) not statically parseable (need an explicit \`writes:\` list):`);
    for (const r of refusals) console.log(`  - ${r.id}: ${r.reason}`);
    console.log('');
  }

  if (excessFindings.length) {
    console.log(`✗ UNDECLARED WRITE — ${excessFindings.length} finding(s):`);
    for (const f of excessFindings) {
      console.log(`  - entry "${f.id}" (\`${f.regen}\`) writes "${f.path}", not in its declared artifacts[]`);
    }
    console.log('');
  } else {
    console.log('✓ every statically-resolved write target is a subset of its entry\'s declared artifacts[]');
  }

  if (flagFindings.length) {
    console.log(`✗ MISSING WRITE FLAG — ${flagFindings.length} finding(s):`);
    for (const f of flagFindings) {
      console.log(`  - entry "${f.id}"'s generator requires "${f.flag}" to write, but regen command ("${f.regen}") omits it`);
    }
    console.log('');
  } else {
    console.log('✓ every write-gated generator\'s regen command carries its required flag');
  }

  if (dupeFindings.length) {
    console.log(`⚠ WARN — ${dupeFindings.length} path(s) appear more than once across COVERED artifacts[] (Set-dedup hides this; harmless membership test, surfaced not blocked):`);
    for (const d of dupeFindings) console.log(`  - "${d.path}" listed ${d.count}x — owner(s): ${[...new Set(d.owners)].join(', ')}`);
  } else {
    console.log('✓ no path appears more than once across COVERED artifacts[]');
  }

  const hardFail = excessFindings.length > 0 || refusals.length > 0 || flagFindings.length > 0;
  return hardFail;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = run();
  const hardFail = printReport(result);
  if (process.argv.includes('--check')) {
    process.exit(hardFail ? 1 : 0);
  } else {
    process.exit(hardFail ? 1 : 0);
  }
}

export { run, measureEntry, primaryScriptPath };
