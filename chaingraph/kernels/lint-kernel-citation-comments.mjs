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
// the re-prove trap this row exists to prevent. `--only <id>` (the mode kernel-preflight.mjs
// calls) flags a kernel ONLY if its content differs from origin/main or is absent there
// (brand new) — the same differsFromOriginMain scoping kernel-preflight.mjs's own tsc
// check already uses.
//
// Usage:
//   node lint-kernel-citation-comments.mjs --only <id>   scoped check for one kernel
//                                                          (exit 1 iff new/changed AND
//                                                          a citation-shaped comment
//                                                          token is found; N-A/exit 0 if
//                                                          out of scope — unchanged and
//                                                          already on origin/main)
//   node lint-kernel-citation-comments.mjs --fleet-info   unscoped: scan every kernel,
//                                                          report count as INFO, always
//                                                          exit 0 — never enforced, never
//                                                          wired into a blocking gate.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const KERNELS_DIR = resolve(REPO, 'chaingraph', 'kernels');

const onlyIdx = process.argv.indexOf('--only');
const ONLY_ID = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;
const FLEET_INFO = process.argv.includes('--fleet-info');

if (!ONLY_ID && !FLEET_INFO) {
  console.error('Usage: node lint-kernel-citation-comments.mjs --only <id> | --fleet-info');
  process.exit(2);
}

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

function findCitations(src) {
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

function differsFromOriginMain(relPath, absPath) {
  let originContent;
  try {
    originContent = execFileSync('git', ['show', `origin/main:${relPath}`], { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return true; // absent from origin/main — brand-new kernel, genuinely in scope
  }
  return originContent !== readFileSync(absPath, 'utf8');
}

if (ONLY_ID) {
  const KERNEL_PATH = resolve(KERNELS_DIR, `${ONLY_ID}.kernel.mjs`);
  if (!existsSync(KERNEL_PATH)) {
    console.error(`✗ lint-kernel-citation-comments --only ${ONLY_ID}: no ${KERNEL_PATH}`);
    process.exit(2);
  }
  const relPath = `chaingraph/kernels/${ONLY_ID}.kernel.mjs`;
  const inScope = differsFromOriginMain(relPath, KERNEL_PATH);
  if (!inScope) {
    console.log(`· N-A  ${ONLY_ID}: unchanged vs origin/main — out of scope (KERNEL-CITATION-CLASS-1 flags new/changed kernels only).`);
    process.exit(0);
  }
  const src = readFileSync(KERNEL_PATH, 'utf8');
  const hits = findCitations(src);
  if (hits.length === 0) {
    console.log(`✓ PASS ${ONLY_ID}: no citation-shaped tokens in kernel comments.`);
    process.exit(0);
  }
  console.log(`✗ FAIL ${ONLY_ID}: ${hits.length} citation-shaped token(s) found in kernel comments — move to node metadata (regulatory_basis / cited_clause_digest / description), never a kernel comment or string:`);
  for (const h of hits) console.log(`    line ${h.line}: [${h.name}] "${h.token}"`);
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
