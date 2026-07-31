#!/usr/bin/env node
// check-node-surface-parity.mjs — fail if a node PAGE's own `output_payload`
// does not carry every member the node's SERVER KERNEL emits.
//
// WHY: SPEC.md §24.0 binds the compute surfaces to byte-identical
// `output_payload` for identical input across the browser tool, the Worker
// (§12 server path) and the §18 guest. Nothing checked the browser leg.
// `golden-parity.test.mjs` reads only kernels/fixtures/*.fixtures.json and
// never opens a .html file; `parity-art-01.test.mjs` is one bespoke node; and
// `gate-parity.test.mjs` — cited by SPEC.md §21.4/§22.8/§24.1 — is CHAIN gate
// evaluator parity (Worker `run_chain` vs embedded `runChain`), a different
// subject entirely, and no file of that name exists in the tree.
//
// So a node page could omit an `output_payload` member the kernel emits and
// nothing would go red. NODE19-VERIFY-1 (2026-07-27) found 19 pages doing
// exactly that with `regulatory_basis`. Both artifacts still verify standalone
// — each hashes its OWN payload — but the two `execution_hash` values differ
// for identical input, so a browser-sealed bundle and a server-sealed bundle
// are not interchangeable. That is the defect this gate names.
//
// REPORT-ONLY, BY DESIGN. This gate is NOT in preflight and NOT in CI, and must
// not be wired into either. It stands at a large pre-existing divergence count;
// wiring it would red `main` for a condition no single change introduced, and
// making it exit 0 by default to become wireable would hide the finding, which
// is worse than not gating. It is an instrument a human runs.
//
// SCOPE — TWO PAGE ROOTS, DERIVED SET (CANTON-GATE-1, 2026-07-28):
//   The pair set is every node with BOTH a kernel and a page, and a page is
//   looked up under `chaingraph/` AND `tools/`. Before this, discovery was
//   `readdirSync(chaingraph).filter(/^art-.+\.html$/)` — a two-part filter on
//   directory AND filename prefix — so kernel-backed nodes paged under `tools/`
//   were invisible no matter how far they diverged. Counts are reported per
//   scope (`art-*` / `non-art`) and never blended: only the `art-*` figure is
//   comparable to a report predating this widening.
//
// SCOPE AND ITS LIMIT, STATED PLAINLY:
//   This gate compares the SET OF MEMBERS of `output_payload` on each surface —
//   top-level always, and nested where both sides resolve a real object (see the
//   NESTED COMPARISON block). Member-set parity does NOT compare VALUES: a field
//   present on both surfaces with different content passes it silently. Running
//   every page to get a runtime value is not reachable by a zero-dep static gate
//   (see the DIRECTION note below on why full execution is out); only some page
//   generations expose a pure `compute(pp)` seam (art-324 does), while others
//   fuse compute and DOM rendering with no seam at all (art-221 reads
//   `document.getElementById` inline and never returns a payload). A gate that
//   executed the pages it could and skipped the rest would pass whole
//   generations silently — the exact failure mode this gate exists to prevent.
//
// STATIC VALUE COMPARISON (PARITY-VALUE-1, 2026-07-30): a NARROWER, ADDITIVE
// check that does not need execution. Where a member's value is written as a
// literal string/number/boolean/null DIRECTLY in both the page's object
// literal and the kernel's own source text (see the STATIC VALUE COMPARISON
// block), the two literals are diffed. `art-391`'s `disambiguation` field is
// exactly this shape: a hardcoded prose string, independently authored on the
// page and in the kernel, that member-set parity cannot see drift on because
// both surfaces carry the key. This does not widen member-set parity's blind
// spot for values baked in by a referenced identifier/constant rather than
// written inline — that remains open, stated once here rather than hidden.
//
// DIRECTION: a kernel member missing from the page is a FAILURE — the kernel is
// the surface `compute_capability:"server"` names (§12), and the page has no
// license to differ. A page member absent from the kernel's fixture-exercised
// union is reported as INFO, not a failure: the kernel's key set is observed by
// running its fixtures, so a member emitted only on an unexercised branch would
// look "extra" on the page when it is nothing of the kind.
//
// A page whose payload literal cannot be resolved is reported UNRESOLVED and
// counts as a failure. Silence is not a pass.
//
// Zero-dep, node: builtins only. Usage:
//   node scripts/check-node-surface-parity.mjs             # gate (exit 1 on divergence)
//   node scripts/check-node-surface-parity.mjs --json      # machine-readable
//   node scripts/check-node-surface-parity.mjs --only art-324-tvm-npv,art-215-...
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CG = resolve(ROOT, "chaingraph");
const KERNELS = join(CG, "kernels");
const FIXTURES = join(KERNELS, "fixtures");
const NODES = join(CG, "graph", "nodes");

const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
const onlyIdx = argv.findIndex((a) => a === "--only" || a.startsWith("--only="));
const ONLY =
  onlyIdx === -1
    ? null
    : new Set(
        (argv[onlyIdx].includes("=") ? argv[onlyIdx].split("=")[1] : argv[onlyIdx + 1] || "")
          .split(",")
          .filter(Boolean),
      );

/* ------------------------------------------------------------------ *
 * JS source scanning primitives — string/template/comment aware.
 * Hand-rolled on purpose: the site repo is zero-dep (CONTRACT §0) and
 * ~40 gates are built the same way. No parser dependency is available.
 * ------------------------------------------------------------------ */

