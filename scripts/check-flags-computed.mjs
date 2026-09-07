#!/usr/bin/env node
// check-flags-computed.mjs -- FLAGS-COMPUTED-LINT-1 (Tim popup GO 2026-08-30, [R51]).
//
// THE DEFECT: THREE independent Tier-1 engines shipped unconditional compliance_flags
// emissions -- the unearned-green attestation class. A flag that attests "X was computed /
// assessed / validated" and is emitted on EVERY run (including zero-input runs) is
// self-certification: qfa-04 L1652-57 literal constant array incl. FRTB_CVA_DESK_COMPUTED;
// qfa-03 L1706-07 bare top-level pushes (HISTORICAL_SCENARIO_MC_STRESS_COMPUTED);
// rca-01 L1673-79 constant array whose 'PLA_TEST_' + plaStatus degenerates to PLA_TEST_GREEN
// on zero-input runs. Byte-verified [R49]; the batch-3 rows fix their three -- this row
// builds the instrument and the ratchet.
//
// WHAT FIRES (static heuristic over chaingraph/kernels/*.kernel.mjs -- a compliance_flags /
// complianceFlags VALUE emitted unconditionally, per the row):
//   literal-array leg   a string/template/concat-literal element of an array literal
//                       assigned to a compliance flag variable that is never reassigned to a
//                       conditional construction (every such element is present on every
//                       run). Ternary elements are CONDITIONAL and never fire; spread/call/
//                       identifier elements are COMPUTED and never fire. Template literals
//                       fire WITH their interpolation: the emission is unconditional even
//                       where the interpolated text varies (the rca-01 'PLA_TEST_' +
//                       plaStatus shape).
//   object-true leg     a `<FLAG>: true` entry of an object literal assigned to a flag
//                       variable -- the flag is unconditionally on (SUMMA_MST_VERIFY_ONLY shape).
//   bare-push leg       a `<flagVar>.push(<literal>)` with no enclosing conditional -- not
//                       same-line-guarded (if/else/for/while/case/?:/&&/||) and not inside
//                       any if/else/for/while/switch/case/try/catch BLOCK (block frames are
//                       tracked from a string/comment-masked scan; function/arrow frames are
//                       neutral; braceless single-statement bodies are a stated limitation).
//   alias one-hop       `compliance_flags: flags` / `= flags` / `= [...new Set(flags)]` --
//                       the feeding identifier is resolved to its own declaration and its
//                       literal elements and push sites are analyzed the same way.
//   UNPARSEABLE         a flag construction the scanner cannot bound or resolve (unbindable
//                       literal, non-conditional reassignment, alias with no local
//                       declaration) is reported AS A HIT -- never a silent skip, never
//                       counted clean (SO #34c: absence is not a pass). Reassignment through
//                       .filter()/.map()/ternary, or a `= []` reset, is understood
//                       conditional and passes.
//
// WHAT NEVER FIRES: `= []` + conditionally-guarded pushes (the sim-03/rca-02 verified-computed
// shape -- both are live-byte GREEN controls in the paired selftest), ternary/spread/call
// constructions, pushes whose value is a bare computed identifier.
//
// BASELINE: scripts/flags-computed-baseline.json through the shared HARD-FAILING loader
// scripts/ratchet-baseline.mjs (RATCHET-BASELINE-LOADER-1). Counts only go DOWN; a hit above
// its file pin REDs; a cleaned file reports the improvement and the re-pin command. The three
// named engines are EXISTING hits here (baselined, not fixed in this row); the baseline
// shrinks as batch-3 lands.
//
// Fence: zero kernel bytes, zero shards, never a write to the assembled graph artifact.
//
// Usage:
//   node scripts/check-flags-computed.mjs                     # gate (preflight + CI)
//   node scripts/check-flags-computed.mjs --check             # alias
//   node scripts/check-flags-computed.mjs --list              # every hit
//   node scripts/check-flags-computed.mjs --update-baseline   # re-pin (counts only go down)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRatchetBaselineOrExit, readBaselineForUpdate, assertFiniteCeiling } from "./ratchet-baseline.mjs";
import { gitSync } from "./_git-env-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
export const BASELINE_PATH = resolve(HERE, "flags-computed-baseline.json");
export const REPIN_COMMAND = "node scripts/check-flags-computed.mjs --update-baseline";
const BASELINE_LABEL = "check-flags-computed";
const BASELINE_KEYS = ["total", { key: "files", type: "name-list" }];

