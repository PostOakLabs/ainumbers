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
// SCOPE AND ITS LIMIT, STATED PLAINLY:
//   This gate compares the SET OF TOP-LEVEL MEMBERS of `output_payload` on each
//   surface. It does NOT compare values. Value parity is not reachable by a
//   zero-dep static gate: only some page generations expose a pure `compute(pp)`
//   seam (art-324 does), while others fuse compute and DOM rendering in one
//   function with no seam at all (art-221 reads `document.getElementById`
//   inline and never returns a payload). A gate that executed the pages it
//   could and skipped the rest would pass whole generations silently — the
//   exact failure mode this gate exists to prevent. Member-set parity applies
//   uniformly to every generation, and it is the divergence class that actually
//   exists in the tree today.
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
// Returns { keys, opaque } — `opaque` true if a spread or computed key makes the
// member set statically unknowable, in which case `keys` is only a LOWER BOUND.
function objectLiteralKeys(lit) {
  const keys = [];
  let opaque = false;
  let i = 1; // past `{`
  let expectKey = true;
  let d = 1;
  while (i < lit.length) {
    i = skipTrivia(lit, i);
    if (i >= lit.length) break;
    const c = lit[i];
    if (expectKey && d === 1) {
      if (c === "}") break;
      if (c === "," ) { i++; continue; }
      if (c === "." && lit[i + 1] === "." && lit[i + 2] === ".") { opaque = true; expectKey = false; i += 3; continue; }
      if (c === "[") { opaque = true; expectKey = false; i++; d++; continue; }
      if (c === "'" || c === '"') {
        const end = skipString(lit, i);
        keys.push(lit.slice(i + 1, end - 1));
        i = end;
        expectKey = false;
        continue;
      }
      const m = /^(?:async\s+)?(?:\*\s*)?(?:(?:get|set)\s+)?([A-Za-z_$][\w$]*)/.exec(lit.slice(i));
      if (m && m[1]) {
        keys.push(m[1]);
        i += m[0].length;
        expectKey = false;
        continue;
      }
      // Numeric or otherwise unrecognized key token — do not guess.
      opaque = true;
      expectKey = false;
      i++;
      continue;
    }
    // In a value / after a key: consume until a depth-1 comma or the closing brace.
    if (c === "'" || c === '"' || c === "`") { i = skipString(lit, i); continue; }
    if (c === "/" && (lit[i + 1] === "/" || lit[i + 1] === "*")) { i = skipTrivia(lit, i); continue; }
    if (c === "{" || c === "[" || c === "(") { d++; i++; continue; }
    if (c === "}" || c === "]" || c === ")") { d--; if (d === 0) break; i++; continue; }
    if (c === "," && d === 1) { expectKey = true; i++; continue; }
    i++;
  }
  return { keys, opaque };
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
  let opaque = false;
  let resolved = false;

  // Read one `{...}` literal at `open` into the key set. Rejects the ARTIFACT /
  // result WRAPPER (a literal that carries `output_payload` itself is not it).
  const take = (open) => {
    const end = matchBrace(html, open);
    if (end < 0) return false;
    const { keys: ks, opaque: op } = objectLiteralKeys(html.slice(open, end));
    if (ks.includes("output_payload") || ks.includes("policy_parameters")) return false;
    if (op) opaque = true;
    for (const k of ks) keys.add(k);
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
        const d = new RegExp(`(?:const|let|var)\\s+${ref.replace(/\$/g, "\\$")}\\s*=\\s*\\{`).exec(scope);
        if (d) {
          const open = scopeOffset + d.index + d[0].length - 1;
          if (take(open)) hit = true;
          else opaque = true;
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
      notes: [named ? `payload named via ${named}, but no object literal resolved` : "page never names output_payload"],
    };
  }
  if (opaque) notes.push("payload literal contains a spread or computed key — member set is a LOWER BOUND");
  return { keys, notes };
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
      }
    } catch (e) {
      notes.push(`vector threw: ${e.message}`);
    }
  }
  if (ok === 0) {
    return { keys: null, notes: notes.length ? notes : [`${viaArtifact ? "buildArtifact()" : "compute()"} produced no output_payload`] };
  }
  return { keys, notes: [`${ok}/${vectors.length} fixture vectors exercised via ${viaArtifact ? "buildArtifact()" : "compute()"}`, ...notes] };
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

const pages = readdirSync(CG)
  .filter((f) => /^art-.+\.html$/.test(f))
  .map((f) => f.replace(/\.html$/, ""))
  .filter((id) => !ONLY || ONLY.has(id))
  .sort();

const divergent = [];
const unresolved = [];
const extras = [];
let compared = 0;
let noKernel = 0;

for (const id of pages) {
  if (!existsSync(join(KERNELS, `${id}.kernel.mjs`))) { noKernel++; continue; } // page with no server kernel: out of scope
  const html = readFileSync(join(CG, `${id}.html`), "utf8");
  const page = pagePayloadKeys(html);
  const kern = await kernelPayloadKeys(id);

  if (!kern.keys) { unresolved.push({ id, side: "kernel", why: kern.notes.join("; ") }); continue; }
  if (!page.keys) { unresolved.push({ id, side: "page", why: page.notes.join("; ") }); continue; }

  compared++;
  const missing = [...kern.keys].filter((k) => !page.keys.has(k)).sort();
  const extra = [...page.keys].filter((k) => !kern.keys.has(k)).sort();
  if (missing.length) {
    divergent.push({
      id,
      page: `repo/chaingraph/${id}.html`,
      kernel: `repo/chaingraph/kernels/${id}.kernel.mjs`,
      missing_from_page: missing,
      ...shardMeta(id),
      ...(page.notes.length ? { page_notes: page.notes } : {}),
    });
  }
  if (extra.length) extras.push({ id, page_only: extra });
}

if (AS_JSON) {
  console.log(JSON.stringify({ compared, pages_without_kernel: noKernel, divergent, unresolved, page_only: extras }, null, 2));
} else {
  console.log(
    `check-node-surface-parity: compared ${compared} node page<->kernel pairs ` +
      `(member-set parity of output_payload); ${noKernel} page(s) have no kernel and are out of scope.`,
  );
  if (divergent.length) {
    console.log(`\nFAIL - page omits an output_payload member its kernel emits:`);
    for (const d of divergent) {
      console.log(`  ${d.page}`);
      console.log(`    missing: ${d.missing_from_page.join(", ")}`);
      console.log(`    kernel : ${d.kernel}  [gpu=${d.gpu} status=${d.status} cc=${d.compute_capability}]`);
      if (d.page_notes) for (const n of d.page_notes) console.log(`    note   : ${n}`);
    }
  }
  if (unresolved.length) {
    console.log(`\nFAIL - member set could not be resolved (silence is not a pass):`);
    for (const u of unresolved) console.log(`  ${u.id} [${u.side}] ${u.why}`);
  }
  if (extras.length) {
    console.log(`\nINFO - members on the page but not in the kernel's fixture-exercised union`);
    console.log(`       (may be a kernel branch no fixture reaches; not a failure):`);
    for (const e of extras) console.log(`  ${e.id}: ${e.page_only.join(", ")}`);
  }
  if (!divergent.length && !unresolved.length) console.log("OK - every compared page carries every member its kernel emits.");
}

process.exit(divergent.length || unresolved.length ? 1 : 0);
