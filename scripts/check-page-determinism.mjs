// check-page-determinism.mjs — non-determinism REACHING the execution_hash preimage
// on a node/tool PAGE.
//
// WHY THIS EXISTS, AND WHY IT IS A SIBLING RATHER THAN AN EXTENSION.
// `check-kernel-determinism.mjs` bans locale/time/random constructs ANYWHERE in a
// kernel file, and it has been in preflight since 2026-07-02. Its own header names
// art-09's toLocaleString() as its proof-of-value — and art-09's KERNEL was fixed
// while art-09's PAGE was not. The kernel gate cannot see that: it never reads a
// page, and its whole-file test cannot be pointed at one.
//
// ⛔ A WHOLE-FILE BAN IS WRONG FOR A PAGE. Pages legitimately call toLocaleString(),
// Intl and new Date() to RENDER results, and that is not a defect. Ported verbatim a
// page gate would flag hundreds of display calls, be switched off as noise, and leave
// the estate worse than before.
//
// ✅ THE TEST IS REACHABILITY INTO THE PREIMAGE. `execution_hash` is taken over
// `{policy_parameters, output_payload}` (SPEC §18.0 / kernels/_hash.mjs). A banned
// construct is a DEFECT only if its value can reach one of those two objects. A value
// that reaches only `_lastResult`, the artifact envelope (`generated_at`), the DOM, or
// a download filename is OUTSIDE the preimage and is deliberately NOT flagged.
//
// THE BAN LIST IS NOT DUPLICATED. It is imported from check-kernel-determinism.mjs,
// which is its single source. Adding a construct there covers both surfaces at once.
//
// HOW REACHABILITY IS DECIDED. The page's `output_payload` / `policy_parameters`
// literals are resolved with the same tiering the surface-parity gate uses, then the
// gate walks OUTWARD from them: every identifier referenced from inside the payload is
// followed to its own declaration (an object literal, an array literal, a plain
// expression, or the `return` of a page-local function), member-narrowed where the
// reference was `ident.member`, and scanned in turn. Depth is bounded; the bound is
// REPORTED, never silently swallowed.
//
// SPREADS ARE LOWER BOUNDS (GATE-SPREAD-OPAQUE-1, PR #719). `{...core, x}` shows only
// part of its member set. The core is resolved one hop where it can be followed and
// walked like any other span; where it CANNOT be followed the page is reported
// UNRESOLVED. ⛔ Silence is not a pass: an unresolvable page is never counted clean.
//
// BASELINE + DOWNWARD RATCHET, exactly as the kernel gate does it. Pre-existing page
// defects live in page-determinism-baseline.json and WARN. A defect not in the
// baseline FAILS. Removing a baseline entry is always safe; adding one is a
// deliberate human decision.
//
// WIRING: preflight.mjs, WARN-ONLY (`--warn-only`). It reports and always exits 0
// there, so a pre-existing condition can never red `main`. Run without the flag
// (`node scripts/check-page-determinism.mjs`) for the blocking form, which is what a
// remediation wave should use.
//
// Usage:
//   node scripts/check-page-determinism.mjs                 # gate (exit 1 on new defect)
//   node scripts/check-page-determinism.mjs --warn-only     # preflight form (always exit 0)
//   node scripts/check-page-determinism.mjs --json
//   node scripts/check-page-determinism.mjs --only art-09-dora-incident-classifier

import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HARD_BANS, stripCommentsLine } from "./check-kernel-determinism.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CG = resolve(ROOT, "chaingraph");
const TOOLS = resolve(ROOT, "tools");
const flagValue = (name) => {
  const i = process.argv.slice(2).findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (i === -1) return null;
  const a = process.argv.slice(2)[i];
  return a.includes("=") ? a.split("=").slice(1).join("=") : process.argv.slice(2)[i + 1] || null;
};

// `--baseline` / `--file` exist so the gate's own controls can be FIXTURES rather
// than live pages. A control pinned to `art-09` dies the day art-09 is fixed,
// and a gate whose proof-of-correctness expired is a gate nobody can trust.
const BASELINE_PATH = resolve(flagValue("--baseline") || resolve(HERE, "page-determinism-baseline.json"));
const FILES = (flagValue("--file") || "").split(",").filter(Boolean).map((f) => resolve(f));

const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
const WARN_ONLY = argv.includes("--warn-only");
const WRITE_BASELINE = argv.includes("--write-baseline");
const onlyIdx = argv.findIndex((a) => a === "--only" || a.startsWith("--only="));
const ONLY =
  onlyIdx === -1
    ? null
    : new Set(
        (argv[onlyIdx].includes("=") ? argv[onlyIdx].split("=")[1] : argv[onlyIdx + 1] || "")
          .split(",")
          .filter(Boolean),
      );

// Real pages chain deep: `output_payload` -> a builder -> a getter -> a coercer.
// 6 hops cut hundreds of chains short (a reported blind spot, but a blind spot);
// 12 reaches the end of essentially all of them. The cap is kept — and REPORTED
// when hit — because an unbounded walk on a mutually-recursive page would not
// terminate.
const MAX_DEPTH = 12;

// Per-page memo: the same identifier is asked for from many chains, and each
// lookup is a full-page regex scan.
let CACHE = { rhs: new Map(), fns: new Map() };

