// @ts-nocheck — plain CLI utility script, never meant to be type-checked; only swept into
// tsc --checkJs's program because it lives under chaingraph/kernels/ (JSDOC-CHECKJS-PREFLIGHT-1's
// path filter watches the whole directory, not just *.kernel.mjs). Without this it fails on bare
// node:fs/process usage — a directory-wide @types/node gap (SO #47's exemption only reaches
// chaingraph/kernels/__proptests__/), same as lint-forbidden-hash.mjs and
// check-guest-builtin-safety.mjs already carry.
// lint-kernel-citation-comments.mjs — KERNEL-CITATION-CLASS-1.
//
// RIDER-KERNEL.md's rule: .kernel.mjs is BEHAVIOUR ONLY. Citations, article numbers, and
// standard references never live in kernel source — they live in node metadata
// (regulatory_basis, cited_clause_digest, description). art-365 shipped a wrong article
// number in a line-49 KERNEL COMMENT; the node was already SEALED, so fixing the comment
// would have moved kernel_digest and demanded a GPU re-prove for a copy edit. Metadata
// citations are a plain PR forever; source citations are a re-prove trap.
//
// This gate flags citation-shaped tokens found in kernel COMMENTS only (never string
// literals — compliance_flags values like 'SFTR_ART15_CONSENT_MISSING' are behavioural
// output data the kernel legitimately emits, not a citation asserted about the source;
// flagging those would just be noise over the existing fleet).
//
// SCOPE — new/changed kernels only (RIDER-KERNEL/KERNEL-CITATION-CLASS-1, load-bearing):
// there are 617 kernels on main and most carry legitimate citation comments already
// (e.g. "// SFTR Art 15", "// MiCA Art.36 mandatory buffer"). An unscoped gate reds the
// whole fleet and tempts someone to edit sealed kernel source just to go green — exactly
// the re-prove trap this row exists to prevent.
//
// TOUCHTAX-DIFFSCOPE-1 (2026-08-27, J19 §3.3): the OLD scoping (`differsFromOriginMain`)
// was FILE-level only — a kernel with ANY unrelated edit re-flagged EVERY citation-shaped
// comment in the whole file, including ones byte-identical to origin/main. Measured: a
// pre-existing `// 20 CFR 404.409-410` at art-282 L13, untouched by the PAYROLL diff,
// blocked it anyway (RULINGS 2026-08-27: "KERNEL-CITATION-CLASS-1 has no pre-existing-debt
// shield, unlike check-clause-digest which shields 587 nodes"). This gate now shields at
// LINE granularity, via the shared scripts/diff-scope.mjs helper (the SAME module wired
// into check-clause-digest.mjs and jsdoc-checkjs — one helper, not three copies): a
// citation-shaped comment on a line byte-identical to origin/main is reported for
// visibility only, never enforced. A hit on a NEW or CHANGED line still fails exactly as
// before — nothing about new bytes is weakened (Tim's no-waiver ruling stands). An
// undeterminable diff (no base ref, shallow clone) fails CLOSED: the whole file is treated
// as in-scope, same as the old brand-new-kernel behaviour, never silently exempted.
//
// Usage:
//   node lint-kernel-citation-comments.mjs --only <id> [--diff-scope <REF>]
//                                                          scoped check for one kernel
//                                                          (exit 1 iff a citation-shaped
//                                                          comment token is found on a
//                                                          NEW/CHANGED line; N-A/exit 0 if
//                                                          the whole file is unchanged vs
//                                                          origin/main)
//   node lint-kernel-citation-comments.mjs --fleet-info   unscoped: scan every kernel,
//                                                          report count as INFO, always
//                                                          exit 0 — never enforced, never
//                                                          wired into a blocking gate.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDiffScopeRef, changedLineSet, isPreExisting } from '../../scripts/diff-scope.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const KERNELS_DIR = resolve(REPO, 'chaingraph', 'kernels');

// IS_MAIN (TOUCHTAX-DIFFSCOPE-1): gates the CLI argv-parsing/execution path so this file can be
// `import`ed for its pure functions (findCitations/classifyHits) by
// lint-kernel-citation-comments.test.mjs without also running a CLI invocation as a side effect
// of the import — the same guard shape check-clause-digest.mjs and jsdoc-checkjs-gate.mjs already
// use, applied here for the first time now that this file has unit-testable pure exports.
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

// Citation-shaped patterns. Tuned against the real fleet (see PROOF section in the
// KERNEL-CITATION-CLASS-1 row check-off for what was tested against, including at least
// one kernel that should NOT trip this).
const PATTERNS = [
  { name: 'Article ref', re: /\bArt(?:icle)?\.?\s?\d+(?:\.\d+)*\b/g },
  { name: 'Section sign', re: /§\s?[A-Za-z]*\d+/g },
  { name: 'ASC ref', re: /\bASC\s?\d{3}-\d{2}\b/g },
  { name: 'ASU ref', re: /\bASU\s?\d{4}-\d{2}\b/g },
  { name: 'IFRS ref', re: /\bIFRS\s?\d+\b/g },
  { name: 'CFR ref', re: /\bCFR\b/g },
  { name: 'EU Directive ref', re: /\bDirective\s?\(EU\)\s?\d{4}\/\d+\b/gi },
];

