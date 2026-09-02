#!/usr/bin/env node
// lint-comparator-epsilon.mjs -- COMPARATOR-EPSILON-LINT-1 (boundary-semantics program 2026-09-01).
//
// THE DEFECT (research/BOUNDARY-SEMANTICS-TRANCHE2-2026-09-01.md §7F): the art-234 L106
// inversion -- `pp_pct > HOEPA_PP.max_pct_of_loan - 1e-5` fires AT exactly pp_pct == the
// limit, where the regulation (12 CFR 1026.31(d)(1)(iii) HOEPA points-and-fees, strict
// greater-than over the APR/points thresholds) does not. An epsilon SUBTRACTED from the
// threshold under a STRICT comparator silently widens the firing region across the legal
// boundary: the code answers "triggers" where the text says "does not". The manual audit
// reached ~75 of 887 candidate comparators before the paste-auditor fabricated coverage;
// the remaining ~812 belong to THIS lint, not a human.
//
// THE RULE (mechanical): a comparison whose epsilon-bearing side carries BOTH a threshold
// term AND an additive epsilon term has a shape, and the shape decides the boundary
// behavior (value <op> (X ± eps), epsilon-side operand-normalized so `X - eps < v` reads
// as `v > X - eps`):
//   > X - eps   => WIDENING_STRICT     (fires at the boundary the strict form excludes)
//   < X + eps   => WIDENING_STRICT     (mirror image; same inversion)   [BOTH FLAGGED --
//   >= X - eps  => WIDENING_INCLUSIVE  (inclusive already; census-only)    the art-234
//   <= X + eps  => WIDENING_INCLUSIVE  (inclusive already; census-only)    shape]
//   > X + eps   => TIGHTENING_STRICT   (adds margin; informational only)
//   < X - eps   => TIGHTENING_STRICT   (adds margin; informational only)
//   >= X + eps  => TIGHTENING_INCLUSIVE / <= X - eps (same family; informational)
// PLAIN comparators (no epsilon term) are OUT OF SCOPE -- their semantics need the
// regulation; that is the audit lane, not this lint.
//
// EXCLUDED CLASSES (documented so the census is honest about coverage):
//   - bare-epsilon proximity guards: `Math.abs(x) < 1e-9`, `hi - lo < 1e-8` -- the
//     epsilon side carries NO other term; the comparison tests proximity to zero, not a
//     threshold boundary (convergence guards, the TVM/numerics family).
//   - relative/multiplicative tolerances: `inv > lca * (1 + tol)` -- the epsilon is not
//     ADDITIVE with the threshold; the row's shape taxonomy is `X ± eps`.
//   - comment and string-literal contents (stripped before scanning; a comparator quoted
//     in prose is documentation, not a decision).
// KNOWN SCANNING LIMITS (each bounded and benign): regex-literal bodies are not lexed;
// template-interpolated comparators are string-building (audit lane); newline is a hard
// operand boundary (measured 2026-09-02: zero multi-line comparator+epsilon spans in the
// corpus); `a >>= n`-style shift-assign could misread `>=` (no such byte sequence near an
// epsilon in the corpus).
//
// SCOPE: chaingraph/kernels/*.kernel.mjs (per the row; the proptest layer can ride a
// later row). Zero kernel edits in this row -- findings are report/fix-row material.
//
// BASELINE: scripts/comparator-epsilon-baseline.json through the shared HARD-FAILING
// loader scripts/ratchet-baseline.mjs, over the FLAGGED class only (WIDENING_STRICT).
// Counts only go DOWN; a NEW widening-strict shape anywhere REDs immediately
// (unshielded); deleting the baseline REDS the gate. art-234 is pinned at ship time
// (its inversion shape is still live on main -- its fix row owns the fix).
// ⛔ NEVER grow the baseline to make the gate pass.
//
// Usage:
//   node scripts/lint-comparator-epsilon.mjs                     # gate (preflight + CI)
//   node scripts/lint-comparator-epsilon.mjs --check             # alias
//   node scripts/lint-comparator-epsilon.mjs --list              # every flagged hit
//   node scripts/lint-comparator-epsilon.mjs --census            # one-shot estate census
//   node scripts/lint-comparator-epsilon.mjs --update-baseline   # re-pin (counts only go down)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from "./ratchet-baseline.mjs";
import { gitSync } from "./_git-env-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
export const BASELINE_PATH = resolve(HERE, "comparator-epsilon-baseline.json");
export const REPIN_COMMAND = "node scripts/lint-comparator-epsilon.mjs --update-baseline";
const BASELINE_LABEL = "lint-comparator-epsilon";
const BASELINE_KEYS = ["total", { key: "files", type: "name-list" }];