/* ------------------------------------------------------------------ *
 * JS source scanning primitives. Copied deliberately from
 * check-node-surface-parity.mjs rather than imported: that file is a gate with
 * top-level side effects, importing it would RUN it, and it is outside this
 * row's fence. The site repo is zero-dep (CONTRACT §0) so no parser is
 * available; ~40 gates are hand-rolled the same way.
 * ------------------------------------------------------------------ */
// A view of the page in which everything OUTSIDE <script> is blanked to spaces,
// newlines preserved so every offset and line number still matches the file.
//
// ⛔ WITHOUT THIS THE WALK LEAVES JAVASCRIPT ENTIRELY. A page is HTML, and
// `rhsSpans` looks for `ident =`, which markup is full of: `id="x"`,
// `style="..."`, `name="..."`, `onclick="..."`. Following those produced chains
// like `policy_parameters -> _records.filter -> id -> onclick -> style` that
// ended in the signing/download helper — i.e. exactly the download-filename
// timestamp that is OUTSIDE the preimage and must never be reported.
function scriptOnlyView(html) {
  const out = new Array(html.length).fill(null);
  const re = /<script\b[^>]*>/gi;
  let m;
  const keep = [];
  while ((m = re.exec(html))) {
    const start = m.index + m[0].length;
    const close = html.toLowerCase().indexOf("</script>", start);
    keep.push([start, close === -1 ? html.length : close]);
  }
  let k = 0;
  for (let i = 0; i < html.length; i++) {
    while (k < keep.length && i >= keep[k][1]) k++;
    const inside = k < keep.length && i >= keep[k][0] && i < keep[k][1];
    out[i] = inside ? html[i] : html[i] === "\n" ? "\n" : " ";
  }
  return out.join("");
}

// A second view in which STRING AND TEMPLATE CONTENTS and comments are blanked,
// offsets and lines again preserved. Every structural regex runs on this view.
//
// ⛔ WITHOUT IT, PROSE IS READ AS CODE. art-01 renders
// `` `Type errors: intent="${intent.mandate_type}" ...` `` — and `intent="` matches
// an assignment, so the "declaration" of `intent` began mid-template and its
// expression span ran on for 400 lines, swallowing the fixture blob and the signing
// helper. Seven reported defects on that page were that one mis-parse.
// Value scanning and reference extraction still use the REAL text, because a
// banned call inside a `${...}` substitution is a genuine defect (art-09).
// `keepTemplates: true` masks only '...' and "..." bodies, leaving backtick
// templates (and therefore their ${...} substitutions) intact — the view the
// VALUE scan uses. Default masks every literal — the view STRUCTURE uses.
function maskLiterals(js, keepTemplates = false) {
  const out = js.split("");
  let i = 0;
  while (i < js.length) {
    const c = js[i];
    if (c === "`" && keepTemplates) {
      // Mask the literal chunks of the template, keep every ${...} substitution.
      const end = skipString(js, i);
      let k = i + 1;
      while (k < end - 1) {
        if (js[k] === "\\") { if (out[k] !== "\n") out[k] = " "; if (out[k + 1] !== "\n") out[k + 1] = " "; k += 2; continue; }
        if (js[k] === "$" && js[k + 1] === "{") {
          const sub = matchBracket(js, k + 1);
          k = sub > 0 ? sub : k + 2;
          continue;
        }
        if (out[k] !== "\n") out[k] = " ";
        k++;
      }
      i = end;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      const end = skipString(js, i);
      for (let k = i + 1; k < end - 1 && k < js.length; k++) if (out[k] !== "\n") out[k] = " ";
      i = end;
      continue;
    }
    if (c === "/" && (js[i + 1] === "/" || js[i + 1] === "*")) {
      const end = skipTrivia(js, i);
      for (let k = i; k < end && k < js.length; k++) if (out[k] !== "\n") out[k] = " ";
      i = end;
      continue;
    }
    i++;
  }
  return out.join("");
}

function skipString(src, i) {
  const q = src[i];
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { i += 2; continue; }
    if (c === q) return i + 1;
    if (q === "`" && c === "$" && src[i + 1] === "{") {
      let d = 1;
      i += 2;
      while (i < src.length && d > 0) {
        const ch = src[i];
        if (ch === "'" || ch === '"' || ch === "`") { i = skipString(src, i); continue; }
        if (ch === "{") d++;
        else if (ch === "}") d--;
        i++;
      }
      continue;
    }
    i++;
  }
  return i;
}

function skipTrivia(src, i) {
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (src[i] === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    return i;
  }
}

// Given the index of an opening bracket, return the index just past its match.
function matchBracket(src, open) {
  const OPEN = { "{": "}", "[": "]", "(": ")" }[src[open]];
  if (!OPEN) return -1;
  let i = open, d = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === "`") { i = skipString(src, i); continue; }
    if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) { i = skipTrivia(src, i); continue; }
    if (c === "{" || c === "[" || c === "(") d++;
    else if (c === "}" || c === "]" || c === ")") { d--; if (d === 0) return i + 1; }
    i++;
  }
  return -1;
}
const matchBrace = matchBracket;