// Advance past a quoted string or template literal starting at src[i].
function skipString(src, i) {
  const q = src[i];
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { i += 2; continue; }
    if (c === q) return i + 1;
    if (q === "`" && c === "$" && src[i + 1] === "{") {
      // template substitution: brace-match through it
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

// Advance past whitespace and comments.
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

// Given the index of an opening `{`, return the index just past its match.
function matchBrace(src, open) {
  let i = open, d = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"' || c === "`") { i = skipString(src, i); continue; }
    if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) { i = skipTrivia(src, i); continue; }
    if (c === "{") d++;
    else if (c === "}") { d--; if (d === 0) return i + 1; }
    i++;
  }
  return -1;
}

// Top-level member names of an object literal given as `{ ... }` source text.
// Returns { keys, opaque, nested } — `opaque` true if a spread or computed key
// makes the member set statically unknowable, in which case `keys` is only a
// LOWER BOUND. `nested` is a Map<key, objectLiteralKeys(...)> holding the SAME
// shape for every member whose value is itself an object LITERAL — the depth
// that CANTONDIV-MEASURE-1 case #13 (art-free node 515) needs; see the
// NESTED COMPARISON block below for why a member whose value is anything else
// (identifier, call, ternary) is deliberately absent from this map.
//
// SPREADS ARE RECORDED, NOT MERELY OBSERVED (GATE-SPREAD-OPAQUE-1, 2026-07-28).
// `{...receiptCore, binding_sha256}` is opaque HERE — this function sees only
// the literal's own text — but the identifier it spreads is usually declared a
// few lines up in the same page. `spreads` carries those identifier names out
// so `resolveSpreads()` can follow them and turn the LOWER BOUND back into an
// observed member set. `opaqueNonSpread` is the opacity that CANNOT be resolved
// that way (computed key, unrecognized key token, a spread of a non-identifier
// expression): it keeps `opaque` true no matter how many spreads resolve.
// Unescape a single- or double-quoted string literal's raw source text
// (including its quotes) into its runtime value. Handles the escapes that
// occur in this codebase's prose fields (\', \", \\, \n, \t); anything else
// passes the character after the backslash through unchanged.
function parseStringLiteral(raw) {
  const q = raw[0];
  const body = raw.slice(1, -1);
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\") {
      const n = body[i + 1];
      if (n === "n") { out += "\n"; i++; continue; }
      if (n === "t") { out += "\t"; i++; continue; }
      if (n === "\\") { out += "\\"; i++; continue; }
      if (n === q || n === "'" || n === '"' || n === "`") { out += n; i++; continue; }
      out += n; i++; continue;
    }
    out += c;
  }
  return out;
}

function objectLiteralKeys(lit) {
  const keys = [];
  const nested = new Map();
  const valueIdent = new Map();
  // PART OF PARITY-VALUE-1 (2026-07-30): scalar-literal VALUES, not just member
  // names — `values.get(key)` is `{kind, text, num}` for a key whose value is a
  // direct string/number/boolean/null literal. Anything else (identifier, call,
  // ternary, template with substitution) is deliberately absent, same
  // discipline as `nested`/`valueIdent` above.
  const values = new Map();
  const spreads = [];
  let opaqueNonSpread = false;
  let opaque = false;
  let i = 1; // past `{`
  let expectKey = true;
  let valueStart = false;
  let lastKey = null;
  let d = 1;
  while (i < lit.length) {
    i = skipTrivia(lit, i);
    if (i >= lit.length) break;
    const c = lit[i];
    if (expectKey && d === 1) {
      if (c === "}") break;
      if (c === "," ) { i++; continue; }
      if (c === "." && lit[i + 1] === "." && lit[i + 2] === ".") {
        opaque = true;
        // `...ident` followed by `,` or `}` is resolvable one hop; `...f(x)`,
        // `...(a||b)` and `...obj.prop` are not, and stay permanently opaque.
        const sm = /^\s*([A-Za-z_$][\w$]*)\s*(?=[,}])/.exec(lit.slice(i + 3));
        if (sm) spreads.push(sm[1]);
        else opaqueNonSpread = true;
        expectKey = false; valueStart = false; i += 3; continue;
      }
      if (c === "[") { opaque = true; opaqueNonSpread = true; expectKey = false; valueStart = false; i++; d++; continue; }
      if (c === "'" || c === '"') {
        const end = skipString(lit, i);
        lastKey = lit.slice(i + 1, end - 1);
        keys.push(lastKey);
        i = end;
        expectKey = false;
        valueStart = true;
        continue;
      }
      const m = /^(?:async\s+)?(?:\*\s*)?(?:(?:get|set)\s+)?([A-Za-z_$][\w$]*)/.exec(lit.slice(i));
      if (m && m[1]) {
        lastKey = m[1];
        keys.push(lastKey);
        i += m[0].length;
        expectKey = false;
        valueStart = true;
        continue;
      }
      // Numeric or otherwise unrecognized key token — do not guess.
      opaque = true;
      opaqueNonSpread = true;
      expectKey = false;
      valueStart = false;
      i++;
      continue;
    }
    // Directly after a key, classify the value:
    //   `: { ... }`  -> descend now (recorded in `nested`)
    //   `: ident`    -> record the identifier so the CALLER, which has the
    //                   surrounding scope this function does not, can resolve
    //                   it one level (recorded in `valueIdent`)
    //   `ident`      -> ES6 shorthand; the identifier IS the key name
    // Anything else (call, ternary, method) falls through unrecorded.
    if (valueStart && d === 1) {
      valueStart = false;
      let j = skipTrivia(lit, i);
      if (lit[j] === ":") {
        j = skipTrivia(lit, j + 1);
        if (lit[j] === "{") {
          const end = matchBrace(lit, j);
          if (end > 0) {
            if (lastKey !== null) nested.set(lastKey, objectLiteralKeys(lit.slice(j, end)));
            i = end;
            continue;
          }
        }
        if (lastKey !== null && (lit[j] === "'" || lit[j] === '"')) {
          const send = skipString(lit, j);
          values.set(lastKey, { kind: "string", text: parseStringLiteral(lit.slice(j, send)) });
        } else {
          const nm = lastKey !== null ? /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/.exec(lit.slice(j)) : null;
          const bm = lastKey !== null ? /^(true|false|null)\b/.exec(lit.slice(j)) : null;
          if (nm) {
            values.set(lastKey, { kind: "number", text: nm[0], num: Number(nm[0]) });
          } else if (bm) {
            values.set(lastKey, { kind: bm[0], text: bm[0] });
          } else {
            const im = /^[A-Za-z_$][\w$]*/.exec(lit.slice(j));
            if (im && lastKey !== null) {
              const after = lit[skipTrivia(lit, j + im[0].length)];
              if (after === "," || after === "}") valueIdent.set(lastKey, im[0]);
            }
          }
        }
      } else if ((lit[j] === "," || lit[j] === "}") && lastKey !== null) {
        valueIdent.set(lastKey, lastKey); // shorthand `{ pacs008 }`
      }
    }
    // In a value / after a key: consume until a depth-1 comma or the closing brace.
    if (c === "'" || c === '"' || c === "`") { i = skipString(lit, i); continue; }
    if (c === "/" && (lit[i + 1] === "/" || lit[i + 1] === "*")) { i = skipTrivia(lit, i); continue; }
    if (c === "{" || c === "[" || c === "(") { d++; i++; continue; }
    if (c === "}" || c === "]" || c === ")") { d--; if (d === 0) break; i++; continue; }
    if (c === "," && d === 1) { expectKey = true; i++; continue; }
    i++;
  }
  return { keys, opaque, opaqueNonSpread, nested, valueIdent, spreads, values };
}