export const NL = String.fromCharCode(10);

// ── shape vocabulary ─────────────────────────────────────────────────────────────────────
export const SHAPES = Object.freeze({
  WIDENING_STRICT: "WIDENING_STRICT",
  WIDENING_INCLUSIVE: "WIDENING_INCLUSIVE",
  TIGHTENING_STRICT: "TIGHTENING_STRICT",
  TIGHTENING_INCLUSIVE: "TIGHTENING_INCLUSIVE",
});

// (effective op, epsilon sign) -> shape. The epsilon side is normalized to the RHS
// (`X - eps < v` swaps to `v > X - eps` with the op flipped), so this table is total.
const SHAPE_TABLE = {
  [">" + "-"]: { shape: SHAPES.WIDENING_STRICT, flagged: true },
  ["<" + "+"]: { shape: SHAPES.WIDENING_STRICT, flagged: true },
  [">=" + "-"]: { shape: SHAPES.WIDENING_INCLUSIVE, flagged: false },
  ["<=" + "+"]: { shape: SHAPES.WIDENING_INCLUSIVE, flagged: false },
  [">" + "+"]: { shape: SHAPES.TIGHTENING_STRICT, flagged: false },
  ["<" + "-"]: { shape: SHAPES.TIGHTENING_STRICT, flagged: false },
  [">=" + "+"]: { shape: SHAPES.TIGHTENING_INCLUSIVE, flagged: false },
  ["<=" + "-"]: { shape: SHAPES.TIGHTENING_INCLUSIVE, flagged: false },
};

const EPSILON_ABS_BOUND = 0.01; // a literal is epsilon-shaped iff 0 < |value| < this
const EPSILON_SEGMENTS = new Set(["eps", "epsilon", "tol", "tolerance", "fuzz", "slack", "ulp"]);

// ── stripCommentsAndStrings ──────────────────────────────────────────────────────────────
// Single pass; byte-for-byte offset-stable (every consumed char becomes a space, newlines
// survive) so match indexes read straight through to line numbers. Handles line/block
// comments, escapes, and template literals. Template `${...}` interiors are treated as
// string content (documented limit above).
export function stripCommentsAndStrings(src) {
  const out = src.split(""); // mutate in place, keep length
  let i = 0;
  const n = src.length;
  const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== NL) out[k] = " "; };
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      let j = i;
      while (j < n && src[j] !== NL) j++;
      blank(i, j);
      i = j;
    } else if (c === "/" && src[i + 1] === "*") {
      let j = i + 2;
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++;
      const end = j < n ? j + 2 : n;
      blank(i, end);
      i = end;
    } else if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === quote) { j++; break; }
        if (quote !== "`" && src[j] === NL) break; // unterminated: stop at line end
        j++;
      }
      blank(i, j);
      i = j;
    } else {
      i++;
    }
  }
  return out.join("");
}

// ── term classification ──────────────────────────────────────────────────────────────────
// "epsilon" = a bare scientific/positional literal under the bound, or an identifier whose
// name carries an epsilon/tolerance segment (snake_case and camelCase both split).
// Anything else (including an epsilon literal BURIED in a product) is "other".
export function classifyTerm(rawTerm) {
  const term = rawTerm.trim().replace(/^\+/, "").trim();
  if (!term) return null;
  if (/^0[xXbBoO]/.test(term)) return "other";
  if (/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$|^\.\d+(?:[eE][+-]?\d+)?$/.test(term)) {
    const v = Number(term);
    return Number.isFinite(v) && v > 0 && v < EPSILON_ABS_BOUND ? "epsilon" : "other";
  }
  const ident = term.replace(/\?\./g, ".");
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(ident)) {
    for (const part of ident.split(".")) {
      const segs = part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_]+/).map((s) => s.toLowerCase());
      if (segs.some((s) => EPSILON_SEGMENTS.has(s))) return "epsilon";
    }
  }
  return "other";
}