export const NL = String.fromCharCode(10);
const DQ = String.fromCharCode(34);
const SQ = String.fromCharCode(39);
const BT = String.fromCharCode(96);
const BS = String.fromCharCode(92);
const SL = String.fromCharCode(47);
const ST = String.fromCharCode(42);

// ── maskSource ───────────────────────────────────────────────────────────────────────────
// Replace comment text and string/template CONTENT with spaces, preserving every offset and
// newline, so structural scanning (bracket depth, regex sites) never trips on prose, JSDoc,
// or flag names inside strings. Quote delimiters stay visible; template ${...} expressions
// stay UNMASKED (they are real code and their brackets count).
export function maskSource(src) {
  const out = src.split("");
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === NL) { i++; continue; }
    if (c === DQ || c === SQ) {
      const quote = c;
      i++;
      while (i < n) {
        if (src[i] === BS) { out[i] = " "; if (i + 1 < n) out[i + 1] = " "; i += 2; continue; }
        if (src[i] === NL) break;
        if (src[i] === quote) { i++; break; }
        out[i] = " ";
        i++;
      }
      continue;
    }
    if (c === BT) {
      i++;
      i = maskTemplateTail(src, out, i);
      continue;
    }
    if (c === SL && src[i + 1] === SL) {
      while (i < n && src[i] !== NL) { out[i] = " "; i++; }
      continue;
    }
    if (c === SL && src[i + 1] === ST) {
      out[i] = " "; out[i + 1] = " "; i += 2;
      while (i < n && !(src[i] === ST && src[i + 1] === SL)) { if (src[i] !== NL) out[i] = " "; i++; }
      if (i < n) { out[i] = " "; out[i + 1] = " "; i += 2; }
      continue;
    }
    i++;
  }
  return out.join("");
}
// Mask template-literal text until the closing backtick; a ${...} expression is kept
// UNMASKED (its brackets are real code) and scanned with its own depth counter; strings and
// nested templates inside the expression are masked by the same rules.
function maskTemplateTail(src, out, i) {
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === BS) { out[i] = " "; if (i + 1 < n) out[i + 1] = " "; i += 2; continue; }
    if (c === BT) { i++; return i; }
    if (c === NL) { i++; continue; }
    if (c === "$" && src[i + 1] === "{") {
      out[i] = " "; out[i + 1] = " "; i += 2;
      let d = 0;
      while (i < n) {
        const e = src[i];
        if (e === BS) { i += 2; continue; }
        if (e === DQ || e === SQ) {
          const q = e; i++;
          while (i < n) {
            if (src[i] === BS) { out[i] = " "; if (i + 1 < n) out[i + 1] = " "; i += 2; continue; }
            if (src[i] === q) { i++; break; }
            if (src[i] === NL) break;
            out[i] = " "; i++;
          }
          continue;
        }
        if (e === BT) { i++; i = maskTemplateTail(src, out, i); continue; }
        if (e === "{") d++;
        else if (e === "}") {
          if (d === 0) { out[i] = " "; i++; break; }
          d--;
        }
        i++;
      }
      continue;
    }
    out[i] = " ";
    i++;
  }
  return i;
}