/* ------------------------------------------------------------------ *
 * SPREAD RESOLUTION — turn a LOWER BOUND back into an observed member set.
 *
 * GATE-SPREAD-OPAQUE-1 (2026-07-28). `art-191` seals
 * `receipt = {...receiptCore, binding_sha256}` and `art-193` seals
 * `sanitization_record = {...recordCore, record_sha256}`. The spread's core
 * object carries EVERY member the gate reported as missing — the member sets
 * are identical — so both were PHANTOM divergences: the gate compared a
 * truncated literal as though it were complete.
 *
 * Following the identifier is strictly better than declaring the node
 * unresolved, so that is what this does; `opaque` survives only where the core
 * genuinely cannot be followed, and litPaths()/the caller then route that node
 * to UNRESOLVED or to a SKIPPED subtree rather than to a false "missing".
 * ------------------------------------------------------------------ */
// Index of the `{` that opens `ident`'s own object literal, or -1.
// Accepts the SECOND and later declarators of a comma-continued statement
// (`var rows = [], extra = {}` — art-332), which a `(?:const|let|var)\s+ident`
// anchor cannot see. Missing it is not a neutral under-report: an identifier
// the resolver cannot follow keeps the node opaque, and an opaque node is a
// LOWER BOUND, so the members really present go unproven.
function declLiteralOpen(text, ident) {
  const esc = ident.replace(/\$/g, "\\$");
  const m =
    new RegExp(`(?:const|let|var)\\s+${esc}\\s*=\\s*\\{`).exec(text) ||
    new RegExp(`,\\s*${esc}\\s*=\\s*\\{`).exec(text);
  return m ? m.index + m[0].length - 1 : -1;
}

function resolveSpreads(node, html, seen = new Set()) {
  if (!node || !node.spreads || !node.spreads.length) return node;
  const pending = node.spreads.splice(0);
  let unresolved = false;
  for (const ident of pending) {
    if (seen.has(ident)) { unresolved = true; continue; } // cyclic/self spread
    const esc = ident.replace(/\$/g, "\\$");
    const open = declLiteralOpen(html, ident);
    if (open < 0) { unresolved = true; continue; }
    const end = matchBrace(html, open);
    if (end < 0) { unresolved = true; continue; }
    // A computed member write (`core[k] = ...`) fills the object at runtime with
    // keys no literal can show — the core is a LOWER BOUND too, so following it
    // would swap one false-complete set for another.
    if (new RegExp(`\\b${esc}\\s*\\[(?!\\s*['"])[^\\]]*\\]\\s*=[^=]`).test(html)) { unresolved = true; continue; }
    const sub = resolveSpreads(objectLiteralKeys(html.slice(open, end)), html, new Set([...seen, ident]));
    if (sub.opaque) unresolved = true;
    // Members attached to the core after construction belong to it.
    for (const am of html.matchAll(new RegExp(`\\b${esc}\\.([A-Za-z_$][\\w$]*)\\s*=[^=]`, "g"))) {
      if (!sub.keys.includes(am[1])) sub.keys.push(am[1]);
    }
    for (const k of sub.keys) if (!node.keys.includes(k)) node.keys.push(k);
    for (const [k, v] of sub.nested) if (!node.nested.has(k)) node.nested.set(k, v);
    for (const [k, v] of sub.valueIdent) if (!node.valueIdent.has(k)) node.valueIdent.set(k, v);
    for (const [k, v] of sub.values) if (!node.values.has(k)) node.values.set(k, v);
  }
  node.opaque = node.opaqueNonSpread || unresolved;
  return node;
}

// Same, applied to a literal and every object literal nested inside it.
function resolveSpreadsDeep(node, html) {
  if (!node) return node;
  resolveSpreads(node, html);
  for (const v of node.nested.values()) resolveSpreadsDeep(v, html);
  return node;
}

/* ------------------------------------------------------------------ *
 * STATIC VALUE COMPARISON (PARITY-VALUE-1, 2026-07-30) — a field present on
 * BOTH surfaces with DIFFERENT CONTENT. The set-based checks above are silent
 * about this: `art-391`'s page and kernel both carry a `disambiguation`
 * member, member-set parity is satisfied, and the two literal strings can
 * still drift (they did — page and kernel independently hardcode the same
 * three wrong node-ID citations, found by ARTREF-FIX-1).
 *
 * SCOPE, DELIBERATELY NARROW: this compares a STATIC LITERAL on the page
 * against a STATIC LITERAL in the kernel SOURCE TEXT — string/number/
 * boolean/null tokens written directly as a member's value, at the SAME
 * dotted path on both sides. It does NOT run the kernel and does NOT compare
 * computed values. Two reasons, not one:
 *   (1) INDEPENDENT PROVENANCE. The page's literal and the kernel's literal
 *       are each authored by hand in their own file. Diffing literal text
 *       against literal text keeps the two sides genuinely independent — the
 *       failure mode this row was told to watch for is a comparison that
 *       reads one surface derived from the other. A kernel value obtained by
 *       RUNNING the kernel is derived FROM the kernel; comparing that to the
 *       page would still be a real check, but comparing kernel-source-text to
 *       page-source-text is the narrower, unimpeachable case, and it is
 *       exactly what the demonstrated defect is (two hardcoded strings).
 *   (2) NO FIXTURE-VECTOR HEURISTIC NEEDED. A "this computed value is stable
 *       across fixture vectors, treat it as constant" rule would need >=2
 *       vectors to be trustworthy (same caveat as `stableObjectPaths` below)
 *       and most kernels ship 0 or 1 fixture vectors. A literal-vs-literal
 *       check needs no vectors at all and works uniformly everywhere.
 * The cost is real and stated once, not hidden: a value baked in by a
 * COMPUTED constant (e.g. a `const RATE = 60` referenced by identifier, not
 * written inline in the literal) is invisible to this check on the kernel
 * side, same as a `nested`-map member is invisible when the value isn't a
 * literal object. Member-set parity above still catches a member's total
 * ABSENCE; this catches literal-vs-literal DISAGREEMENT where both authors
 * bothered to spell the value out by hand — which is the class of drift that
 * actually happened.
 * ------------------------------------------------------------------ */

// Walk a { keys, nested, values } node into a Map<dottedPath, literal>.
function collectLiteralValues(node, prefix, out) {
  if (!node || !node.keys) return;
  for (const k of node.keys) {
    const p = prefix ? `${prefix}.${k}` : k;
    const v = node.values && node.values.get(k);
    if (v !== undefined) out.set(p, v);
    const sub = node.nested && node.nested.get(k);
    if (sub) collectLiteralValues(sub, p, out);
  }
}