// Split an operand expression on top-level + and - (depth over ()[]{}), never inside a
// numeric literal (`1e-5` stays whole: the `-` there follows an e whose prefix is a digit).
export function splitTopLevel(expr) {
  const terms = [];
  let depth = 0;
  let start = 0;
  // The sign of the NEXT term is the +/- operator that just split it (or a leading unary
  // minus on the head); a doubled sign composes (`a - -eps` adds, `a + -eps` subtracts).
  let pendingSign = expr.trimStart().startsWith("-") ? "-" : "+";
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === "(" || c === "[" || c === "{") { depth++; continue; }
    if (c === ")" || c === "]" || c === "}") { depth--; continue; }
    if (depth !== 0 || (c !== "+" && c !== "-")) continue;
    const before = expr.slice(0, i).replace(/[ \t]+$/, "");
    const prev = before.slice(-1);
    let inNumber = /[0-9.]/.test(prev);
    if (!inNumber && /[eE]/.test(prev) && /[0-9][eE]$/.test(before)) inNumber = true;
    if (inNumber) continue; // the sign inside `1e-5` belongs to the literal
    const chunk = expr.slice(start, i);
    if (chunk.trim()) {
      terms.push({ sign: pendingSign, text: chunk.trim().replace(/^[+-]/, "").trim() });
      pendingSign = c; // the pending sign was consumed by the term just pushed
    } else if (c === "-") {
      // stacked unary sign before the real term (`a + -eps`, `a - -eps`): compose it
      pendingSign = pendingSign === "-" ? "+" : "-";
    }
    start = i + 1;
  }
  const tail = expr.slice(start);
  if (tail.trim()) terms.push({ sign: pendingSign, text: tail.trim().replace(/^[+-]/, "").trim() });
  return terms;
}

// ── comparison scanning ──────────────────────────────────────────────────────────────────
const LHS_STOP = new Set([";", "{", "}", "(", ")", ",", "?", ":", NL]);
const RHS_STOP = new Set([";", "{", "}", ")", ",", "?", ":", NL]);
const OPBoundaryChars = new Set(["<", ">", "=", "!", "&", "|"]);

function walkLeft(src, from) {
  let i = from - 1;
  while (i >= 0) {
    const c = src[i];
    if (LHS_STOP.has(c)) break;
    if ((c === "&" && src[i - 1] === "&") || (c === "|" && src[i - 1] === "|")) break; // stop BEFORE the pair: window starts after it
    if (c === "=") break; // assignment / arrow / equality tail: operand boundary
    if (OPBoundaryChars.has(c)) break; // another comparator's tail or a bitwise op
    i--;
  }
  return src.slice(i + 1, from);
}
function walkRight(src, from) {
  let i = from;
  while (i < src.length) {
    const c = src[i];
    if (RHS_STOP.has(c)) break;
    if ((c === "&" && src[i + 1] === "&") || (c === "|" && src[i + 1] === "|")) break;
    if (c === "=" ) break; // assignment/arrow boundary
    i++;
  }
  return src.slice(from, i);
}

// Find every real comparison operator (skips =>, ==, ===, !=, <=, >= handled as ops,
// <<, >>, <<= ...). Returns [{index, op}].
export function findComparisons(src) {
  const ops = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c !== "<" && c !== ">") continue;
    const prev = i > 0 ? src[i - 1] : "";
    const next = src[i + 1] || "";
    if (c === "<" && (prev === "<" || prev === ">" || next === "<")) continue; // <<, <<, <>...
    if (c === ">" && (prev === "<" || prev === "=" || prev === ">" || next === ">")) continue; // =>, >>
    if (next === "=") { ops.push({ index: i, op: c + "=" }); i++; continue; } // <= or >=
    ops.push({ index: i, op: c });
  }
  return ops;
}

function lineColOf(src, index) {
  let line = 1;
  let lastNL = -1;
  for (let i = 0; i < index; i++) {
    if (src[i] === NL) { line++; lastNL = i; }
  }
  return { line, col: index - lastNL };
}