// ── bracket / segment helpers (all on MASKED text) ───────────────────────────────────────
const OPENERS = "[({";
export function matchBracket(masked, openIdx) {
  if (!OPENERS.includes(masked[openIdx])) return -1;
  let d = 0;
  for (let i = openIdx; i < masked.length; i++) {
    const c = masked[i];
    if (c === "[" || c === "(" || c === "{") d++;
    else if (c === "]" || c === ")" || c === "}") {
      d--;
      if (d === 0) return i;
      if (d < 0) return -1;
    }
  }
  return -1;
}
// indices of top-level commas inside masked[a..b]
export function topLevelCommas(masked, a, b) {
  const out = [];
  let d = 0;
  for (let i = a; i <= b; i++) {
    const c = masked[i];
    if (c === "[" || c === "(" || c === "{") d++;
    else if (c === "]" || c === ")" || c === "}") d--;
    else if (c === "," && d === 0) out.push(i);
  }
  return out;
}

// ── literal-ness classification (on MASKED element text) ─────────────────────────────────
// Returns "unconditional" (a string/template/concat literal -- the flag is emitted every run,
// even where interpolated text varies), "conditional" (ternary / spread), or "computed"
// (identifier / call / arithmetic -- value comes from data).
export function classifyValueExpr(masked) {
  const t = masked.trim();
  if (!t) return null;
  if (t.startsWith("...")) return "conditional";
  let d = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "[" || c === "(" || c === "{") d++;
    else if (c === "]" || c === ")" || c === "}") d--;
    else if (c === "?" && d === 0) return "conditional";
  }
  if (t.startsWith("'") || t.startsWith(DQ) || t.startsWith(BT)) return "unconditional";
  // concat: at least one string/template chunk, remainder only identifiers/dots/plus/space
  const STRING_CHUNK = new RegExp(SQ + "[^\\n" + SQ + "]*" + SQ + "|" + DQ + "[^\\n" + DQ + "]*" + DQ + "|" + BT + "[^\\n" + BT + "]*" + BT, "g");
  const stripped = t.replace(STRING_CHUNK, " S ");
  if (/S/.test(stripped)) {
    const rest = stripped.split("S").join(" ");
    if (/^[+\w$.\s]+$/.test(rest) && /\w/.test(rest)) return "unconditional";
  }
  return "computed";
}

// ── block-frame timeline (on MASKED text) ────────────────────────────────────────────────
// Every { ... } region with a frame type: cond (if/else/for/while/switch/case/try/catch/do)
// vs neutral (fn/arrow/object/plain block). A push site inside any cond frame is
// data-dependent; fn frames are neutral (top-level-of-compute is unconditional by design).
export function buildFrames(masked) {
  const frames = [];
  const stack = [];
  let lastBoundary = 0; // index after the last top-level }, ; or { that closed a header context
  let parenDepth = 0;
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i];
    if (c === "(") parenDepth++;
    else if (c === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (c === "{") {
      stack.push({ open: i, header: masked.slice(lastBoundary, i) });
      lastBoundary = i + 1;
    } else if (c === "}") {
      const f = stack.pop();
      if (f) frames.push({ open: f.open, close: i, header: f.header });
      lastBoundary = i + 1;
    } else if (c === ";" && parenDepth === 0) {
      lastBoundary = i + 1;
    }
  }
  return frames;
}
export function frameType(header) {
  const h = header.replace(/\s+/g, " ").trim();
  if (!h) return "block";
  if (/(?:^|[\s};])else$/.test(h) || /^else\b/.test(h)) return "cond";
  if (/^(?:if|for|while|switch|case|catch|try|do)\b/.test(h)) return "cond";
  if (/(?:^|[\s};])(?:if|for|while|switch|catch)\s*\(/.test(h)) return "cond";
  if (/=>\s*$/.test(h) || /(?:^|[\s};])function\b/.test(h)) return "fn";
  return "block"; // object literals, plain blocks, return { ... }, class bodies
}
function insideConditionalFrame(frames, idx) {
  for (const f of frames) {
    if (f.open < idx && idx < f.close && frameType(f.header) === "cond") return true;
  }
  return false;
}

// True when the `name =` match at idx sits inside a destructuring pattern
// (`const { name = <default> } = ...`) -- a binding default, never a mid-flow write.
// Scan back to the first statement-boundary char; `{` there means destructuring.
function isDestructuringDefault(masked, idx) {
  for (let i = idx - 1, seen = 0; i >= 0 && seen < 400; i--, seen++) {
    const c = masked[i];
    if (/\s/.test(c) || c === ",") continue;
    return c === "{";
  }
  return false;
}