function sameLiteral(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "string") return a.text === b.text;
  if (a.kind === "number") return a.num === b.num;
  return a.text === b.text; // true / false / null
}

function literalDisplay(v) {
  const s = v.kind === "string" ? JSON.stringify(v.text) : v.text;
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

/* ------------------------------------------------------------------ *
 * NESTED COMPARISON — why it is scoped the way it is.
 *
 * CANTONDIV-MEASURE-1 case #13 (`515-collateral-swap-eligibility-validator`)
 * has an EXACTLY matching top-level member set, yet its nested `pacs008` is
 * kernel `{instructed_amount, settlement_date}` against a page carrying nine
 * members. A top-level-only diff scores that "compared, no divergence" — a
 * false clean. So the comparison descends.
 *
 * It descends ONLY where BOTH sides resolved a real object at the same path:
 * the page side needs an object LITERAL (so the member set is actually
 * observed, not guessed) and the kernel side needs a plain object (not an
 * array — array element shapes are input-dependent, and a fixture that
 * happens to produce one element would manufacture paths the page could never
 * carry). Where either side is unresolved the subtree is skipped and named in
 * the notes. A skipped subtree is a stated blind spot; an invented one would
 * be a false failure, which is strictly worse for a gate nobody wires to CI.
 *
 * DIRECTION is unchanged from the top level and deliberately so: a kernel
 * member missing from the page FAILS, a page member the kernel's
 * fixture-exercised union lacks is INFO. The fixture-coverage caveat that
 * justifies INFO at depth 1 applies verbatim at depth 2+.
 * ------------------------------------------------------------------ */

// Walk a page-side objectLiteralKeys() result into dotted paths.
// `objPaths` collects the paths whose value was a resolved object literal.
function litPaths(node, prefix, paths, objPaths, opaquePaths) {
  for (const k of node.keys) {
    const p = prefix ? `${prefix}.${k}` : k;
    paths.add(p);
    const sub = node.nested.get(k);
    // An EMPTY literal (`const shocks = {}`, filled by a later loop) resolves
    // syntactically but observes nothing. Registering it as a comparable object
    // would report every member the kernel emits there as "missing from the
    // page" — art-183's six IRRBB shock scenarios are exactly that shape. Treat
    // it as unresolved instead, which routes it to the SKIPPED note.
    // ...and an OPAQUE literal (`{...core, x}` whose core could not be
    // followed) is a LOWER BOUND, so it is not a comparable object either:
    // registering it would report every member the kernel emits under it as
    // "missing from the page" when the member may sit inside the spread.
    // GATE-SPREAD-OPAQUE-1: that is exactly the phantom art-191/art-193 hit.
    // Its known children are still recorded as paths — a lower bound is true
    // as far as it goes — but the subtree is not comparable, so it lands in
    // the SKIPPED note instead of in a false divergence.
    if (sub && sub.keys.length) {
      if (sub.opaque) opaquePaths?.add(p);
      else objPaths.add(p);
      litPaths(sub, p, paths, objPaths, opaquePaths);
    }
  }
}

// Walk a kernel-side real object into the same dotted-path shape.
function objPathsOf(o, prefix, paths, objPaths) {
  for (const [k, v] of Object.entries(o)) {
    const p = prefix ? `${prefix}.${k}` : k;
    paths.add(p);
    if (v && typeof v === "object" && !Array.isArray(v)) { objPaths.add(p); objPathsOf(v, p, paths, objPaths); }
  }
}

const parentOf = (p) => p.slice(0, p.lastIndexOf("."));

// Which nested objects are a FIXED RECORD rather than a COMPUTED MAP?
//
// This distinction is what keeps the nested check from manufacturing failures.
// `pacs008` is a record: the same members every run, so a page literal can and
// should carry them. `rule_failure_counts` is a map keyed by whichever rules a
// given input tripped, and `shocks` is keyed by scenario — no static page
// literal can ever carry those keys, and calling their absence a divergence
// would be noise dressed as a finding.
//
// The discriminator is the kernel's OWN fixtures: run every vector, and a
// nested object whose direct-child set is identical across all of them is a
// record; one that varies is a map. With fewer than two vectors the question is
// unanswerable, so nothing is called stable — an under-report the notes name
// out loud, rather than a false failure.
function stableObjectPaths(perVector, objPaths) {
  const stable = new Set();
  if (perVector.length < 2) return stable;
  for (const p of objPaths) {
    const sig = perVector.map((vp) => [...vp].filter((x) => parentOf(x) === p).sort().join("|"));
    if (sig[0] !== "" && sig.every((s) => s === sig[0])) stable.add(p);
  }
  return stable;
}

/* ------------------------------------------------------------------ *
 * PAGE SIDE — resolve the identifier that holds the page's own
 * output_payload, then read that identifier's object literal(s).
 * Generation-agnostic by construction: it keys off the ONE thing every
 * generation must do (name `output_payload` in the artifact it seals),
 * never off markup or a generator's variable-naming habit.
 * ------------------------------------------------------------------ */
function pagePayloadKeys(html) {
  const keys = new Set();
  const notes = [];
  const nested = new Map();
  const values = new Map();
  let opaque = false;
  let resolved = false;
  let wallClock = false;

  // Union two objectLiteralKeys() results. Several tiers contribute more than
  // one literal (multiple `output_payload:` sites, `Object.assign` arguments,
  // branch returns); the member set is their union at every depth.
  const mergeNode = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    const out = {
      keys: [...new Set([...a.keys, ...b.keys])],
      opaque: a.opaque || b.opaque,
      opaqueNonSpread: a.opaqueNonSpread || b.opaqueNonSpread,
      nested: new Map(a.nested),
      valueIdent: new Map([...a.valueIdent, ...b.valueIdent]),
      spreads: [...new Set([...(a.spreads || []), ...(b.spreads || [])])],
      values: new Map([...(a.values || []), ...(b.values || [])]),
    };
    for (const [k, v] of b.nested) out.nested.set(k, mergeNode(out.nested.get(k), v));
    return out;
  };

  // Resolve a nested member whose value is a bare identifier one level to that
  // identifier's own object literal — the same one-hop resolution TIER 3 does
  // for the payload itself. This is what makes `output_payload: { ..., pacs008 }`
  // over `var pacs008 = { ... }` a comparable subtree instead of a silent skip;
  // without it CANTONDIV-MEASURE-1 case #13 still scores clean.
  const resolveIdentNested = (node) => {
    for (const [k, ident] of node.valueIdent) {
      if (node.nested.has(k)) continue;
      const esc = ident.replace(/\$/g, "\\$");
      const open = declLiteralOpen(html, ident);
      if (open < 0) continue;
      const end = matchBrace(html, open);
      if (end < 0) continue;
      // A computed member write (`shocks[name] = ...`) means the object is
      // filled at runtime with keys no literal can show. Leave it unresolved.
      if (new RegExp(`\\b${esc}\\s*\\[(?!\\s*['"])[^\\]]*\\]\\s*=[^=]`).test(html)) continue;
      const sub = resolveSpreadsDeep(objectLiteralKeys(html.slice(open, end)), html);
      // Members attached after construction (`pacs008.foo = ...`) belong to the
      // same object; omitting them would manufacture a false "missing".
      for (const am of html.matchAll(new RegExp(`\\b${esc}\\.([A-Za-z_$][\\w$]*)\\s*=[^=]`, "g"))) {
        if (!sub.keys.includes(am[1])) sub.keys.push(am[1]);
      }
      nested.set(k, mergeNode(nested.get(k), sub));
      if (/\bDate\.now\s*\(|\bnew\s+Date\s*\(/.test(html.slice(open, end))) wallClock = true;
    }
  };

  // Read one `{...}` literal at `open` into the key set. Rejects the ARTIFACT /
  // result WRAPPER (a literal that carries `output_payload` itself is not it).
  const take = (open) => {
    const end = matchBrace(html, open);
    if (end < 0) return false;
    const lit = html.slice(open, end);
    const node = resolveSpreadsDeep(objectLiteralKeys(lit), html);
    if (node.keys.includes("output_payload") || node.keys.includes("policy_parameters")) return false;
    if (node.opaque) opaque = true;
    for (const k of node.keys) keys.add(k);
    for (const [k, v] of node.nested) nested.set(k, mergeNode(nested.get(k), v));
    for (const [k, v] of node.values) values.set(k, v);
    resolveIdentNested(node);
    // A wall-clock read INSIDE the sealed payload makes `execution_hash`
    // non-reproducible for identical input. Not this gate's failure class
    // (it compares members, not values) but it is a distinct defect and
    // silence about it would be its own false clean.
    if (/\bDate\.now\s*\(|\bnew\s+Date\s*\(/.test(lit)) wallClock = true;
    return true;
  };

  // Members attached after construction: `x.foo = ...` / `x['foo'] = ...`
  const takeAssignments = (id) => {
    const esc = id.replace(/\$/g, "\\$");
    let hit = false;
    for (const m of html.matchAll(new RegExp(`\\b${esc}\\.([A-Za-z_$][\\w$]*)\\s*=[^=]`, "g"))) { keys.add(m[1]); hit = true; }
    for (const m of html.matchAll(new RegExp(`\\b${esc}\\[\\s*'([^']+)'\\s*\\]\\s*=[^=]`, "g"))) { keys.add(m[1]); hit = true; }
    return hit;
  };

  // `Object.assign(a, b, c)` merge: read every argument. An object literal is
  // read directly; a bare identifier is resolved one level to its own literal
  // (`base` in art-488); anything else makes the member set a LOWER BOUND.
  // `argStart` is the index just past the opening `(`; `scope` is the text the
  // identifier lookup searches (the whole page, or one function body).
  function takeObjectAssign(argStart, scope, scopeOffset = 0) {
    let i = argStart, depth = 1, hit = false;
    while (i < html.length && depth > 0) {
      const c = html[i];
      if (c === "'" || c === '"' || c === "`") { i = skipString(html, i); continue; }
      if (c === "(" || c === "[") { depth++; i++; continue; }
      if (c === ")" || c === "]") { depth--; i++; continue; }
      if (depth === 1 && c === "{") {
        const end = matchBrace(html, i);
        if (end < 0) break;
        if (take(i)) hit = true;
        i = end;
        continue;
      }
      if (depth === 1 && /[A-Za-z_$]/.test(c)) {
        const m = /^[A-Za-z_$][\w$]*/.exec(html.slice(i));
        const ref = m[0];
        const d = declLiteralOpen(scope, ref);
        if (d >= 0) {
          if (take(scopeOffset + d)) {
            hit = true;
            // The literal may be empty by construction and filled by later
            // `ref.foo = ...` writes (art-332's `extra`); those members are as
            // real as declared ones and their absence is what made the node
            // read as a lower bound.
            takeAssignments(ref);
          } else opaque = true;
        } else {
          opaque = true;
        }
        i += ref.length;
        continue;
      }
      i++;
    }
    return hit;
  }

  // TIER 1 — inline literal: `output_payload: { ... }`. The dominant shape in the
  // generation that returns `{ output_payload: {...}, compliance_flags }` directly.
  for (const m of html.matchAll(/\boutput_payload\s*:\s*\{/g)) {
    if (take(m.index + m[0].length - 1)) resolved = true;
  }

  // TIER 2 — the variable is literally named `output_payload`:
  //   `const output_payload = { ... }` (art-324), plus ES6 shorthand carriage.
  if (!resolved) {
    for (const m of html.matchAll(/\b(?:const|let|var)\s+output_payload\s*=\s*\{/g)) {
      if (take(m.index + m[0].length - 1)) resolved = true;
    }
    if (resolved && takeAssignments("output_payload")) { /* additive */ }
  }

  // TIER 3 — an alias holds it: `output_payload: <ident>` (art-221 `op`,
  // art-01 `outputPayload`). Resolve that identifier's own literal.
  const aliases = new Set();
  for (const m of html.matchAll(/\boutput_payload\s*:\s*([A-Za-z_$][\w$]*)/g)) aliases.add(m[1]);
  if (!resolved) {
    for (const id of aliases) {
      const esc = id.replace(/\$/g, "\\$");
      for (const m of html.matchAll(new RegExp(`(?:(?:const|let|var)\\s+)?\\b${esc}\\s*=\\s*\\{`, "g"))) {
        if (take(m.index + m[0].length - 1)) resolved = true;
      }
      // `var op = Object.assign({ ... }, base, { ... })` (art-332, art-488).
      for (const m of html.matchAll(new RegExp(`(?:(?:const|let|var)\\s+)?\\b${esc}\\s*=\\s*Object\\.assign\\s*\\(`, "g"))) {
        if (takeObjectAssign(m.index + m[0].length, html)) resolved = true;
      }
      if (resolved && takeAssignments(id)) { /* additive */ }
      if (resolved) break; // first alias that resolves wins; do NOT union across aliases
    }
  }

  // TIER 4 — the payload is the RETURN VALUE of a page-local function:
  //   `var op = computeFhaMip(pp)` (art-224) / `const output_payload = compute(pp)`
  //   (art-318). Follow the callee and read the `return { ... }` literals in its
  //   body — union across branches, since different returns are different paths.
  if (!resolved) {
    const callees = new Set();
    for (const id of new Set([...aliases, "output_payload"])) {
      const esc = id.replace(/\$/g, "\\$");
      for (const m of html.matchAll(new RegExp(`(?:(?:const|let|var)\\s+)?\\b${esc}\\s*=\\s*([A-Za-z_$][\\w$]*)\\s*\\(`, "g"))) {
        callees.add(m[1]);
      }
    }
    for (const fn of callees) {
      const esc = fn.replace(/\$/g, "\\$");
      for (const m of html.matchAll(new RegExp(`function\\s+${esc}\\s*\\([^)]*\\)\\s*\\{`, "g"))) {
        const bodyOpen = m.index + m[0].length - 1;
        const bodyEnd = matchBrace(html, bodyOpen);
        if (bodyEnd < 0) continue;
        const body = html.slice(bodyOpen, bodyEnd);
        for (const rm of body.matchAll(/\breturn\s*\{/g)) {
          const open = bodyOpen + rm.index + rm[0].length - 1;
          if (take(open)) resolved = true;
        }
        // `return Object.assign({}, base, { ... })` (art-488)
        for (const rm of body.matchAll(/\breturn\s+Object\.assign\s*\(/g)) {
          if (takeObjectAssign(bodyOpen + rm.index + rm[0].length, body, bodyOpen)) resolved = true;
        }
      }
      if (resolved) break; // first callee that resolves wins; do NOT union across callees
    }
  }

  if (!resolved) {
    const named = [...aliases].join("/") || (/\boutput_payload\b/.test(html) ? "output_payload" : "");
    return {
      keys: null,
      // "never names output_payload" is the ENVELOPE-ABSENT shape: the page
      // seals a flat ad-hoc object instead of building the OCG
      // `{policy_parameters, output_payload}` envelope at all
      // (CANTONDIV-MEASURE-1 case #11, `513-margin-call-collateral-mobilizer`).
      // It is a divergence of a different order than a wrong member set, and
      // it reaches this gate as UNRESOLVED, which is already a failure.
      notes: [named ? `payload named via ${named}, but no object literal resolved` : "page never names output_payload (ENVELOPE-ABSENT: no {policy_parameters, output_payload} envelope on the page)"],
    };
  }
  if (opaque) notes.push("payload literal contains an UNRESOLVABLE spread or a computed key — member set is only a LOWER BOUND, so a 'missing' member is unprovable");
  if (wallClock) notes.push("DEFECT: wall-clock read (Date.now()/new Date()) inside the sealed payload literal — execution_hash is not reproducible for identical input");
  // `opaque` is REPORTED, not swallowed (GATE-SPREAD-OPAQUE-1). It used to be
  // computed here, mentioned in a note, and then dropped on the floor — the
  // caller diffed a LOWER BOUND as though it were a complete member set.
  return { keys, notes, nested, opaque, values };
}

/* ------------------------------------------------------------------ *
 * KERNEL SIDE — run the kernel's own compute() over its own fixtures and
 * observe the member set it actually emits. Union across vectors, because
 * a kernel may emit branch-conditional members.
 * ------------------------------------------------------------------ */
async function kernelPayloadKeys(id) {
  const kpath = join(KERNELS, `${id}.kernel.mjs`);
  if (!existsSync(kpath)) return { keys: null, notes: ["no kernel"] };
  let mod;
  try {
    mod = await import(pathToFileURL(kpath).href);
  } catch (e) {
    return { keys: null, notes: [`kernel import failed: ${e.message}`] };
  }
  // Use the kernel's OWN buildArtifact() as the authority on what its
  // `output_payload` is. Kernels disagree about compute()'s return shape — some
  // return `{ output_payload, compliance_flags }`, others return the payload
  // directly and buildArtifact does `const output_payload = result`. Reading
  // artifact.output_payload models nothing; it is the server surface's answer.
  // All 489 kernels export buildArtifact; compute() is the fallback only.
  const viaArtifact = typeof mod.buildArtifact === "function";
  if (!viaArtifact && typeof mod.compute !== "function") {
    return { keys: null, notes: ["kernel exports neither buildArtifact() nor compute()"] };
  }

  const fpath = join(FIXTURES, `${id}.fixtures.json`);
  const vectors = [];
  if (existsSync(fpath)) {
    try {
      const fx = JSON.parse(readFileSync(fpath, "utf8"));
      for (const v of fx.vectors || []) vectors.push(v.policy_parameters ?? {});
    } catch (e) {
      return { keys: null, notes: [`fixtures unreadable: ${e.message}`] };
    }
  }
  if (vectors.length === 0) vectors.push({}); // still observe the default branch

  const keys = new Set();
  const paths = new Set();
  const objPaths = new Set();
  const perVector = [];
  const notes = [];
  let ok = 0;
  for (const pp of vectors) {
    try {
      const op = viaArtifact
        ? (await mod.buildArtifact(pp, { now: null }))?.output_payload
        : (await mod.compute(pp))?.output_payload;
      if (op && typeof op === "object") {
        ok++;
        for (const k of Object.keys(op)) keys.add(k);
        const vp = new Set();
        const vo = new Set();
        objPathsOf(op, "", vp, vo);
        perVector.push(vp);
        for (const p of vp) paths.add(p);
        for (const p of vo) objPaths.add(p);
      }
    } catch (e) {
      notes.push(`vector threw: ${e.message}`);
    }
  }
  if (ok === 0) {
    return { keys: null, notes: notes.length ? notes : [`${viaArtifact ? "buildArtifact()" : "compute()"} produced no output_payload`] };
  }
  const stableObjPaths = stableObjectPaths(perVector, objPaths);
  const unstable = [...objPaths].filter((p) => !stableObjPaths.has(p)).sort();
  return {
    keys,
    paths,
    objPaths,
    stableObjPaths,
    notes: [
      `${ok}/${vectors.length} fixture vectors exercised via ${viaArtifact ? "buildArtifact()" : "compute()"}`,
      ...(unstable.length
        ? [`nested comparison SKIPPED under: ${unstable.join(", ")} (${ok < 2 ? "only one fixture vector — record vs computed-map is undecidable" : "child set varies across fixture vectors — computed map, not a fixed record"})`]
        : []),
      ...notes,
    ],
  };
}

/* ------------------------------------------------------------------ */

function shardMeta(id) {
  const p = join(NODES, `${id}.json`);
  if (!existsSync(p)) return {};
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    return { gpu: j.gpu, status: j.status, compute_capability: j.compute_capability };
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ *
 * THE COMPARISON SET — DERIVED, never enumerated.
 *
 * The set is "has a kernel AND has a page", full stop. It is NOT an ID range
 * and NOT a name search: a filename grep for `canton` over the non-`art-*`
 * kernel-backed block returns 3 of its 13 members, because IDs like
 * `510-digital-asset-regulatory-classifier` and
 * `515-collateral-swap-eligibility-validator` carry no such token. Deriving by
 * name would have been a false-absence generator.
 *
 * WHAT WAS BLIND BEFORE: page discovery was
 * `readdirSync(CG).filter((f) => /^art-.+\.html$/.test(f))` with
 * `CG = resolve(ROOT, "chaingraph")`, and every page was read via
 * `join(CG, id + ".html")`. That is a TWO-PART gate — directory AND filename
 * prefix — so kernel-backed nodes whose page lives under `tools/` could not be
 * seen no matter how far they diverged. Widening the regex alone would have
 * fixed neither half.
 * ------------------------------------------------------------------ */
const TOOLS = resolve(ROOT, "tools");
const PAGE_ROOTS = [
  { dir: CG, rel: "repo/chaingraph" },
  { dir: TOOLS, rel: "repo/tools" },
];

const pageIndex = new Map();
const pageCollisions = [];
for (const root of PAGE_ROOTS) {
  if (!existsSync(root.dir)) continue;
  for (const f of readdirSync(root.dir)) {
    if (!f.endsWith(".html")) continue;
    const id = f.slice(0, -".html".length);
    if (pageIndex.has(id)) { pageCollisions.push(`${id}: ${pageIndex.get(id).rel} and ${root.rel}/${f}`); continue; }
    pageIndex.set(id, { file: join(root.dir, f), rel: `${root.rel}/${f}` });
  }
}

const kernelIds = readdirSync(KERNELS)
  .filter((f) => f.endsWith(".kernel.mjs"))
  .map((f) => f.slice(0, -".kernel.mjs".length))
  .sort();
const kernelsWithoutPage = kernelIds.filter((id) => !pageIndex.has(id));
const ids = kernelIds.filter((id) => pageIndex.has(id)).filter((id) => !ONLY || ONLY.has(id));

// Retained purely for comparability with every pre-widening report of this gate.
const noKernel = readdirSync(CG).filter(
  (f) => /^art-.+\.html$/.test(f) && !existsSync(join(KERNELS, `${f.slice(0, -".html".length)}.kernel.mjs`)),
).length;

// SCOPE: `art-*` reproduces the figure every prior wave quoted; `non-art` is
// what the widening added. They are reported separately and never blended.
const scopeOf = (id) => (/^art-/.test(id) ? "art-*" : "non-art");
const SCOPES = ["art-*", "non-art"];
const tally = Object.fromEntries(SCOPES.map((s) => [s, { compared: 0, divergent: 0, unresolved: 0 }]));

const divergent = [];
const unresolved = [];
const extras = [];
let compared = 0;

for (const id of ids) {
  const scope = scopeOf(id);
  const loc = pageIndex.get(id);
  const html = readFileSync(loc.file, "utf8");
  const page = pagePayloadKeys(html);
  const kern = await kernelPayloadKeys(id);

  if (!kern.keys) { unresolved.push({ id, scope, side: "kernel", page: loc.rel, why: kern.notes.join("; ") }); tally[scope].unresolved++; continue; }
  if (!page.keys) { unresolved.push({ id, scope, side: "page", page: loc.rel, why: page.notes.join("; ") }); tally[scope].unresolved++; continue; }
  // A TOP-LEVEL lower bound cannot be diffed at all: "the page is missing X" is
  // unprovable when X may sit inside the spread, and a silent pass would be the
  // false clean this gate's header forbids. UNRESOLVED is the honest outcome —
  // the same category `513` already lands in.
  if (page.opaque) { unresolved.push({ id, scope, side: "page", page: loc.rel, why: page.notes.join("; ") }); tally[scope].unresolved++; continue; }

  compared++;
  tally[scope].compared++;
  const missing = [...kern.keys].filter((k) => !page.keys.has(k)).sort();
  const extra = [...page.keys].filter((k) => !kern.keys.has(k)).sort();

  // Nested paths, compared only under a parent BOTH sides resolved as an object.
  const pagePaths = new Set();
  const pageObjPaths = new Set();
  const pageOpaquePaths = new Set();
  litPaths({ keys: [...page.keys], opaque: page.opaque, nested: page.nested }, "", pagePaths, pageObjPaths, pageOpaquePaths);
  // A nested literal the resolver could not follow, at a path the kernel's own
  // fixtures prove is a fixed record, is comparable in principle and only
  // unknowable in practice. Reporting nothing there would be the false clean
  // this gate exists to prevent, so the NODE goes UNRESOLVED. (A subtree the
  // page simply does not build as an object literal is a different, older,
  // stated blind spot and stays in the SKIPPED note.)
  const opaqueComparable = [...pageOpaquePaths].filter((p) => kern.stableObjPaths.has(p)).sort();
  if (opaqueComparable.length) {
    unresolved.push({
      id, scope, side: "page", page: loc.rel,
      why: `nested literal is a LOWER BOUND (unresolvable spread or computed key) at: ${opaqueComparable.join(", ")}`,
    });
    tally[scope].unresolved++;
    compared--;
    tally[scope].compared--;
    continue;
  }
  // Both sides resolved an object at the parent: the subtree is comparable.
  const bothObj = (p) => {
    const par = parentOf(p);
    return par !== "" && pageObjPaths.has(par) && kern.objPaths.has(par);
  };
  // ...and the kernel's fixtures prove that object is a fixed record, so a
  // member the page lacks is a real divergence rather than a map key.
  const stable = (p) => bothObj(p) && kern.stableObjPaths.has(parentOf(p));

  const nestedMissing = [...kern.paths].filter((p) => p.includes(".") && stable(p) && !pagePaths.has(p)).sort();
  // Extra members are INFO in either case, so they need no stability proof —
  // which is what keeps a single-fixture node like 515 from falling silent.
  const nestedExtra = [...pagePaths].filter((p) => p.includes(".") && bothObj(p) && !kern.paths.has(p)).sort();
  // Comparable, kernel-only, but stability undecided: reported, never a failure.
  const nestedUndecided = [...kern.paths]
    .filter((p) => p.includes(".") && bothObj(p) && !stable(p) && !pagePaths.has(p))
    .sort();
  const skippedSubtrees = [...kern.stableObjPaths].filter((p) => !pageObjPaths.has(p)).sort();

  // STATIC VALUE COMPARISON (see the block above) — kernel SOURCE TEXT literal
  // vs page literal, at any dotted path present as a scalar literal on BOTH
  // sides. Independent of the runtime membership check above: it reads the
  // kernel's own file text, never the value kernelPayloadKeys() computed.
  const kernSrcPath = join(KERNELS, `${id}.kernel.mjs`);
  const valueMismatches = [];
  let valueCompareNote = null;
  if (existsSync(kernSrcPath)) {
    const kernStatic = pagePayloadKeys(readFileSync(kernSrcPath, "utf8"));
    if (!kernStatic.keys) {
      valueCompareNote = `value comparison SKIPPED: kernel output_payload literal not statically resolvable (${kernStatic.notes.join("; ")})`;
    } else if (kernStatic.opaque) {
      valueCompareNote = "value comparison SKIPPED: kernel output_payload literal contains an unresolvable spread or computed key";
    } else {
      const kernValues = new Map();
      collectLiteralValues({ keys: [...kernStatic.keys], nested: kernStatic.nested, values: kernStatic.values }, "", kernValues);
      const pageValues = new Map();
      collectLiteralValues({ keys: [...page.keys], nested: page.nested, values: page.values }, "", pageValues);
      for (const [p, kv] of kernValues) {
        const pv = pageValues.get(p);
        if (pv !== undefined && !sameLiteral(kv, pv)) {
          valueMismatches.push({ path: p, kernel: literalDisplay(kv), page: literalDisplay(pv) });
        }
      }
    }
  }

  const notes = [...page.notes];
  if (skippedSubtrees.length) {
    notes.push(`nested comparison SKIPPED under: ${skippedSubtrees.join(", ")} (page side is not a resolvable object literal there)`);
  }
  for (const n of kern.notes) if (n.startsWith("nested comparison SKIPPED")) notes.push(n);
  if (valueCompareNote) notes.push(valueCompareNote);

  if (missing.length || nestedMissing.length || valueMismatches.length) {
    divergent.push({
      id,
      scope,
      page: loc.rel,
      kernel: `repo/chaingraph/kernels/${id}.kernel.mjs`,
      missing_from_page: missing,
      ...(nestedMissing.length ? { nested_missing_from_page: nestedMissing } : {}),
      ...(valueMismatches.length ? { value_mismatches: valueMismatches } : {}),
      ...shardMeta(id),
      ...(notes.length ? { page_notes: notes } : {}),
    });
    tally[scope].divergent++;
  }
  if (extra.length || nestedExtra.length || nestedUndecided.length) {
    extras.push({
      id,
      scope,
      page: loc.rel,
      ...(extra.length ? { page_only: extra } : {}),
      ...(nestedExtra.length ? { nested_page_only: nestedExtra } : {}),
      ...(nestedUndecided.length ? { nested_kernel_only_undecided: nestedUndecided } : {}),
      ...(notes.length ? { page_notes: notes } : {}),
    });
  }
}

if (AS_JSON) {
  console.log(JSON.stringify({
    compared,
    by_scope: tally,
    pages_without_kernel: noKernel,
    kernels_without_page: kernelsWithoutPage,
    page_id_collisions: pageCollisions,
    divergent,
    unresolved,
    page_only: extras,
  }, null, 2));
} else {
  console.log(
    `check-node-surface-parity: compared ${compared} node page<->kernel pairs ` +
      `(member-set parity of output_payload, nested where both sides resolve an object).`,
  );
  // Both scopes, always, never blended: `art-*` is the only figure comparable
  // to a pre-widening report, and a single mixed number invites exactly the
  // apples-to-oranges confusion this gate's own history has already produced.
  for (const s of SCOPES) {
    const t = tally[s];
    console.log(`  scope ${s.padEnd(7)}: compared ${t.compared}, divergent ${t.divergent}, unresolved ${t.unresolved}`);
  }
  console.log(
    `  ${noKernel} chaingraph/art-*.html page(s) have no kernel and are out of scope; ` +
      `${kernelsWithoutPage.length} kernel(s) have no page in chaingraph/ or tools/.`,
  );
  if (pageCollisions.length) {
    console.log(`\nWARN - same node id has a page under BOTH roots (chaingraph/ won):`);
    for (const c of pageCollisions) console.log(`  ${c}`);
  }
  if (divergent.length) {
    console.log(`\nFAIL - page omits an output_payload member its kernel emits, or the two literal values disagree:`);
    for (const d of divergent) {
      console.log(`  ${d.page}  [${d.scope}]`);
      if (d.missing_from_page.length) console.log(`    missing: ${d.missing_from_page.join(", ")}`);
      if (d.nested_missing_from_page) console.log(`    missing (nested): ${d.nested_missing_from_page.join(", ")}`);
      if (d.value_mismatches) for (const vm of d.value_mismatches) console.log(`    value mismatch at ${vm.path}: kernel=${vm.kernel}  page=${vm.page}`);
      console.log(`    kernel : ${d.kernel}  [gpu=${d.gpu} status=${d.status} cc=${d.compute_capability}]`);
      if (d.page_notes) for (const n of d.page_notes) console.log(`    note   : ${n}`);
    }
  }
  if (unresolved.length) {
    console.log(`\nFAIL - member set could not be resolved (silence is not a pass):`);
    for (const u of unresolved) console.log(`  ${u.id} [${u.scope}] [${u.side}] ${u.why}`);
  }
  if (extras.length) {
    console.log(`\nINFO - members on the page but not in the kernel's fixture-exercised union`);
    console.log(`       (may be a kernel branch no fixture reaches; not a failure):`);
    for (const e of extras) {
      const bits = [];
      if (e.page_only) bits.push(e.page_only.join(", "));
      if (e.nested_page_only) bits.push(`nested page-only: ${e.nested_page_only.join(", ")}`);
      if (e.nested_kernel_only_undecided) bits.push(`nested kernel-only, record-vs-map UNDECIDED: ${e.nested_kernel_only_undecided.join(", ")}`);
      console.log(`  ${e.id} [${e.scope}]: ${bits.join(" | ")}`);
      if (e.page_notes) for (const n of e.page_notes) if (n.startsWith("DEFECT:")) console.log(`    ${n}`);
    }
  }
  if (!divergent.length && !unresolved.length) {
    console.log(
      `\nOK - every compared page carries every member its kernel emits.` +
        (extras.length
          ? ` NOT a clean bill: ${extras.length} page(s) carry EXTRA members (INFO above), and an extra member moves execution_hash just as a missing one does.`
          : ""),
    );
  }
}

process.exit(divergent.length || unresolved.length ? 1 : 0);