// Extract // and /* */ comment TEXT ONLY, tracking string/template state so a `//` or
// `/*` inside a string literal is never mistaken for a comment start (and so citation
// tokens living inside ordinary string literals — e.g. compliance_flags values — are
// never scanned at all, by construction, not merely by pattern miss).
function extractComments(src) {
  const comments = []; // { text, line }
  let i = 0;
  let line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      const start = i;
      const startLine = line;
      while (i < n && src[i] !== '\n') i++;
      comments.push({ text: src.slice(start, i), line: startLine });
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = i;
      const startLine = line;
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++;
        i++;
      }
      i += 2;
      comments.push({ text: src.slice(start, i), line: startLine });
      continue;
    }
    if (c === '\'' || c === '"') {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i++;
        if (src[i] === '\n') line++;
        i++;
      }
      i++;
      continue;
    }
    if (c === '`') {
      i++;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '\n') line++;
        i++;
      }
      i++;
      continue;
    }
    i++;
  }
  return comments;
}

// classifyHits — pure split of findCitations() output into { blocking, shielded } given a
// diff-scope `scope` (from scripts/diff-scope.mjs's changedLineSet). Exported so
// lint-kernel-citation-comments.test.mjs can prove the TOUCHTAX-DIFFSCOPE-1 shield with a plain
// fixture — no git, no filesystem. isPreExisting() (imported above) is the single fail-closed
// primitive this defers to; nothing here re-implements or could re-invert that logic.
export function classifyHits(hits, scope) {
  return {
    blocking: hits.filter((h) => !isPreExisting(scope, h.line)),
    shielded: hits.filter((h) => isPreExisting(scope, h.line)),
  };
}

export function findCitations(src) {
  const hits = [];
  for (const { text, line } of extractComments(src)) {
    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        hits.push({ name, token: m[0], line });
      }
    }
  }
  return hits;
}

if (IS_MAIN) {

const onlyIdx = process.argv.indexOf('--only');
const ONLY_ID = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;
const FLEET_INFO = process.argv.includes('--fleet-info');

if (!ONLY_ID && !FLEET_INFO) {
  console.error('Usage: node lint-kernel-citation-comments.mjs --only <id> | --fleet-info');
  process.exit(2);
}

if (ONLY_ID) {
  const KERNEL_PATH = resolve(KERNELS_DIR, `${ONLY_ID}.kernel.mjs`);
  if (!existsSync(KERNEL_PATH)) {
    console.error(`✗ lint-kernel-citation-comments --only ${ONLY_ID}: no ${KERNEL_PATH}`);
    process.exit(2);
  }
  const relPath = `chaingraph/kernels/${ONLY_ID}.kernel.mjs`;
  const baseRef = resolveDiffScopeRef(REPO, { envVar: 'KERNEL_CITATION_BASE_REF' });
  const scope = changedLineSet(REPO, relPath, baseRef);
  const fileUnchanged = scope.ok && !scope.isNew && scope.lines.size === 0;
  if (fileUnchanged) {
    console.log(`· N-A  ${ONLY_ID}: unchanged vs origin/main — out of scope (KERNEL-CITATION-CLASS-1 flags new/changed kernels only).`);
    process.exit(0);
  }
  const src = readFileSync(KERNEL_PATH, 'utf8');
  const hits = findCitations(src);
  // TOUCHTAX-DIFFSCOPE-1: a hit is BLOCKING only if its own line is new/changed vs origin/main.
  // isPreExisting() fails CLOSED by construction (scope.ok===false or scope.isNew===true both
  // report "not shielded"), so an undeterminable diff or a brand-new kernel scans EVERY hit —
  // identical to the old file-level behaviour in exactly the cases that made it fail closed before.
  const { blocking, shielded } = classifyHits(hits, scope);
  if (blocking.length === 0) {
    if (shielded.length) {
      console.log(`✓ PASS ${ONLY_ID}: ${shielded.length} pre-existing citation-shaped token(s) shielded (byte-identical to origin/main, TOUCHTAX-DIFFSCOPE-1 — not re-gated); 0 new.`);
    } else {
      console.log(`✓ PASS ${ONLY_ID}: no citation-shaped tokens in kernel comments.`);
    }
    process.exit(0);
  }
  console.log(`✗ FAIL ${ONLY_ID}: ${blocking.length} NEW/changed citation-shaped token(s) found in kernel comments — move to node metadata (regulatory_basis / cited_clause_digest / description), never a kernel comment or string:`);
  for (const h of blocking) console.log(`    line ${h.line}: [${h.name}] "${h.token}"`);
  if (shielded.length) {
    console.log(`  (${shielded.length} additional citation-shaped token(s) are pre-existing — byte-identical to origin/main — and are NOT counted against this failure, TOUCHTAX-DIFFSCOPE-1.)`);
  }
  process.exit(1);
}

// --fleet-info: unscoped, informational only, never enforced.
const files = readdirSync(KERNELS_DIR).filter((f) => f.endsWith('.kernel.mjs'));
let flaggedCount = 0;
const flaggedIds = [];
for (const f of files) {
  const src = readFileSync(resolve(KERNELS_DIR, f), 'utf8');
  const hits = findCitations(src);
  if (hits.length > 0) {
    flaggedCount++;
    flaggedIds.push(f.replace(/\.kernel\.mjs$/, ''));
  }
}
console.log(`INFO (fleet-wide, unscoped, NOT enforced): ${flaggedCount}/${files.length} existing kernels carry citation-shaped tokens in comments.`);
console.log('These are pre-existing and OUT OF SCOPE for the new/changed-only gate — reported for visibility only, never acted on by this row (RIDER-KERNEL.md SCOPE clause).');
process.exit(0);

} // IS_MAIN