// True when the statement at idx is the BRACELESS body of a conditional -- the
// `if (cond)`-newline-`flags.push(...)` corpus style -- or continues a `&&`/`||`/`?`/`case:`
// guard from the previous line. Walks back over blank (masked) and header lines; a line
// containing `;` is a completed statement and stops the walk (qfa-03's bare pushes sit after
// a completed same-line-conditional push line and stay hits).
function underBracelessConditional(masked, idx) {
  let lineEnd = idx;
  for (let hop = 0; hop < 5; hop++) {
    const lineStart = masked.lastIndexOf(NL, Math.max(0, lineEnd - 1)) + 1;
    if (lineStart <= 0 && hop > 0) return false;
    const t = masked.slice(lineStart, lineEnd).replace(/\s+/g, " ").trim();
    if (t.length) {
      if (t.includes(";")) return false; // completed statement: not a dangling header
      if (/^}?\s*else$/.test(t)) return true;
      if (/(?:^|[\s}])(?:if|for|while|switch|catch)\s*\([^;{}]*\)$/.test(t)) return true;
      if (/\b(?:if|for|while|switch|catch)\s*\([^;{}]*$/.test(t)) return true; // condition still open
      if (t.endsWith("&&") || t.endsWith("||") || t.endsWith("?") || t.endsWith(":")) return true;
      return false; // a plain statement line: the push stands on its own
    }
    lineEnd = lineStart - 1;
    if (lineEnd < 0) return false;
  }
  return false;
}

function lineOf(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === NL) line++;
  return line;
}
function textAtLine(src, idx) {
  const a = src.lastIndexOf(NL, Math.max(0, idx - 1)) + 1;
  let b = src.indexOf(NL, idx);
  if (b === -1) b = src.length;
  return src.slice(a, b);
}