const collapse = (s) => s.replace(/\s+/g, " ").trim();

// True when a term that is not itself an epsilon carries one BURIED inside (a product,
// a parenthesized relative tolerance) -- the multiplicative/relative class, not a shape.
function termContainsEpsilonDeep(text) {
  return text
    .split(/[^A-Za-z0-9_.$]+/)
    .filter(Boolean)
    .some((tok) => classifyTerm(tok) === "epsilon");
}

const deepEps = (terms) => terms.some((t) => classifyTerm(t.text) === "other" && termContainsEpsilonDeep(t.text));

// Analyze one comparison occurrence. Returns:
//   { kind: "match", hit }            -- a classified shape
//   { kind: "bare" }                  -- bare-epsilon proximity guard (excluded)
//   { kind: "relative" }              -- multiplicative/relative tolerance (excluded)
//   { kind: "ambiguous" }             -- epsilon terms on BOTH sides (excluded)
//   { kind: "plain" }                 -- no epsilon term: plain comparator (out of scope)
export function analyzeComparison(src, index, op) {
  const lhsRaw = walkLeft(src, index);
  const rhsRaw = walkRight(src, index + op.length);
  const lhsTerms = splitTopLevel(lhsRaw);
  const rhsTerms = splitTopLevel(rhsRaw);
  const lhsEps = lhsTerms.filter((t) => classifyTerm(t.text) === "epsilon");
  const rhsEps = rhsTerms.filter((t) => classifyTerm(t.text) === "epsilon");
  if (lhsEps.length && rhsEps.length) return { kind: "ambiguous" };
  if (!lhsEps.length && !rhsEps.length) {
    // no top-level epsilon term: plain comparator -- unless an epsilon hides INSIDE a
    // term (relative/multiplicative tolerance, e.g. `inv > lca * (1 + tol)`), which is
    // excluded-and-counted so the census stays honest about what was screened.
    if (deepEps(lhsTerms) || deepEps(rhsTerms)) return { kind: "relative" };
    return { kind: "plain" };
  }
  const epsLeft = lhsEps.length > 0;
  const epsTerms = epsLeft ? lhsEps : rhsEps;
  const sideTerms = epsLeft ? lhsTerms : rhsTerms;
  if (sideTerms.length === 1) {
    // exactly one term, and it IS the epsilon -> proximity guard... unless the term only
    // CONTAINS an epsilon (a product), which is the relative-tolerance class.
    const only = sideTerms[0];
    return classifyTerm(only.text) === "epsilon" ? { kind: "bare" } : { kind: "relative" };
  }
  const epsTerm = epsTerms[0];
  let effOp = op;
  if (epsLeft) effOp = op === "<" ? ">" : op === ">" ? "<" : op === "<=" ? ">=" : "<=";
  const entry = SHAPE_TABLE[effOp + epsTerm.sign];
  if (!entry) return { kind: "plain" }; // unreachable over the total table; defensive
  const { line, col } = lineColOf(src, index);
  return {
    kind: "match",
    hit: {
      line,
      col,
      op: effOp,
      epsSign: epsTerm.sign,
      shape: entry.shape,
      flagged: entry.flagged,
      text: collapse(lhsRaw + " " + op + " " + rhsRaw),
      mirrored: epsLeft,
    },
  };
}

// Whole-source verdict: every flagged/matched shape plus the census counters.
export function verdictFor(src) {
  const stripped = stripCommentsAndStrings(src);
  const hits = [];
  const census = { comparisons: 0, plain: 0, bare: 0, relative: 0, ambiguous: 0, byShape: {} };
  for (const { index, op } of findComparisons(stripped)) {
    census.comparisons++;
    const r = analyzeComparison(stripped, index, op);
    if (r.kind === "match") {
      hits.push(r.hit);
      census.byShape[r.hit.shape] = (census.byShape[r.hit.shape] || 0) + 1;
    } else if (r.kind === "plain") census.plain++;
    else if (r.kind === "bare") census.bare++;
    else if (r.kind === "relative") census.relative++;
    else census.ambiguous++;
  }
  const flagged = hits.filter((h) => h.flagged);
  return { hits, flagged, census };
}

const SCOPE_GLOB = "chaingraph/kernels/*.kernel.mjs";