/* ------------------------------------------------------------------ *
 * Object literal members, WITH THE SPAN OF EACH VALUE.
 *
 * The parity gate needs member NAMES; this gate needs the source text each
 * member's value is built from, because that text is what a banned construct
 * hides in. `spreads` carries the identifiers of resolvable spreads out so the
 * caller can follow them; `opaqueNonSpread` marks opacity that no amount of
 * following can fix (computed key, spread of a call/ternary), which is what
 * makes a page UNRESOLVED rather than clean.
 * ------------------------------------------------------------------ */
function objectMembers(lit) {
  const members = [];   // { key, start, end }  offsets relative to `lit`
  const spreads = [];
  let opaqueNonSpread = false;
  let opaque = false;
  let i = 1;
  let expectKey = true;
  let lastKey = null;
  let keyStart = -1;
  let d = 1;
  const closeMember = (end) => {
    if (lastKey !== null && keyStart >= 0) members.push({ key: lastKey, start: keyStart, end });
    lastKey = null;
    keyStart = -1;
  };
  while (i < lit.length) {
    i = skipTrivia(lit, i);
    if (i >= lit.length) break;
    const c = lit[i];
    if (expectKey && d === 1) {
      if (c === "}") break;
      if (c === ",") { i++; continue; }
      if (c === "." && lit[i + 1] === "." && lit[i + 2] === ".") {
        opaque = true;
        const sm = /^\s*([A-Za-z_$][\w$]*)\s*(?=[,}])/.exec(lit.slice(i + 3));
        if (sm) spreads.push(sm[1]);
        else opaqueNonSpread = true;
        expectKey = false;
        i += 3;
        continue;
      }
      if (c === "[") { opaque = true; opaqueNonSpread = true; expectKey = false; i++; d++; continue; }
      if (c === "'" || c === '"') {
        const end = skipString(lit, i);
        lastKey = lit.slice(i + 1, end - 1);
        i = end;
        expectKey = false;
        const j = skipTrivia(lit, i);
        keyStart = lit[j] === ":" ? skipTrivia(lit, j + 1) : i;
        continue;
      }
      const m = /^(?:async\s+)?(?:\*\s*)?(?:(?:get|set)\s+)?([A-Za-z_$][\w$]*)/.exec(lit.slice(i));
      if (m && m[1]) {
        lastKey = m[1];
        const keyTokenStart = i;
        i += m[0].length;
        expectKey = false;
        const j = skipTrivia(lit, i);
        // `key: <value>` -> value span; `{ key }` shorthand -> the key token IS
        // the value expression, and following it is exactly how art-09's
        // `return {..., criteria, ...}` reaches its array literal.
        keyStart = lit[j] === ":" ? skipTrivia(lit, j + 1) : keyTokenStart;
        continue;
      }
      opaque = true;
      opaqueNonSpread = true;
      expectKey = false;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") { i = skipString(lit, i); continue; }
    if (c === "/" && (lit[i + 1] === "/" || lit[i + 1] === "*")) { i = skipTrivia(lit, i); continue; }
    if (c === "{" || c === "[" || c === "(") { d++; i++; continue; }
    if (c === "}" || c === "]" || c === ")") {
      d--;
      if (d === 0) { closeMember(i); break; }
      i++;
      continue;
    }
    if (c === "," && d === 1) { closeMember(i); expectKey = true; i++; continue; }
    i++;
  }
  return { members, spreads, opaque, opaqueNonSpread };
}

/* ------------------------------------------------------------------ *
 * Declaration / assignment resolution.
 * ------------------------------------------------------------------ */

// End of an expression starting at `start`: the first top-level `;` or `,`
// or the closing bracket of the enclosing construct.
function exprEnd(src, start) {
  let i = start, d = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === "`") { i = skipString(src, i); continue; }
    if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) { i = skipTrivia(src, i); continue; }
    if (c === "{" || c === "[" || c === "(") { d++; i++; continue; }
    if (c === "}" || c === "]" || c === ")") { if (d === 0) return i; d--; i++; continue; }
    if (d === 0 && (c === ";" || c === ",")) return i;
    if (d === 0 && c === "\n") {
      // A newline ends the expression only if the next non-trivia char cannot
      // continue it (ASI-ish). Keeps `a =\n  b ? c\n  : d` in one span.
      const j = skipTrivia(src, i);
      if (j >= src.length) return i;
      if (!/[.?:+\-*/%&|,)\]}=<>]/.test(src[j]) && !/^(?:\?\?|&&|\|\|)/.test(src.slice(j, j + 2))) return i;
    }
    i++;
  }
  return i;
}

// Every RHS span assigned to `ident` in the page: `const x = <e>`, `x = <e>`,
// and the second-and-later declarator of a comma-continued statement
// (`var rows = [], extra = {}` — art-332).
//
// ⚠ AMBIGUITY IS REPORTED, NOT GUESSED. A page has no scope analysis available
// here, so a name DECLARED more than once (`const ts = ...` inside three
// different export helpers — art-09) does not identify one value. Following all
// of them manufactures defects from code the payload never touches, which is the
// exact noise that gets a gate switched off. Such a name is skipped and named as
// a blind spot instead. A name declared at most once is unambiguous, so every
// write to it (`let _result = null` then `_result = runClassification(...)`)
// belongs to the same binding and is followed.
function rhsSpans(html, ident) {
  if (CACHE.rhs.has(ident)) return CACHE.rhs.get(ident);
  const out = rhsSpansUncached(html, ident);
  CACHE.rhs.set(ident, out);
  return out;
}