// ── the pure verdict ─────────────────────────────────────────────────────────────────────
// Scan one kernel file's source; return { hits: [{ kind, line, text }], red }.
export function verdictFor(src) {
  const hits = [];
  const masked = maskSource(src);
  const frames = buildFrames(masked);
  const pushHit = (kind, idx, text) => hits.push({ kind, line: lineOf(src, idx), text: String(text).replace(/\s+/g, " ").trim().slice(0, 110) });

  const SELF_NAMES = ["compliance_flags", "complianceFlags"];
  const builders = new Map(SELF_NAMES.map((n) => [n, { reassigned: null }]));
  const queuedAlias = new Set();
  const pendingAlias = [];
  const aliasSites = new Map();

  // Emit hits for every unconditional element of a bracketed literal assigned to `name`;
  // handle reassignment classification; queue one-hop aliases for non-literal RHS.
  function analyzeDecl(name, rhsStart) {
    const entry = builders.get(name) || { reassigned: null };
    const c = masked[rhsStart];
    if (c === "[" || c === "{") {
      const close = matchBracket(masked, rhsStart);
      if (close === -1) {
        pushHit("unparseable", rhsStart, name + " = <unbindable literal> -- scanner cannot bound it (SO #34c)");
        return;
      }
      const commas = topLevelCommas(masked, rhsStart + 1, close - 1);
      let a = rhsStart + 1;
      for (const b of [...commas, close]) {
        const rawEl = src.slice(a, b).trim();
        const maskedEl = masked.slice(a, b);
        if (c === "[") {
          if (classifyValueExpr(maskedEl) === "unconditional") pushHit("literal-array", a, name + " element emitted unconditionally: " + rawEl);
        } else {
          const kv = maskedEl.match(/([A-Za-z_$][\w$]*)\s*:\s*([\s\S]*)$/);
          if (kv && kv[2].trim() === "true") pushHit("object-true", a, name + " object entry always-on: " + rawEl);
        }
        a = b + 1;
      }
      // reassignment scan for this variable (the declaration's own = is skipped)
      const reRe = new RegExp("(?<![\\w$.])" + name.replace(/\$/g, "\\$") + "\\s*=(?![=>])", "g");
      let rm;
      let dropLiteral = false;
      while ((rm = reRe.exec(masked))) {
        const at = rm.index + rm[0].length; // just after '='
        // skip any DECLARATION's '=' (this one or a sibling `const compliance_flags = ...`
        // elsewhere in the file): scan back over whitespace; const/let/var there = binding
        let b = rm.index - 1;
        while (b >= 0 && /\s/.test(masked[b])) b--;
        if (/(?:const|let|var)$/.test(masked.slice(Math.max(0, b - 7), b + 1))) continue;
        if (isDestructuringDefault(masked, rm.index)) continue; // const { x = {} } = ... : a default, not a write
        const prev = masked[rm.index - 1];
        if (prev && "+-*/&|".includes(prev)) continue; // compound (+= etc): elements remain
        const line = textAtLine(masked, rm.index);
        let rs = at;
        while (rs < masked.length && /\s/.test(masked[rs])) rs++;
        const resetsEmpty = masked[rs] === "[" && masked.slice(rs, rs + 3).replace(/\s/g, "") === "[]";
        if (/\.filter\s*\(|\.map\s*\(|\?/.test(line) || resetsEmpty) { dropLiteral = true; continue; }
        pushHit("unparseable", rm.index, name + " reassigned mid-flow (non-conditional RHS) -- final content indeterminate (SO #34c)");
        dropLiteral = true;
      }
      if (dropLiteral) {
        entry.reassigned = "conditional";
        for (let i = hits.length - 1; i >= 0; i--) {
          if (hits[i].text.startsWith(name + " element emitted") || hits[i].text.startsWith(name + " object entry")) hits.splice(i, 1);
        }
      }
      return;
    }
    // non-literal RHS: extent to top-level ';' (bounded)
    let d = 0, j = rhsStart, end = -1;
    for (; j < masked.length && j - rhsStart < 4000; j++) {
      const cc = masked[j];
      if (cc === "[" || cc === "(" || cc === "{") d++;
      else if (cc === "]" || cc === ")" || cc === "}") { if (d === 0) { end = j; break; } d--; }
      else if (cc === ";" && d === 0) { end = j; break; }
    }
    if (end === -1) {
      pushHit("unparseable", rhsStart, name + " = <unbounded RHS> (SO #34c)");
      return;
    }
    const rhsMasked = masked.slice(rhsStart, end);
    if (classifyValueExpr(rhsMasked) === "conditional") return; // ternary construction
    const rhsTrim = rhsMasked.trim();
    const bareIdent = rhsTrim.match(/^([A-Za-z_$][\w$]*)$/);
    if (bareIdent) {
      queueAlias(bareIdent[1], rhsStart);
      return;
    }
    const spreadSrc = rhsTrim.match(/\.\.\.\s*([A-Za-z_$][\w$]*)/); // [...new Set(flags)] / [...flags]
    if (spreadSrc) { queueAlias(spreadSrc[1], rhsStart); return; }
    const callIdent = rhsTrim.match(/^(?:new\s+|Object\s*\.\s*)?[\w$.]+\s*\(/); // call construction: computed
    if (callIdent) return;
    const dotted = rhsTrim.match(/^[\w$.]+$/); // bare dotted chain (e.g. result.flags)
    if (dotted) { queueAlias(rhsTrim.split(".").pop(), rhsStart); return; }
    // anything else: computed construction (arithmetic, template expr, ...), pass
  }

  function queueAlias(name, siteIdx) {
    if (SELF_NAMES.includes(name)) return;
    if (queuedAlias.has(name)) { aliasSites.get(name).push(siteIdx); return; }
    queuedAlias.add(name);
    aliasSites.set(name, [siteIdx]);
    pendingAlias.push(name);
  }

  // pass 1: declarations of the compliance-named variables
  const DECL_RE = /(?:^|[^\w$.])(?:const|let|var)\s+(compliance_flags|complianceFlags)\s*=\s*/g;
  let m;
  while ((m = DECL_RE.exec(masked))) {
    let rs = m.index + m[0].length;
    while (rs < masked.length && /\s/.test(masked[rs])) rs++;
    analyzeDecl(m[1], rs);
  }

  // pass 2: compliance_flags: <value> sites (object members / returns)
  const COLON_RE = /(?<![\w$.])compliance_flags\s*:\s*/g;
  while ((m = COLON_RE.exec(masked))) {
    let vs = m.index + m[0].length;
    while (vs < masked.length && /\s/.test(masked[vs])) vs++;
    const c = masked[vs];
    let end;
    if (c === "[" || c === "{") {
      end = matchBracket(masked, vs);
      if (end === -1) { pushHit("unparseable", vs, "compliance_flags: <unbindable literal> (SO #34c)"); continue; }
    } else {
      // value extent: to top-level ',' '}' or ')'
      let dd = 0, k = vs;
      while (k < masked.length) {
        const cc = masked[k];
        if (cc === "[" || cc === "(" || cc === "{") dd++;
        else if (cc === "]" || cc === ")" || cc === "}") { if (dd === 0) break; dd--; }
        else if ((cc === "," || cc === "}" || cc === ")") && dd === 0) break;
        k++;
      }
      end = k - 1;
      if (end < vs) end = vs;
    }
    const valueMasked = masked.slice(vs, end + 1);
    const valueRaw = src.slice(vs, end + 1).trim();
    const ident = valueMasked.trim().match(/^([A-Za-z_$][\w$]*)$/);
    if (ident) { queueAlias(ident[1], vs); continue; }
    if (c === "[") {
      if (insideConditionalFrame(frames, vs)) continue;
      const commas = topLevelCommas(masked, vs + 1, end - 1);
      let a = vs + 1;
      for (const b of [...commas, end]) {
        if (classifyValueExpr(masked.slice(a, b)) === "unconditional") pushHit("literal-array", a, "compliance_flags element emitted unconditionally: " + src.slice(a, b).trim());
        a = b + 1;
      }
    } else if (c === "'" || c === DQ || c === BT) {
      if (insideConditionalFrame(frames, vs)) continue;
      if (classifyValueExpr(valueMasked) === "unconditional") pushHit("literal-array", vs, "compliance_flags emitted unconditionally: " + valueRaw);
    } else if (c === "{") {
      if (insideConditionalFrame(frames, vs)) continue;
      const commas = topLevelCommas(masked, vs + 1, end - 1);
      let a = vs + 1;
      for (const b of [...commas, end]) {
        const kv = masked.slice(a, b).match(/([A-Za-z_$][\w$]*)\s*:\s*([\s\S]*)$/);
        if (kv && kv[2].trim() === "true") pushHit("object-true", a, "compliance_flags object entry always-on: " + src.slice(a, b).trim());
        a = b + 1;
      }
    } else if (classifyValueExpr(valueMasked) === null) {
      pushHit("unparseable", vs, "compliance_flags: <unclassifiable value> " + valueRaw.slice(0, 60) + " (SO #34c)");
    }
    // conditional / computed inline values pass
  }

  // pass 3: resolve queued aliases one hop (their declarations feed compliance_flags)
  let guard = 0;
  while (pendingAlias.length && guard++ < 16) {
    const name = pendingAlias.shift();
    const re = new RegExp("(?:^|[^\\w$.])(?:const|let|var)\\s+" + name.replace(/\$/g, "\\$") + "\\s*=\\s*", "g");
    if (!builders.has(name)) builders.set(name, { reassigned: null });
    let am;
    let found = false;
    while ((am = re.exec(masked))) {
      found = true;
      let rs = am.index + am[0].length;
      while (rs < masked.length && /\s/.test(masked[rs])) rs++;
      analyzeDecl(name, rs);
    }
    if (!found) {
      for (const site of aliasSites.get(name) || [0]) {
        pushHit("unparseable", site, "flag feeder '" + name + "' has no local declaration (parameter/import) -- construction not statically visible (SO #34c)");
      }
    }
  }

  // pass 4: push sites on every builder (self-named + resolved feeders)
  for (const [name, entry] of builders) {
    void entry;
    const re = new RegExp("(?<![\\w$.])" + name.replace(/\$/g, "\\$") + "\\s*\\.\\s*push\\s*\\(", "g");
    let pm;
    while ((pm = re.exec(masked))) {
      const callOpen = pm.index + pm[0].length - 1;
      const callClose = matchBracket(masked, callOpen);
      if (callClose === -1) { pushHit("unparseable", pm.index, name + ".push(<unbindable args>) (SO #34c)"); continue; }
      const argsMasked = masked.slice(callOpen + 1, callClose);
      if (topLevelCommas(masked, callOpen + 1, callClose - 1).length !== 0) continue; // multi-arg: not a single literal flag
      if (classifyValueExpr(argsMasked) !== "unconditional") continue; // computed/conditional value
      const lineStart = src.lastIndexOf(NL, pm.index) + 1;
      const before = masked.slice(lineStart, pm.index);
      if (/\b(?:if|else|for|while|case)\b/.test(before) || /\?|&&|\|\|/.test(before)) continue; // same-line guard
      if (underBracelessConditional(masked, lineStart)) continue; // braceless conditional body
      if (insideConditionalFrame(frames, pm.index)) continue; // enclosing conditional block
      pushHit("bare-push", pm.index, name + ".push emitted with no enclosing conditional: " + src.slice(callOpen + 1, callClose).trim());
    }
  }

  hits.sort((x, y) => x.line - y.line || x.kind.localeCompare(y.kind));
  const dedup = [];
  for (const h of hits) {
    if (!dedup.some((g) => g.kind === h.kind && g.line === h.line && g.text === h.text)) dedup.push(h);
  }
  return { hits: dedup, red: dedup.length > 0 };
}

const SCOPE_GLOB = "chaingraph/kernels/*.kernel.mjs";

function scopeFiles() {
  const raw = gitSync(["ls-files", "-z", "--", SCOPE_GLOB], { cwd: REPO, maxBuffer: 32 * 1024 * 1024 });
  return [...new Set(raw.split(String.fromCharCode(0)).filter(Boolean).map((p) => p.split(String.fromCharCode(92)).join(String.fromCharCode(47))))]
    .filter((p) => p.endsWith(".kernel.mjs")).sort();
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
    const hitList = counts[rel];
    total = total + hitList.length;
    const pinned = Object.prototype.hasOwnProperty.call(perFile, rel)
      ? assertFiniteCeiling(perFile[rel], { label: BASELINE_LABEL, keyName: "per_file." + rel })
      : 0;
    if (hitList.length > pinned) {
      failures.push(rel + ": " + (hitList.length - pinned) + " NEW unconditional flag emission(s) above the baseline pin (" + pinned + ")");
    } else if (hitList.length < pinned) {
      improvements.push(rel + ": " + pinned + " -> " + hitList.length + " -- make the emission conditional, then re-pin with `" + REPIN_COMMAND + "`");
    }
  }
  for (const rel of pinnedFiles) {
    if (!counts[rel]) improvements.push(rel + ": clean (baseline entry can be dropped)");
  }
  const ceiling = assertFiniteCeiling(baseline.total, { label: BASELINE_LABEL, keyName: "total" });
  if (total > ceiling) failures.push("estate total " + total + " unconditional flag emission(s) exceeds the pinned ceiling " + ceiling);
  else if (total < ceiling) improvements.push("estate total " + ceiling + " -> " + total);
  return { failures, improvements, total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const UPDATE = process.argv.includes("--update-baseline");
  const LIST = process.argv.includes("--list");
  const CHECK = process.argv.includes("--check");
  if (CHECK && UPDATE) {
    console.error("X check-flags-computed: --check and --update-baseline are mutually exclusive.");
    process.exit(1);
  }

  const files = scopeFiles();
  if (files.length === 0) {
    console.error("X check-flags-computed: scope enumeration returned ZERO kernel files -- the gate examined nothing, which is not a pass (SO #34c).");
    process.exit(1);
  }

  const counts = {};
  for (const rel of files) {
    const v = verdictFor(readFileSync(resolve(REPO, rel), "utf8"));
    if (v.red) counts[rel] = v.hits.map((h) => h.kind + " @line " + h.line + ": " + h.text);
  }
  const liveTotal = Object.values(counts).reduce((n, h) => n + h.length, 0);

  if (LIST) {
    for (const rel of Object.keys(counts)) for (const h of counts[rel]) console.log(rel + "  " + h);
    console.log(NL + "check-flags-computed: " + liveTotal + " hit(s) across " + Object.keys(counts).length + " kernel(s) of " + files.length + " scanned.");
    process.exit(0);
  }

  if (UPDATE) {
    const prior = readBaselineForUpdate(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
    const per_file = {};
    for (const rel of Object.keys(counts)) per_file[rel] = counts[rel].length;
    const doc = {
      _comment: "FLAGS-COMPUTED-LINT-1 ratchet pin: compliance_flags values emitted UNCONDITIONALLY (literal constant arrays, always-on object entries, bare pushes with no enclosing conditional) -- the unearned-green attestation class (qfa-04/qfa-03/rca-01, Tim popup GO 2026-08-30). Counts only go DOWN: make the emission conditional, then re-pin with node scripts/check-flags-computed.mjs --update-baseline. The three named engines are baselined here; the batch-3 rows fix them and the baseline shrinks. Loaded through the hard-failing scripts/ratchet-baseline.mjs: deleting this file REDS the gate.",
      total: liveTotal,
      files: Object.keys(counts).sort(),
      per_file,
    };
    if (prior) {
      let regression = null;
      for (const rel of Object.keys(prior.per_file || {})) {
        const live = (counts[rel] || []).length;
        if (live > prior.per_file[rel]) regression = rel + ": " + live + " live vs pin " + prior.per_file[rel];
      }
      if (regression) {
        console.error("X check-flags-computed --update-baseline REFUSED: a pinned file GAINED hits -- a real regression.");
        console.error("  " + regression);
        console.error("  A ratchet only moves down; make the emission conditional instead.");
        process.exit(1);
      }
      const newFiles = Object.keys(counts).filter((rel) => !prior.per_file || !Object.prototype.hasOwnProperty.call(prior.per_file, rel));
      if (newFiles.length) console.log("check-flags-computed: absorbing " + newFiles.length + " newly-landed kernel(s) into the baseline (estate growth, disclosed): " + newFiles.join(", "));
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + NL);
    console.log("check-flags-computed: baseline pinned at " + liveTotal + " hit(s) across " + doc.files.length + " file(s).");
    process.exit(0);
  }

  const baseline = loadRatchetBaselineOrExit(BASELINE_PATH, BASELINE_KEYS, { label: BASELINE_LABEL, repinCommand: REPIN_COMMAND });
  const verdict = ratchetVerdict(counts, baseline);

  if (verdict.improvements.length) {
    console.log("check-flags-computed: " + verdict.improvements.length + " improvement(s) beat the baseline -- tighten with `" + REPIN_COMMAND + "`");
  }
  if (verdict.failures.length) {
    console.error(NL + "X check-flags-computed: " + verdict.failures.length + " FAILURE(s)" + NL + "  " + verdict.failures.join(NL + "  "));
    console.error(NL + "  A compliance_flags value emitted unconditionally attests work nothing conditioned --");
    console.error("  the unearned-green class: FRTB_CVA_DESK_COMPUTED fires on zero-input runs. The sanctioned");
    console.error("  form is a conditional emission (push behind the branch that earns the flag, or a ternary");
    console.error("  element). Existing hits are baselined; new ones are refused.");
    process.exit(1);
  }
  console.log("check-flags-computed: OK (" + files.length + " kernel(s) scanned, " + baseline.total + " baselined hit(s) within budget).");
}
