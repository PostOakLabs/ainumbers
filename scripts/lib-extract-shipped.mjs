// scripts/lib-extract-shipped.mjs — the ONE extract-and-diff path for anchoring a
// gate to a SHIPPED inline verifier (TAMPER-GATE-SHIPPED-SOURCE-1, audit finding E-3).
//
// WHY THIS EXISTS: a tamper gate that carries its own copy of the verifier logic
// proves something about the copy, not about what ships. The shipped source can
// drift arbitrarily and the gate stays green. `chaingraph/kernels/inline-hash-equality.test.mjs`
// already solved this for `executionHashLocal` with brace-matched extraction of the
// REAL inline function; this module is that extractor, lifted verbatim so the four
// ledger/verifier tamper gates reuse it instead of inventing a second extraction.
//
// FAIL-CLOSED (SO #34c — absence is not a pass):
//   · a requested function/declaration that is NOT found throws, naming it;
//   · a signature that matches MORE THAN ONCE throws (ambiguous extraction is not
//     silently resolved to the first hit);
//   · so "the shipped function was renamed/deleted" reds the gate instead of
//     vacuously greening it.
//
// SECURITY NOTE (SO #34's rider): the assembled scope is built with `new Function`
// over text read from a TRACKED file in this repo — the same construction, on the
// same class of input, that inline-hash-equality.test.mjs has used since AUD-C3-2.
// There is no `require`, no `eval`, and no network or untracked input anywhere in
// the path. Callers pass an explicit allow-list of names to extract; nothing else
// from the page is executed.

/** Error carrying the exact file + missing/ambiguous names, so a red gate is self-diagnosing. */
export class ShippedExtractionError extends Error {
  constructor(file, problems) {
    super(
      `shipped-source extraction failed for ${file}:\n` +
      problems.map((p) => `    · ${p}`).join('\n') +
      `\n  The gate reads the SHIPPED verifier; it does not carry a replica.` +
      `\n  Either restore the named symbol in ${file}, or update the gate's extraction list.`
    );
    this.name = 'ShippedExtractionError';
    this.file = file;
    this.problems = problems;
  }
}

/**
 * Extract a brace-delimited construct: from the start of `sigRe`'s match through the
 * `}` that closes the first `{` after it. This is the AUD-C3-2 brace matcher, unchanged.
 * Returns null when the signature is absent; throws when it matches more than once.
 */
export function extractBraced(src, sigRe) {
  const all = [...src.matchAll(new RegExp(sigRe.source, sigRe.flags.includes('g') ? sigRe.flags : sigRe.flags + 'g'))];
  if (all.length === 0) return null;
  if (all.length > 1) throw new Error(`ambiguous: ${sigRe} matched ${all.length} times`);
  const m = all[0];
  let i = src.indexOf('{', m.index);
  if (i < 0) return null;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}

/** Back-compat alias for the original inline-hash-equality call sites. */
export const extractFn = extractBraced;

/** Extract `function NAME(...) {...}` / `async function NAME(...) {...}` by name. */
export function extractFnByName(src, name) {
  return extractBraced(src, new RegExp(`(?:async\\s+)?function\\s+${escapeRe(name)}\\s*\\(`));
}

/**
 * Extract a single top-level `const|var|let NAME = <expr>;` statement, bracket- and
 * string-aware so object/array literals and regexes with stray braces survive.
 */
export function extractDecl(src, name) {
  const sigRe = new RegExp(`(?:^|\\n)\\s*(?:const|var|let)\\s+${escapeRe(name)}\\s*=`, 'g');
  const all = [...src.matchAll(sigRe)];
  if (all.length === 0) return null;
  if (all.length > 1) throw new Error(`ambiguous declaration: ${name} declared ${all.length} times`);
  const start = all[0].index + all[0][0].length - all[0][0].trimStart().length;
  const end = scanToStatementEnd(src, start);
  if (end < 0) return null;
  return src.slice(start, end);
}

/**
 * Extract a single assignment statement whose left-hand side matches `sigRe` and whose
 * right-hand side is a brace-delimited object literal (e.g. `window.OCG = { ... }`).
 */
export function extractAssign(src, sigRe) {
  const body = extractBraced(src, sigRe);
  return body === null ? null : body + ';';
}

