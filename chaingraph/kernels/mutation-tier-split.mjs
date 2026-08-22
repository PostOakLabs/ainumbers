// chaingraph/kernels/mutation-tier-split.mjs — MUTATION-TIERED-ROLLOUT-1
//
// Splits a kernel's mutants into two risk tiers WITHOUT ever editing kernel
// bytes (the row's hard constraint — "No kernel byte changes"):
//
//   money-math tier  — compute() itself PLUS every module-scope helper
//                       function/const compute() calls (bracket lookups,
//                       clamp/round helpers, lookup tables, ...).
//   peripheral tier   — the envelope-building code: the `meta` export, the
//                       TOOL_ID/TOOL_VERSION identity consts, and
//                       buildArtifact() (audit_signature scaffolding,
//                       @context, chain metadata literals, ...).
//
// WHY EXPLICIT BLOCK-FINDING, NOT "EVERYTHING BEFORE buildArtifact()":
// FV-STRYKER-PILOT-1's report (research/FV-STRYKER-PILOT-1-REPORT.md) found
// the pilot's raw blended score was confounded by buildArtifact()/meta —
// code the proptest floors structurally never exercise (they import ONLY
// `compute`, per scripts/run-proptests.mjs's own soundness comment). A first
// pass at this classifier cut money-math as "everything before the
// buildArtifact() line" — WRONG, caught by running it for real against
// art-431: that kernel declares `export const meta = {...}` (and its
// TOOL_ID/TOOL_VERSION consts) BEFORE compute(), not after, so the
// before-buildArtifact cut counted meta's unkillable string/object-literal
// mutants as money-math, undercounting the real score. An estate-wide
// per-kernel order survey (chaingraph.json build note, MUTATION-TIERED-
// ROLLOUT-1 staging pass) confirmed meta's position relative to compute()
// is NOT consistent across kernels — some (art-06) declare it near
// buildArtifact at the bottom, others (art-431) declare it at the top next
// to the TOOL_ID/TOOL_VERSION consts. The only safe fix is to find EACH
// construct's own line range independently (bracket-stack scan, not a line
// cut) and exclude every one of them from money-math, wherever they sit.
//
// THE ONE NAMED EXCEPTION: art-594-tempo-mpp-voucher-receipt-verifier.kernel.mjs
// is a ~6,100-line file (bundled Noble crypto + a SLOW-class in-guest
// signature-verification kernel per GPU-CYCLE-PREFLIGHT-SPEC.md) that exports
// via a trailing `export { compute, meta };` instead of the canonical
// `export function compute` / `export const meta` / `export function
// buildArtifact` shape, so no buildArtifact block can be located and
// `hasCanonicalShape` is false. It is listed, with this reason, in
// mutation-tiers.config.json's `excludedKernels` — run-mutation-tier.mjs
// refuses to guess a split for a non-canonical file rather than silently
// mis-scoring it (SO #34c: absence of a correct answer is not a pass).

/**
 * scanBalanced — generic bracket-stack scan. Starting AT the character
 * index of an opening bracket ('(', '[', or '{'), returns the index of ITS
 * matching close bracket, correctly skipping over any nested brackets of
 * any kind (so a destructuring default like `{ now, x = {} } = {}` inside a
 * parameter list does not confuse a scan for the parameter list's own
 * closing paren) and over string/template literal contents (so a brace or
 * paren character inside a quoted string is never counted). Returns -1 if
 * the source ends before the stack empties (unbalanced/truncated input —
 * the caller must treat that as a classification failure, never a guess).
 *
 * @param {string} text
 * @param {number} startIdx — index of the opening bracket itself
 */