function rhsSpansUncached(html, ident) {
  const esc = ident.replace(/\$/g, "\\$");
  const decls = [];
  const assigns = [];
  const re = new RegExp(`(?:^|[^.\\w$])((?:const|let|var)\\s+)?${esc}\\s*=(?!=)`, "g");
  for (const m of html.matchAll(re)) {
    // `x == y` / `x => y` are not assignments.
    if (html[m.index + m[0].length] === ">") continue;
    const start = skipTrivia(html, m.index + m[0].length);
    const end = exprEnd(html, start);
    if (end <= start) continue;
    (m[1] ? decls : assigns).push({ start, end });
  }
  // `, ident = {` continuation declarator
  for (const m of html.matchAll(new RegExp(`,\\s*${esc}\\s*=(?!=)`, "g"))) {
    const start = skipTrivia(html, m.index + m[0].length);
    const end = exprEnd(html, start);
    if (end > start && !decls.some((d) => d.start === start)) decls.push({ start, end });
  }
  if (decls.length > 1) return { spans: [], ambiguous: true };
  return { spans: [...decls, ...assigns], ambiguous: false };
}

// `function NAME(...) { ... }` bodies, plus `NAME = function(...) {}` /
// `const NAME = (...) => { ... }`.
function functionBodies(html, name) {
  if (CACHE.fns.has(name)) return CACHE.fns.get(name);
  const out = functionBodiesUncached(html, name);
  CACHE.fns.set(name, out);
  return out;
}

function functionBodiesUncached(html, name) {
  const esc = name.replace(/\$/g, "\\$");
  const out = [];
  const pats = [
    new RegExp(`function\\s+${esc}\\s*\\([^)]*\\)\\s*\\{`, "g"),
    new RegExp(`(?:(?:const|let|var)\\s+)?${esc}\\s*=\\s*(?:async\\s+)?function\\s*\\*?\\s*[A-Za-z_$\\w]*\\s*\\([^)]*\\)\\s*\\{`, "g"),
    // `const fmtDt = (ms) => {` and the bare-parameter form `const fmtDt = ms => {`
    new RegExp(`(?:(?:const|let|var)\\s+)?${esc}\\s*=\\s*(?:async\\s+)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>\\s*\\{`, "g"),
  ];
  for (const p of pats) {
    for (const m of html.matchAll(p)) {
      const open = m.index + m[0].length - 1;
      const end = matchBrace(html, open);
      if (end > 0) out.push({ start: open, end });
    }
  }
  return out;
}