function scopeFiles() {
  const raw = gitSync(["ls-files", "-z", "--", SCOPE_GLOB], { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });
  return [...new Set(raw.split(String.fromCharCode(0)).filter(Boolean)
    .map((p) => p.split(String.fromCharCode(92)).join(String.fromCharCode(47)))
    .filter((p) => p.endsWith(".kernel.mjs")))].sort();
}

export function ratchetVerdict(counts, baseline) {
  const failures = [], improvements = [];
  const perFile = baseline.per_file;
  if (perFile === null || typeof perFile !== "object" || Array.isArray(perFile)) {
    failures.push("baseline per_file must be an object of {path: count} -- the per-file ceilings are missing or malformed");
    return { failures, improvements, total: 0 };
  }
  const pinnedFiles = new Set(baseline.files);
  for (const key of Object.keys(perFile)) {
    if (!pinnedFiles.has(key)) failures.push("baseline drift: per_file pins " + key + " but files does not list it -- re-pin with " + REPIN_COMMAND);
  }
  for (const key of pinnedFiles) {
    if (!Object.prototype.hasOwnProperty.call(perFile, key)) failures.push("baseline drift: files lists " + key + " but per_file has no ceiling for it -- re-pin with " + REPIN_COMMAND);
  }
  let total = 0;
  for (const rel of Object.keys(counts)) {
    const hits = counts[rel];
    total = total + hits.length;
    const pinned = Object.prototype.hasOwnProperty.call(perFile, rel)
      ? assertFiniteCeiling(perFile[rel], { label: BASELINE_LABEL, keyName: "per_file." + rel })
      : 0;
    if (hits.length > pinned) {
      failures.push(rel + ": " + (hits.length - pinned) + " NEW widening-strict epsilon shape(s) above the baseline pin (" + pinned + ")");
    } else if (hits.length < pinned) {
      improvements.push(rel + ": " + pinned + " -> " + hits.length + " -- the inversion left; re-pin with `" + REPIN_COMMAND + "`");
    }
  }
  for (const rel of pinnedFiles) {
    if (!counts[rel]) improvements.push(rel + ": clean (baseline entry can be dropped)");
  }
  const ceiling = assertFiniteCeiling(baseline.total, { label: BASELINE_LABEL, keyName: "total" });
  if (total > ceiling) failures.push("estate total " + total + " widening-strict hit(s) exceeds the pinned ceiling " + ceiling);
  else if (total < ceiling) improvements.push("estate total " + ceiling + " -> " + total);
  return { failures, improvements, total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const UPDATE = process.argv.includes("--update-baseline");
  const LIST = process.argv.includes("--list");
  const CENSUS = process.argv.includes("--census");
  const CHECK = process.argv.includes("--check");
  if (CHECK && UPDATE) {
    console.error("X lint-comparator-epsilon: --check and --update-baseline are mutually exclusive.");
    process.exit(1);
  }

  const files = scopeFiles();
  if (files.length === 0) {
    console.error("X lint-comparator-epsilon: scope enumeration returned ZERO files -- the gate examined nothing, which is not a pass (SO #34c).");
    process.exit(1);
  }

  const counts = {};
  const fileCensus = {};
  for (const rel of files) {
    const v = verdictFor(readFileSync(resolve(REPO, rel), "utf8"));
    fileCensus[rel] = v;
    if (v.flagged.length) counts[rel] = v.flagged;
  }
  const liveTotal = Object.values(counts).reduce((n, h) => n + h.length, 0);

  if (LIST) {
    for (const rel of Object.keys(counts)) for (const h of counts[rel]) {
      console.log(rel + ":" + h.line + ":" + h.col + "  " + h.shape + "  " + h.text);
    }
    console.log(NL + "lint-comparator-epsilon: " + liveTotal + " flagged widening-strict hit(s) across " + Object.keys(counts).length + " file(s) of " + files.length + " scanned.");
    process.exit(0);
  }

  if (CENSUS) {
    const agg = { comparisons: 0, plain: 0, bare: 0, relative: 0, ambiguous: 0, byShape: {} };
    for (const v of Object.values(fileCensus)) {
      agg.comparisons += v.census.comparisons;
      agg.plain += v.census.plain;
      agg.bare += v.census.bare;
      agg.relative += v.census.relative;
      agg.ambiguous += v.census.ambiguous;
      for (const [shape, n] of Object.entries(v.census.byShape)) agg.byShape[shape] = (agg.byShape[shape] || 0) + n;
    }
    console.log("lint-comparator-epsilon census -- " + files.length + " kernel file(s) scanned:");
    console.log("  comparison operators examined:      " + agg.comparisons);
    for (const shape of Object.values(SHAPES)) {
      const n = agg.byShape[shape] || 0;
      const tag = shape === SHAPES.WIDENING_STRICT ? "   <-- FLAGGED (art-234 inversion class, ratcheted)" : "";
      console.log("  " + shape.padEnd(22) + ": " + String(n).padStart(4) + tag);
    }
    console.log("  plain comparators (audit lane)  : " + agg.plain);
    console.log("  bare-epsilon proximity guards   : " + agg.bare + "  (excluded: zero-guards, not threshold boundaries)");
    console.log("  relative/multiplicative tolerances: " + agg.relative + "  (excluded: epsilon not additive with threshold)");
    console.log("  epsilon on both sides           : " + agg.ambiguous + "  (excluded: ambiguous)");
    const matched = Object.values(agg.byShape).reduce((a, b) => a + b, 0);
    console.log("  epsilon-screened mechanically   : " + (matched + agg.bare + agg.relative + agg.ambiguous) + " of " + agg.comparisons + "; remainder plain (semantics = audit lane)");
    process.exit(0);
  }

  if (UPDATE) {
    const prior = readBaselineForUpdate(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
    const per_file = {};
    for (const rel of Object.keys(counts)) per_file[rel] = counts[rel].length;
    const doc = {
      _comment: "COMPARATOR-EPSILON-LINT-1 ratchet pin: widening-strict epsilon shapes only (`> X - eps` / `< X + eps` -- a strict comparator whose epsilon widens the firing region across the boundary; the art-234 L106 inversion class). Tightening shapes are informational, widening-inclusive and plain comparators are census-only and never pinned. Counts only go DOWN: fix the comparator to match the regulation's strictness, then re-pin with " + REPIN_COMMAND + ". Loaded through the hard-failing scripts/ratchet-baseline.mjs: deleting this file REDS the gate. Pinned at ship time (2026-09-02): chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs L106 (the inversion named by the row: pp_pct > HOEPA_PP.max_pct_of_loan - 1e-5) AND L93 (same-file sibling, apr_spread > apr_threshold - 1e-5, found mechanically by this lint) -- the fix row owns both fixes; this instrument does not fix them. ⛔ NEVER grow this baseline to make the gate pass.",
      total: liveTotal,
      files: Object.keys(counts).sort(),
      per_file,
    };
    if (prior && liveTotal > prior.total) {
      console.error("X lint-comparator-epsilon --update-baseline REFUSED: this would raise the pinned ceiling " + prior.total + " -> " + liveTotal + ". A ratchet only moves down.");
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + NL);
    console.log("lint-comparator-epsilon: baseline pinned at " + liveTotal + " widening-strict hit(s) across " + doc.files.length + " file(s).");
    process.exit(0);
  }

  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
  const verdict = ratchetVerdict(counts, baseline);

  if (verdict.improvements.length) {
    console.log("lint-comparator-epsilon: " + verdict.improvements.length + " improvement(s) beat the baseline -- tighten with `" + REPIN_COMMAND + "`");
  }
  if (verdict.failures.length) {
    console.error(NL + "X lint-comparator-epsilon: " + verdict.failures.length + " FAILURE(s)" + NL + "  " + verdict.failures.join(NL + "  "));
    console.error(NL + "  A strict comparator widened by an epsilon fires AT the boundary where the regulation");
    console.error("  says it must not (the art-234 L106 inversion). Compare strictly against the unshifted");
    console.error("  threshold, or make the epsilon's sign match the regulation's inclusivity -- and let the");
    console.error("  fix row own the fix; this gate only refuses new debt.");
    process.exit(1);
  }
  console.log("lint-comparator-epsilon: OK (" + files.length + " file(s) scanned, " + baseline.total + " baselined widening-strict hit(s) within budget).");
}