export function scanBalanced(text, startIdx) {
  const OPEN = new Set(['(', '[', '{']);
  const CLOSE = new Set([')', ']', '}']);
  if (!OPEN.has(text[startIdx])) return -1;
  let inStr = null; // "'", '"', '`', or null
  const stack = [];
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') { i++; continue; } // skip escaped char (handles \\, \', \", \`)
      if (c === inStr) inStr = null;
      continue;
    }
    // Comments MUST be recognised before string-delimiter detection below — a
    // line comment containing an apostrophe (e.g. "// ... art-350's ...", a
    // real, measured case) would otherwise be misread as opening a string and
    // desync every bracket/quote after it for the rest of the scan.
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i + 2);
      i = nl === -1 ? text.length : nl; // loop's i++ lands on the char AFTER '\n' (or ends)
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) return -1; // unterminated block comment — unbalanced, fail rather than guess
      i = end + 1; // loop's i++ lands right after the closing '*/'
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (OPEN.has(c)) { stack.push(c); continue; }
    if (CLOSE.has(c)) {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

function lineNumberOfCharIndex(source, charIdx) {
  // 1-indexed line containing charIdx. Counts newlines up to (not including) charIdx.
  let line = 1;
  for (let i = 0; i < charIdx && i < source.length; i++) if (source[i] === '\n') line++;
  return line;
}

/**
 * findObjectExportRange — locate `export const <name> = { ... };` and
 * return its 1-indexed [startLine, endLine] (the `export const` line
 * through the line holding the closing `}`), or null if not found /
 * malformed.
 * @returns {[number, number] | null}
 */
function findObjectExportRange(source, name) {
  const re = new RegExp(`^export\\s+const\\s+${name}\\s*=`, 'm');
  const m = re.exec(source);
  if (!m) return null;
  const eqIdx = m.index + m[0].length;
  // find the first '{' within a short lookahead window (whitespace only expected between '=' and '{')
  const brace = source.indexOf('{', eqIdx);
  if (brace === -1 || source.slice(eqIdx, brace).trim() !== '') return null; // something other than whitespace between '=' and '{' — not a plain object literal, don't guess
  const endIdx = scanBalanced(source, brace);
  if (endIdx === -1) return null;
  return [lineNumberOfCharIndex(source, m.index), lineNumberOfCharIndex(source, endIdx)];
}

/**
 * findFunctionExportRange — locate `export (async )?function <name>(...) { ... }`
 * and return its 1-indexed [startLine, endLine] (declaration line through
 * the line holding the function body's closing `}`), or null if not found.
 * Correctly skips brace-containing parameter defaults (e.g. destructuring
 * with `= {}`) by first bracket-scanning the PARAMETER LIST's own parens.
 * @returns {[number, number] | null}
 */
function findFunctionExportRange(source, name) {
  const re = new RegExp(`^export\\s+(async\\s+)?function\\s+${name}\\s*\\(`, 'm');
  const m = re.exec(source);
  if (!m) return null;
  const parenIdx = m.index + m[0].length - 1; // index of the '(' the regex matched
  const parenEnd = scanBalanced(source, parenIdx);
  if (parenEnd === -1) return null;
  const brace = source.indexOf('{', parenEnd + 1);
  if (brace === -1) return null;
  const bodyEnd = scanBalanced(source, brace);
  if (bodyEnd === -1) return null;
  return [lineNumberOfCharIndex(source, m.index), lineNumberOfCharIndex(source, bodyEnd)];
}

/** @returns {[number, number] | null} */
function findConstLineRange(source, name) {
  const lines = source.split(/\r?\n/);
  const idx = lines.findIndex((l) => new RegExp(`^const\\s+${name}\\b`).test(l));
  return idx === -1 ? null : [idx + 1, idx + 1];
}

/**
 * classifyKernelSource — pure function over one kernel file's source text.
 * Locates the `meta` export, the TOOL_ID/TOOL_VERSION identity consts, and
 * the `buildArtifact` export, and returns their combined line ranges as the
 * peripheral tier. hasCanonicalShape is true only when BOTH `meta` and
 * `buildArtifact` were successfully located (TOOL_ID/TOOL_VERSION are
 * best-effort — their absence never fails the classification, they are a
 * small precision improvement, not a structural requirement every kernel is
 * known to meet).
 *
 * @param {string} source
 * @returns {{ hasCanonicalShape: boolean, peripheralRanges: Array<[number,number]> }}
 */
export function classifyKernelSource(source) {
  const metaRange = findObjectExportRange(source, 'meta');
  const buildRange = findFunctionExportRange(source, 'buildArtifact');
  if (!metaRange || !buildRange) return { hasCanonicalShape: false, peripheralRanges: [] };

  const ranges = [metaRange, buildRange];
  const toolId = findConstLineRange(source, 'TOOL_ID');
  const toolVersion = findConstLineRange(source, 'TOOL_VERSION');
  if (toolId) ranges.push(toolId);
  if (toolVersion) ranges.push(toolVersion);

  return { hasCanonicalShape: true, peripheralRanges: ranges };
}

/**
 * tierOfLine — which tier a given 1-indexed source line belongs to, for a
 * file already known to be the kernel file itself (never called for shared
 * `_*.mjs` helper files — those are ALWAYS money-math, see tierOfMutant).
 * @param {number} line
 * @param {Array<[number,number]>} peripheralRanges
 * @returns {'moneyMath'|'peripheral'}
 */
export function tierOfLine(line, peripheralRanges) {
  for (const [start, end] of peripheralRanges) {
    if (line >= start && line <= end) return 'peripheral';
  }
  return 'moneyMath';
}

// Shared kernel libs (chaingraph/kernels/_*.mjs, e.g. _hash.mjs, _detmath.bundle.mjs)
// are classified as money-math tier unconditionally — they carry no
// buildArtifact()/meta envelope of their own, and the row's scope statement
// ("kernels' compute() and shared kernel libs are the money-math tier")
// names them explicitly.
const SHARED_LIB_RE = /(^|\/)_[^/]+\.mjs$/;

/**
 * isSharedLibPath — true for a chaingraph/kernels/_*.mjs helper path
 * (relative or absolute, forward or back slashes normalized by the caller).
 * @param {string} relPath
 */
export function isSharedLibPath(relPath) {
  return SHARED_LIB_RE.test(relPath.replace(/\\/g, '/'));
}

/**
 * tierOfMutant — classify one Stryker mutant record.
 * @param {{location?: {start?: {line?: number}}}} mutant — start/line are OPTIONAL in the type on purpose: a malformed/incomplete mutant record (missing location entirely) is a real input this function must handle gracefully (classifies 'other', see below), not a shape the caller is trusted to rule out.
 * @param {string} mutantFileRelPath — the path key Stryker's report uses for this mutant (e.g. "chaingraph/kernels/art-431-....kernel.mjs")
 * @param {string} kernelFileRelPath — the SAME path shape for the kernel file under test
 * @param {Array<[number,number]>} peripheralRanges — from classifyKernelSource; empty only for a non-canonical kernel (caller must not reach here for one)
 * @returns {'moneyMath'|'peripheral'|'other'}
 */
export function tierOfMutant(mutant, mutantFileRelPath, kernelFileRelPath, peripheralRanges) {
  const norm = (p) => p.replace(/\\/g, '/');
  if (norm(mutantFileRelPath) === norm(kernelFileRelPath)) {
    const line = mutant?.location?.start?.line;
    if (typeof line !== 'number') return 'other';
    return tierOfLine(line, peripheralRanges);
  }
  if (isSharedLibPath(mutantFileRelPath)) return 'moneyMath';
  return 'other';
}

/**
 * scoreOf — mutation score for a bucket of mutants, SAME formula
 * FV-STRYKER-PILOT-1's run-pilot.mjs used (killed / total, total = every
 * examined mutant regardless of status) — kept identical so a tiered number
 * is directly comparable to the pilot's original blended number, per the
 * row's "calibrate against pilot data" instruction.
 * @param {Array<{status:string}>} mutants
 */
export function scoreOf(mutants) {
  let killed = 0, survived = 0, timeout = 0, noCoverage = 0, other = 0;
  for (const m of mutants) {
    if (m.status === 'Killed') killed++;
    else if (m.status === 'Survived') survived++;
    else if (m.status === 'Timeout') timeout++;
    else if (m.status === 'NoCoverage') noCoverage++;
    else other++;
  }
  const total = mutants.length;
  const score = total > 0 ? Number(((100 * killed) / total).toFixed(1)) : null;
  return { total, killed, survived, timeout, noCoverage, other, score };
}

/**
 * tierReport — buckets every mutant in a Stryker JSON report's `files` map
 * for ONE kernel run into { moneyMath, peripheral, other } and scores each
 * bucket. `report.files` keys are stryker's own reported paths (relative to
 * the scratch cwd Stryker was invoked from) — kernelFileRelPath must be
 * given in that SAME shape (e.g. "chaingraph/kernels/<id>.kernel.mjs").
 *
 * @param {object} report — parsed Stryker mutation-report.json (schema: { files: { [path]: { mutants: [...] } } })
 * @param {string} kernelFileRelPath
 * @param {Array<[number,number]>} peripheralRanges
 */
export function tierReport(report, kernelFileRelPath, peripheralRanges) {
  const buckets = { moneyMath: [], peripheral: [], other: [] };
  const files = report?.files || {};
  for (const [filePath, data] of Object.entries(files)) {
    for (const m of data.mutants || []) {
      const tier = tierOfMutant(m, filePath, kernelFileRelPath, peripheralRanges);
      buckets[tier].push(m);
    }
  }
  return {
    moneyMath: scoreOf(buckets.moneyMath),
    peripheral: scoreOf(buckets.peripheral),
    other: scoreOf(buckets.other), // expected empty; a non-empty bucket means an unrecognised file showed up in the report and the caller should treat that as a hard failure, never silently drop it
  };
}