// Brace-bodied functions nested INSIDE a span (closures, callbacks, arrows).
function nestedBodies(html, span) {
  const text = html.slice(span.start, span.end);
  const out = [];
  const pats = [
    /function\s*[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/g,
    /function\s*\([^)]*\)\s*\{/g,
    /(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g,
  ];
  for (const p of pats) {
    for (const m of text.matchAll(p)) {
      const open = span.start + m.index + m[0].length - 1;
      if (open === span.start) continue; // the span's own body
      const end = matchBrace(html, open);
      if (end > 0) out.push({ start: open, end });
    }
  }
  return out;
}

// `return <expr>` spans of a function body.
//
// ⚠ RETURNS OF NESTED CLOSURES ARE NOT THIS FUNCTION'S RETURNS. art-09 declares
// `fmtDt`, `minutesUntil` and `relativeLabel` INSIDE runClassification(); counting
// their returns as runClassification's made the gate report the wall-clock
// `relative:` label as payload-reachable when the payload carries only
// `datetime_str`. Over-reporting is not a safe default here: noise is what gets a
// gate switched off.
function returnSpans(html, body) {
  const text = html.slice(body.start, body.end);
  const nested = nestedBodies(html, body);
  const out = [];
  for (const m of text.matchAll(/\breturn\b/g)) {
    const at = body.start + m.index;
    if (nested.some((n) => at > n.start && at < n.end)) continue;
    const start = skipTrivia(html, at + m[0].length);
    const end = exprEnd(html, start);
    if (end > start) out.push({ start, end });
  }
  return out;
}

const GLOBALS = new Set([
  "Math", "JSON", "Object", "String", "Number", "Boolean", "Array", "Date", "RegExp",
  "Map", "Set", "Promise", "Error", "Symbol", "BigInt", "Intl", "console", "document",
  "window", "navigator", "crypto", "performance", "process", "globalThis", "URL", "Blob",
  "TextEncoder", "TextDecoder", "Uint8Array", "parseInt", "parseFloat", "isNaN", "isFinite",
  "undefined", "null", "true", "false", "NaN", "Infinity", "this", "arguments",
  "if", "else", "for", "while", "do", "return", "const", "let", "var", "function", "new",
  "typeof", "instanceof", "in", "of", "delete", "void", "await", "async", "class", "try",
  "catch", "finally", "throw", "switch", "case", "default", "break", "continue", "yield",
  "extends", "super", "static", "get", "set",
]);

// Array/String methods that PROJECT rather than select: narrowing stops at them
// and the whole container is walked, because `criteria.map(c => ({value: c.value}))`
// can carry any member of any element into the payload.
const PROJECTORS = new Set([
  "map", "filter", "forEach", "reduce", "flatMap", "slice", "concat", "sort",
  "find", "some", "every", "join", "reverse", "at", "entries", "values", "keys",
]);

// Identifier references inside a span, with the FULL member/index chain, string
// bodies excluded but template SUBSTITUTIONS kept (that is where art-09's
// defect lives). `[0]`/`[i]` become the wildcard `*` — the element shapes of an
// array literal are all candidates for the same member.
function refsIn(text) {
  const out = [];
  let i = 0;
  const scan = (s) => {
    const re = /([A-Za-z_$][\w$]*)((?:\s*(?:\.\s*[A-Za-z_$][\w$]*|\[[^\][]*\]))*)/g;
    let m;
    while ((m = re.exec(s))) {
      const before = s[m.index - 1];
      if (before && /[.\w$]/.test(before)) continue;
      const ident = m[1];
      if (GLOBALS.has(ident)) continue;
      const after = s.slice(m.index + m[0].length);
      // `key:` in an object literal is a key, not a reference.
      if (m[2] === "" && /^\s*:/.test(after)) continue;
      const path = [];
      for (const seg of (m[2] || "").matchAll(/\.\s*([A-Za-z_$][\w$]*)|\[([^\][]*)\]/g)) {
        if (seg[1] !== undefined) path.push(seg[1]);
        else {
          const lit = /^\s*['"]([^'"]*)['"]\s*$/.exec(seg[2] || "");
          path.push(lit ? lit[1] : "*");
        }
      }
      out.push({ ident, path });
    }
  };
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') { i = skipString(text, i); continue; }
    if (c === "`") {
      // Walk the template, scanning only its ${...} substitutions.
      const end = skipString(text, i);
      const tpl = text.slice(i, end);
      let k = 0;
      while (k < tpl.length) {
        if (tpl[k] === "\\") { k += 2; continue; }
        if (tpl[k] === "$" && tpl[k + 1] === "{") {
          const sEnd = matchBrace(tpl, k + 1);
          if (sEnd > 0) { scan(tpl.slice(k + 2, sEnd - 1)); k = sEnd; continue; }
        }
        k++;
      }
      i = end;
      continue;
    }
    if (c === "/" && (text[i + 1] === "/" || text[i + 1] === "*")) { i = skipTrivia(text, i); continue; }
    let j = i;
    while (j < text.length && !/['"`]/.test(text[j]) && !(text[j] === "/" && (text[j + 1] === "/" || text[j + 1] === "*"))) j++;
    scan(text.slice(i, j));
    i = j;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Ban scanning over a SPAN of the page, comment-aware, with real line numbers.
 * The ban list is imported — this gate never restates it.
 * ------------------------------------------------------------------ */
function lineOf(html, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < html.length; i++) if (html[i] === "\n") n++;
  return n;
}

const CTRL_LABEL = "raw control char in source";

// Scan a span for banned constructs.
//
// `scanSrc` has PLAIN STRING BODIES masked but template `${...}` substitutions
// intact. Pages carry prose that kernels do not: tool 531's clause keyword
// `'persons.*process.*personal data'` matched the `process.` ban as a string, and
// a gate that reports a regulation's wording as a determinism defect is noise.
// The one ban that must see string bodies is the raw-control-char check — a
// control character inside a payload string literal is precisely the art-189
// cross-engine hazard — so it runs against the real text.
function scanBans(scanSrc, rawSrc, span, hits, why) {
  const startLine = lineOf(rawSrc, span.start);
  const lines = scanSrc.slice(span.start, span.end).split("\n");
  const rawLines = rawSrc.slice(span.start, span.end).split("\n");
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const { code, inBlock: next } = stripCommentsLine(lines[i], inBlock);
    inBlock = next;
    const rawLine = rawLines[i] ?? "";
    for (const [label, pattern] of HARD_BANS) {
      const subject = label === CTRL_LABEL ? rawLine : code;
      if (!subject.trim() && label !== CTRL_LABEL) continue;
      if (pattern.test(subject)) {
        hits.push({ label, line: startLine + i, src: rawLine.trim().slice(0, 160), why, spanLine: startLine });
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Resolve the page's preimage roots: the `output_payload` and
 * `policy_parameters` object literals. Same tiering as the surface-parity
 * gate — keyed off the ONE thing every generation must do (name the member in
 * the artifact it seals), never off markup or a generator's naming habit.
 * ------------------------------------------------------------------ */
function preimageRoots(html, member) {
  const roots = [];
  const notes = [];
  let opaque = false;

  const takeLiteral = (open) => {
    const end = matchBrace(html, open);
    if (end < 0) return false;
    const lit = html.slice(open, end);
    const node = objectMembers(lit);
    // The ARTIFACT wrapper is not the payload.
    if (node.members.some((m) => m.key === "output_payload" || m.key === "policy_parameters")) return false;
    roots.push({ start: open, end, node });
    return true;
  };

  // TIER 1 — inline literal: `output_payload: { ... }`
  let resolved = false;
  for (const m of html.matchAll(new RegExp(`\\b${member}\\s*:\\s*\\{`, "g"))) {
    if (takeLiteral(m.index + m[0].length - 1)) resolved = true;
  }

  // TIER 2 — the variable is literally named `output_payload`
  if (!resolved) {
    for (const m of html.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${member}\\s*=\\s*\\{`, "g"))) {
      if (takeLiteral(m.index + m[0].length - 1)) resolved = true;
    }
  }

  // TIER 3 — an alias holds it: `output_payload: <ident>`
  const aliases = new Set();
  for (const m of html.matchAll(new RegExp(`\\b${member}\\s*:\\s*([A-Za-z_$][\\w$]*)`, "g"))) aliases.add(m[1]);
  if (!resolved) {
    for (const id of aliases) {
      for (const sp of rhsSpans(html, id).spans) {
        if (html[sp.start] === "{") { if (takeLiteral(sp.start)) resolved = true; }
        else {
          // `op = Object.assign(...)` / `op = compute(pp)` — not a literal, but
          // still the payload: walk the expression itself (TIER 4 handles the
          // callee hop from there).
          roots.push({ start: sp.start, end: sp.end, node: null });
          resolved = true;
        }
      }
      if (resolved) break; // first alias that resolves wins
    }
  }

  if (!resolved) {
    notes.push(
      aliases.size
        ? `${member} named via ${[...aliases].join("/")}, but no source span resolved`
        : `page never names ${member}`,
    );
    return { roots, notes, opaque: true, resolved: false };
  }
  for (const r of roots) if (r.node && r.node.opaque) opaque = true;
  return { roots, notes, opaque, resolved: true };
}

/* ------------------------------------------------------------------ *
 * THE WALK — from each preimage root outward, following every identifier the
 * payload depends on, member-narrowed where possible.
 * ------------------------------------------------------------------ */
// Top-level element spans of an array literal `[ ... ]`.
function arrayElements(lit) {
  const out = [];
  let i = 1, d = 1, start = -1;
  while (i < lit.length) {
    i = skipTrivia(lit, i);
    if (i >= lit.length) break;
    const c = lit[i];
    if (d === 1 && start < 0 && c !== "," && c !== "]") start = i;
    if (c === "'" || c === '"' || c === "`") { i = skipString(lit, i); continue; }
    if (c === "{" || c === "[" || c === "(") { d++; i++; continue; }
    if (c === "}" || c === "]" || c === ")") {
      d--;
      if (d === 0) { if (start >= 0) out.push({ start, end: i }); break; }
      i++;
      continue;
    }
    if (c === "," && d === 1) { if (start >= 0) out.push({ start, end: i }); start = -1; i++; continue; }
    i++;
  }
  return out;
}

// Parameter names bound INSIDE a span (`criteria.map(c => ...)`,
// `function (a, b) {}`). A parameter has no declaration of its own to follow,
// and resolving it against some unrelated `const c` elsewhere in the page is
// how a reachability walk manufactures defects.
function paramsIn(text) {
  const names = new Set();
  for (const m of text.matchAll(/\(([^()]*)\)\s*=>/g)) {
    for (const p of m[1].split(",")) {
      const n = /^\s*([A-Za-z_$][\w$]*)/.exec(p);
      if (n) names.add(n[1]);
    }
  }
  for (const m of text.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*=>/g)) names.add(m[1]);
  for (const m of text.matchAll(/function\s*[A-Za-z_$\w]*\s*\(([^()]*)\)/g)) {
    for (const p of m[1].split(",")) {
      const n = /^\s*([A-Za-z_$][\w$]*)/.exec(p);
      if (n) names.add(n[1]);
    }
  }
  return names;
}

function analysePage(html, rel) {
  CACHE = { rhs: new Map(), fns: new Map() };
  // STRUCTURE is read from the masked view; VALUES and REFERENCES from the real
  // text. Offsets are identical between the two by construction.
  const code = maskLiterals(html);
  const scan = maskLiterals(html, true);
  const hits = [];
  const unresolved = [];
  const ambiguousIdents = new Set();
  const seen = new Set();

  // Apply a member/index path to a span, returning the sub-spans it selects.
  // ⭐ THIS IS WHAT KEEPS THE GATE HONEST IN BOTH DIRECTIONS. `_result.clock[2].datetime_str`
  // seals ONE member of one record; walking the whole `clock` array instead would
  // flag the wall-clock `relative:` label beside it, which the payload never carries.
  // Equally, a path that lands on a projector (`criteria.map(...)`) can carry ANY
  // member of ANY element, so there the whole container is in scope.
  // Each result carries the residual path that could not be applied here.
  const narrow = (span, path) => {
    if (!path.length) return [{ ...span, residual: [] }];
    const text = code.slice(span.start, span.end);
    const seg = path[0];
    const rest = path.slice(1);
    if (text[0] === "{") {
      if (seg === "*") return [{ ...span, residual: [] }]; // computed key: whole object
      const node = objectMembers(text);
      const hit = node.members.find((m) => m.key === seg);
      if (hit) return narrow({ start: span.start + hit.start, end: span.start + hit.end }, rest);
      if (node.spreads.length || node.opaqueNonSpread) {
        // The member may sit inside the spread: a LOWER BOUND, so the object as
        // a whole stays in scope and the opacity is reported by the caller.
        return [{ ...span, residual: [] }];
      }
      return []; // member provably not from this object — nothing to inspect
    }
    if (text[0] === "[") {
      if (PROJECTORS.has(seg)) return [{ ...span, residual: [] }];
      const elems = arrayElements(text).map((e) => ({ start: span.start + e.start, end: span.start + e.end }));
      const next = seg === "*" || /^\d+$/.test(seg) ? rest : path;
      return elems.flatMap((e) => narrow(e, next));
    }
    if (PROJECTORS.has(seg)) return [{ ...span, residual: [] }];
    return [{ ...span, residual: path }];
  };

  const resolveRef = (ident, path, depth, why) => {
    const { spans, ambiguous } = rhsSpans(code, ident);
    if (ambiguous) {
      // One line per NAME, not per reference: the blind spot is the name.
      ambiguousIdents.add(ident);
      return;
    }
    let followed = false;
    for (const t of spans) {
      const ttext = code.slice(t.start, t.end);
      // `ident = fn(args)` -> the value is the callee's return, path-narrowed.
      const call = /^(?:await\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(ttext);
      const bodies = call && !GLOBALS.has(call[1]) ? functionBodies(code, call[1]) : [];
      if (bodies.length) {
        for (const body of bodies) {
          for (const r of returnSpans(code, body)) walk(r, path, depth + 1, `${why} → ${call[1]}() return`);
        }
        followed = true;
        continue;
      }
      walk(t, path, depth + 1, why);
      followed = true;
    }
    if (!followed) {
      // A page-local function invoked straight from the payload
      // (`datetime_str: fmtDt(ms)`): its RETURNS are the value. Only the
      // returns — walking a whole body would drag in its display statements.
      for (const body of functionBodies(code, ident)) {
        for (const r of returnSpans(code, body)) walk(r, [], depth + 1, `${why} → ${ident}() return`);
        followed = true;
      }
    }
    // Still not followed: a parameter, a loop variable, or a DOM handle. Those
    // have no source of their own to inspect; the span that referenced them was
    // already scanned.
  };

  function walk(rawSpan, path, depth, why) {
    if (rawSpan.end <= rawSpan.start) return;
    if (depth > MAX_DEPTH) {
      unresolved.push(`depth cap (${MAX_DEPTH}) reached while following ${why} — deeper values NOT inspected`);
      return;
    }
    for (const span of narrow(rawSpan, path)) {
      const key = `${span.start}:${span.end}:${span.residual.join(".")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const text = code.slice(span.start, span.end);      // structure
      const real = html.slice(span.start, span.end);      // values + references

      // A bare identifier carrying a residual path is a shorthand carriage
      // (`return { isMajor, criteria, clock }`): resolve the name, keep the path.
      if (span.residual.length && /^[A-Za-z_$][\w$]*$/.test(text.trim())) {
        resolveRef(text.trim(), span.residual, depth, why);
        continue;
      }

      scanBans(scan, html, span, hits, why);

      // Spreads: `{...core, x}` shows only part of its member set. Follow the
      // core where it can be followed; where it cannot, say so — a silently
      // passed unresolvable spread is a false clean.
      if (text[0] === "{") {
        const node = objectMembers(text);
        for (const sp of node.spreads) {
          const { spans, ambiguous } = rhsSpans(code, sp);
          if (ambiguous || !spans.length) {
            unresolved.push(`spread \`...${sp}\` inside ${why} could not be followed — the member values it contributes are a LOWER BOUND`);
            continue;
          }
          for (const t of spans) walk(t, [], depth + 1, `...${sp} (spread into ${why})`);
        }
        if (node.opaqueNonSpread) {
          unresolved.push(`${why} has a computed key or a spread of a non-identifier — the member values are a LOWER BOUND`);
        }
      }

      const bound = paramsIn(text);
      for (const { ident, path: rpath } of refsIn(real)) {
        if (bound.has(ident)) continue; // parameter of a callback inside this span
        const rkey = `ref:${ident}${rpath.length ? "." + rpath.join(".") : ""}@${depth}`;
        if (seen.has(rkey)) continue;
        seen.add(rkey);
        resolveRef(ident, rpath, depth, `${why} → ${ident}${rpath.length ? "." + rpath.join(".") : ""}`);
      }
    }
  }
  const walkSpan = (span, depth, why) => walk(span, [], depth, why);

  const notes = [];
  let anyResolved = false;
  for (const member of ["output_payload", "policy_parameters"]) {
    const r = preimageRoots(code, member);
    notes.push(...r.notes.map((n) => `${rel}: ${n}`));
    if (r.resolved) anyResolved = true;
    for (const root of r.roots) walkSpan({ start: root.start, end: root.end }, 0, member);
  }
  for (const id of ambiguousIdents) {
    unresolved.push(`\`${id}\` is declared more than once (no scope analysis available) — its value was NOT followed`);
  }
  return { hits, unresolved: [...new Set(unresolved)], notes, resolved: anyResolved };
}

/* ------------------------------------------------------------------ *
 * MAIN
 * ------------------------------------------------------------------ */
const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
  : { entries: [] };
const BASELINE_ENTRIES = Array.isArray(baseline.entries) ? baseline.entries : [];
const BASELINE_SET = new Set(BASELINE_ENTRIES.map((e) => `${e.file}:${e.line}:${e.pattern}`));
const baselineSeen = new Set();

const PAGE_ROOTS = [
  { dir: CG, rel: "chaingraph" },
  { dir: TOOLS, rel: "tools" },
];

const pages = [];
for (const f of FILES) {
  const base = f.replace(/\\/g, "/").split("/").pop();
  pages.push({ id: base.replace(/\.html$/, ""), file: f, rel: base });
}
for (const root of FILES.length ? [] : PAGE_ROOTS) {
  if (!existsSync(root.dir)) continue;
  for (const f of readdirSync(root.dir).sort()) {
    if (!f.endsWith(".html")) continue;
    const id = f.slice(0, -".html".length);
    if (ONLY && !ONLY.has(id)) continue;
    pages.push({ id, file: join(root.dir, f), rel: `${root.rel}/${f}` });
  }
}

const scopeOf = (id) => (/^art-/.test(id) ? "art-*" : "non-art");
const SCOPES = ["art-*", "non-art"];
const tally = Object.fromEntries(SCOPES.map((s) => [s, { scanned: 0, defective: 0, unresolved: 0 }]));

const newDefects = [];
const baselineDefects = [];
const unresolvedPages = [];
const found = [];

for (const p of pages) {
  const raw = readFileSync(p.file, "utf8");
  const html = scriptOnlyView(raw);
  // Only OCG pages have a preimage at all.
  if (!/\boutput_payload\b/.test(html) && !/\bpolicy_parameters\b/.test(html)) continue;
  const scope = scopeOf(p.id);
  tally[scope].scanned++;

  const { hits, unresolved, notes, resolved } = analysePage(html, p.rel);

  // De-duplicate: the same construct reached by two paths is one defect.
  const uniq = new Map();
  for (const h of hits) {
    const k = `${h.line}:${h.label}`;
    if (!uniq.has(k)) uniq.set(k, h);
  }
  const pageHits = [...uniq.values()].sort((a, b) => a.line - b.line);
  if (pageHits.length) {
    tally[scope].defective++;
    found.push({ file: p.rel, id: p.id, scope, hits: pageHits });
  }
  for (const h of pageHits) {
    const key = `${p.rel}:${h.line}:${h.label}`;
    if (BASELINE_SET.has(key)) {
      baselineSeen.add(key);
      baselineDefects.push({ file: p.rel, ...h });
    } else {
      newDefects.push({ file: p.rel, ...h });
    }
  }

  if (unresolved.length || !resolved) {
    tally[scope].unresolved++;
    unresolvedPages.push({ file: p.rel, id: p.id, scope, why: [...unresolved, ...notes] });
  }
}

if (WRITE_BASELINE) {
  const entries = [];
  for (const f of found) {
    for (const h of f.hits) {
      entries.push({
        file: f.file,
        line: h.line,
        pattern: h.label,
        reached_via: h.why,
        src: h.src,
      });
    }
  }
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        _comment: baseline._comment,
        _derived: baseline._derived,
        entries,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`wrote ${entries.length} baseline entr(ies) to ${BASELINE_PATH}`);
  process.exit(0);
}

if (AS_JSON) {
  console.log(
    JSON.stringify(
      { tally, newDefects, baselineDefects, unresolved: unresolvedPages },
      null,
      2,
    ),
  );
} else {
  for (const d of newDefects) {
    console.error(`✗ PREIMAGE-REACHABLE [${d.label}]  ${d.file}:${d.line}`);
    console.error(`    reached via: ${d.why}`);
    console.error(`    ${d.src}`);
  }
  for (const d of baselineDefects) {
    console.warn(`⚠  BASELINE [${d.label}]  ${d.file}:${d.line}  (pre-existing; tracked for remediation)`);
  }
  for (const u of unresolvedPages) {
    console.warn(`?  UNRESOLVED  ${u.file}`);
    for (const w of u.why) console.warn(`     ${w}`);
  }
  for (const key of BASELINE_SET) {
    if (!baselineSeen.has(key)) {
      console.warn(`⚠  stale baseline "${key}" — defect no longer reachable; remove from page-determinism-baseline.json.`);
    }
  }
  // Reported BY SCOPE and never blended: only `art-*` is historically comparable.
  for (const s of SCOPES) {
    const t = tally[s];
    console.log(
      `${s}: scanned ${t.scanned} · pages with preimage-reachable non-determinism ${t.defective} · unresolved ${t.unresolved}`,
    );
  }
  console.log(
    `new defects ${newDefects.length} · baseline ${baselineDefects.length} · unresolved pages ${unresolvedPages.length}`,
  );
}

if (newDefects.length && !WARN_ONLY) {
  console.error(
    `\n✗ page-determinism FAILED — ${newDefects.length} non-baselined construct(s) reach the execution_hash preimage.`,
  );
  console.error("  Fix: compute the payload value deterministically (e.g. fmtEnUS() instead of");
  console.error("  toLocaleString(), an explicit timestamp input instead of Date.now()), or keep the");
  console.error("  locale/time call on the DISPLAY path only, outside {policy_parameters, output_payload}.");
  process.exit(1);
}
if (WARN_ONLY && newDefects.length) {
  console.log(`⚠  page-determinism WARN-ONLY — ${newDefects.length} non-baselined defect(s); not blocking.`);
}
process.exit(0);