/**
 * Build a live binding object from a shipped file's OWN source text.
 *
 * @param {string} src        full text of the shipped file (HTML or JS)
 * @param {object} spec
 * @param {string} spec.file  path, used only in error messages
 * @param {string[]} [spec.decls]   `const|var|let` names to lift, in order
 * @param {string[]} [spec.fns]     function names to lift, in order
 * @param {Array<{re:RegExp,label:string}>} [spec.assigns] assignment statements to lift
 * @param {string} [spec.prelude]   text prepended inside the scope (host shims only)
 * @param {string} [spec.tail]      text appended before the return (aliases only)
 * @param {string[]} [spec.expose]  names to return; defaults to `fns`
 * @returns {object} `{ [name]: value }` built from shipped source
 */
export function buildShipped(src, spec) {
  const { file, decls = [], fns = [], assigns = [], prelude = '', tail = '', expose = null } = spec;
  const problems = [];
  const parts = [];
  if (prelude) parts.push(prelude);

  for (const d of decls) {
    let text = null;
    try { text = extractDecl(src, d); } catch (e) { problems.push(e.message); continue; }
    if (text === null) problems.push(`declaration \`${d}\` not found`);
    else parts.push(text);
  }
  for (const n of fns) {
    let text = null;
    try { text = extractFnByName(src, n); } catch (e) { problems.push(e.message); continue; }
    if (text === null) problems.push(`function \`${n}\` not found`);
    else parts.push(text);
  }
  for (const a of assigns) {
    let text = null;
    try { text = extractAssign(src, a.re); } catch (e) { problems.push(e.message); continue; }
    if (text === null) problems.push(`assignment \`${a.label}\` not found`);
    else parts.push(text);
  }
  if (problems.length) throw new ShippedExtractionError(file, problems);

  if (tail) parts.push(tail);
  const names = expose || fns;
  parts.push(`return { ${names.join(', ')} };`);
  try {
    return new Function(parts.join('\n\n'))(); // eslint-disable-line no-new-func
  } catch (e) {
    throw new ShippedExtractionError(file, [`extracted source did not assemble: ${e.message}`]);
  }
}

/**
 * Return a copy of `src` with `needle` replaced by `replacement` — the in-process
 * "tamper the SHIPPED verifier" primitive every anchored gate uses for its self-proof.
 * Throws when the needle is absent or occurs more than once, so a refactor that moves
 * the mutation point reds the gate with instructions instead of silently disarming the
 * self-proof (SO #34c: absence is not a pass).
 */
export function mutateSource(src, file, needle, replacement) {
  const hits = src.split(needle).length - 1;
  if (hits !== 1) {
    throw new Error(
      `self-proof mutation point is ${hits === 0 ? 'GONE from' : `AMBIGUOUS in (${hits} hits)`} ${file}:\n` +
      `    needle: ${needle}\n` +
      `  The self-proof tampers the shipped verifier and requires the suite to fail.\n` +
      `  Re-point this needle at the shipped source's current tamper-detection line.`
    );
  }
  return src.replace(needle, replacement);
}

/**
 * Assert that a shipped function's SOURCE TEXT still contains each required expression.
 * Used where a gate replays a comparison it deliberately does not execute in place
 * (art-424's signature legs), so a drift in the shipped comparison still reds the gate.
 * Returns an array of missing needles (empty = all present).
 */
export function assertSourceContains(src, fnName, needles) {
  const body = extractFnByName(src, fnName);
  if (body === null) return [`function \`${fnName}\` not found`];
  return needles.filter((n) => !body.includes(n)).map((n) => `\`${fnName}\` no longer contains: ${n}`);
}

// ── internals ────────────────────────────────────────────────────────────────
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Scan forward from `start` to the `;` that ends the statement, ignoring separators
// inside strings, template literals, regex literals, comments and nested brackets.
function scanToStatementEnd(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return -1; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i); if (i < 0) return -1; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { i = skipString(src, i); if (i < 0) return -1; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) return i + 1;
  }
  return -1;
}

function skipString(src, i) {
  const quote = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === quote) return j;
    if (quote !== '`' && src[j] === '\n') return -1; // unterminated single-line string
  }
  return -1;
}
