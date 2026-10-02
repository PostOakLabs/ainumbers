// check-kernel-determinism.mjs — hard-ban locale/time/random/env-sensitive constructs
// inside every kernel's compute() execution path.
//
// WHY: non-deterministic constructs produce execution_hash values that diverge across
// locales, runtimes, or invocation times, corrupting §17/§18 trust signals. art-09's
// toLocaleString() bug (2026-07-02) was the proof-of-value: on a non-en-US host the
// computed execution_hash differed from the golden fixture. This gate makes that
// impossible to commit silently.
//
// WHAT IS BANNED (whole kernel file, minus all comments):
//   Math.random()          — CSPRNG, non-deterministic
//   Date.now()             — current time
//   new Date()             — no-arg = current time (new Date(isoStr) is fine)
//   .toLocaleString()      — locale/ICU-dependent (ALL forms, incl. with locale arg)
//   .toLocaleDateString()  — same
//   .toLocaleTimeString()  — same
//   .toLocaleLowerCase()   — locale/ICU-dependent
//   .toLocaleUpperCase()   — locale/ICU-dependent
//   Intl.                  — locale/ICU-dependent
//   .localeCompare()       — locale-dependent collation
//   \p{} regex escapes     — Unicode property escapes (engine ICU-dependent)
//   .normalize()           — String.prototype.normalize (ICU-dependent)
//   WeakRef                — GC timing-dependent
//   FinalizationRegistry   — GC timing-dependent
//   process.               — Node-specific (not in QuickJS guest)
//   performance.now        — monotonic timer, non-deterministic
//
// COMMENT HANDLING: strips both // single-line and /* */ block comments (incl.
// JSDoc /** */) before scanning, so patterns mentioned in docs don't trigger.
//
// TRANSCENDENTAL ALLOWLIST:
//   Math.exp / expm1 / log / log1p / log2 / log10 / sin / cos / tan /
//   asin / acos / atan / atan2 / sinh / cosh / tanh / cbrt / pow / hypot
//   are engine-approximated (libm implementation-defined per ECMA-262). Files
//   in kernel-determinism-allowlist.json "transcendentals" may use them; new uses
//   FAIL unless the file is explicitly added (deliberate human decision).
//
// IMPORT-SPECIFIER RULE (KERNEL-IMPORT-SPECIFIER-LINT-1, 2026-10-01): the §18 guest
// loader resolves ONLY ./_hash.mjs (STP-WAVE-COMPLIANCE-RIDERS.md L46–47), and
// chaingraph/vm/kernel-vm.mjs strips every import line before running a kernel
// (L262–269), so vm-parity-gate and GUEST-BUILTIN-GATE-1 cannot see a bad specifier —
// the failure first surfaces inside a real §18 prove (art-106/108/110 shipped a static
// _proof import at efaf79b3 and failed until 903aeb9a made it lazy). Therefore:
//   STATIC  import … from '<spec>' / export … from '<spec>' / bare import '<spec>'
//           → <spec> must be exactly './_hash.mjs'.
//   DYNAMIC import('<spec>')
//           → the (file, spec) pair must be listed in kernel-determinism-allowlist.json
//             "imports" (deliberate human decision, transcendentals precedent). Even a
//             dynamic './_hash.mjs' needs an entry: the QuickJS-ng eager-linking runtime
//             rejects dynamic module loading outright (art-336, S18-ART336-FIX-1).
// Deliberately NOT a HARD_BANS entry: HARD_BANS is imported by the page-side
// determinism gate (see below), and pages legitimately import more than _hash.
// Text linter, same class as the ban scan: line-based, comments stripped (art-336:76's
// doc mention stays inert), strings/template literals not parsed, single-line imports.
//
// PRE-EXISTING VIOLATIONS BASELINE: files in "hard_ban_baseline" have confirmed
// real violations that pre-date this gate and are tracked for remediation. They
// produce a warning, not an error. New violations NOT in the baseline fail the gate.
// Baseline is downward-ratchet only: removing an entry without fixing the code errors.
//
// Wire: scripts/preflight.mjs + .github/workflows/deploy-to-dreamhost.yml
//
// THIS FILE IS THE SINGLE SOURCE OF THE BAN LIST (PAGEDET-GATE-1, 2026-07-28).
// `check-page-determinism.mjs` applies the SAME constructs to node/tool PAGES, but
// scoped by REACHABILITY into the execution_hash preimage rather than whole-file
// presence (pages legitimately format for display). It imports `HARD_BANS` and
// `stripCommentsLine` from here, so a construct added below covers both surfaces at
// once and there is never a second copy of the list. The scan below therefore runs
// only when this file is executed directly.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const KERNELS_DIR = resolve(HERE, '..', 'chaingraph', 'kernels');
const ALLOWLIST_PATH = resolve(HERE, 'kernel-determinism-allowlist.json');

const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
const ALLOWED_TRANSCENDENTALS = new Set(
  Array.isArray(allowlist.transcendentals)
    ? allowlist.transcendentals                        // flat array (legacy)
    : (allowlist.transcendentals?.files ?? [])         // new { files: [...] } form
);

// DYNAMIC import() allowlist: Set of "file\0spec" keys from the allowlist's "imports"
// key (scanImports below). Absent key → empty set: any dynamic import then fails, the
// correct default for new kernels.
const ALLOWED_DYNAMIC_IMPORTS = new Set(
  (Array.isArray(allowlist.imports)
    ? allowlist.imports                              // flat array (legacy)
    : (allowlist.imports?.entries ?? [])             // new { entries: [...] } form
  ).map(e => `${e.file}\u0000${e.spec}`)
);

// Pre-existing violations: Set of "file:line" keys that existed before this gate
// and are tracked for remediation but must not block the gate from being shipped.
const BASELINE_SET = new Set(
  (Array.isArray(allowlist.hard_ban_baseline)
    ? allowlist.hard_ban_baseline                      // flat array (legacy)
    : (allowlist.hard_ban_baseline?.entries ?? [])     // new { entries: [...] } form
  ).map(e => `${e.file}:${e.line}`)
);

// Hard-ban patterns: [label, regex]
// EXPORTED: check-page-determinism.mjs consumes this list. Do not copy it.
export const HARD_BANS = [
  ['Math.random()',         /\bMath\.random\s*\(/],
  ['Date.now()',            /\bDate\.now\s*\(/],
  ['new Date() (no-arg)',  /\bnew\s+Date\s*\(\s*\)/],
  ['.toLocaleString()',     /\.toLocaleString\s*\(/],
  ['.toLocaleDateString()', /\.toLocaleDateString\s*\(/],
  ['.toLocaleTimeString()', /\.toLocaleTimeString\s*\(/],
  ['.toLocaleLowerCase()',  /\.toLocaleLowerCase\s*\(/],
  ['.toLocaleUpperCase()',  /\.toLocaleUpperCase\s*\(/],
  ['Intl.',                 /\bIntl\s*\./],
  ['.localeCompare()',      /\.localeCompare\s*\(/],
  ['\\p{} regex escape',   /\\p\{/],
  ['.normalize()',          /\.normalize\s*\(/],
  ['WeakRef',              /\bWeakRef\b/],
  ['FinalizationRegistry', /\bFinalizationRegistry\b/],
  ['process.',             /\bprocess\s*\./],
  ['performance.now',      /\bperformance\s*\.\s*now\b/],
  // Raw C0 control characters in source (NUL..BS, VT, FF, SO..US) — excludes
  // tab/LF/CR. A raw control char inside a string-literal sentinel is parsed
  // differently by V8 vs JavaScriptCore (caught art-189's raw-NUL sentinel:
  // identical on V8/QuickJS-ng, divergent on JSC/Bun). Use an escape ()
  // or a printable sentinel instead.
  ['raw control char in source', /[\x00-\x08\x0B\x0C\x0E-\x1F]/],
];

const TRANSCENDENTAL_RE = /\bMath\.(exp|expm1|log1p|log2|log10|log|sin|cos|tan|asin|acos|atan2|atan|sinh|cosh|tanh|cbrt|pow|hypot)\s*\(/;

// Strip both // and /* */ comments from a line, tracking block-comment state.
// Returns { code, inBlock } where inBlock is the updated state after this line.
export function stripCommentsLine(raw, inBlock) {
  let code = raw;

  if (inBlock) {
    const endPos = code.indexOf('*/');
    if (endPos !== -1) {
      inBlock = false;
      code = code.slice(endPos + 2); // continue scanning after */
    } else {
      return { code: '', inBlock }; // whole line is inside block comment
    }
  }

  // Remove /* ... */ spans on this line (loop to handle multiple on one line)
  let startPos;
  while ((startPos = code.indexOf('/*')) !== -1) {
    const endPos = code.indexOf('*/', startPos + 2);
    if (endPos === -1) {
      // Block comment extends past this line
      inBlock = true;
      code = code.slice(0, startPos);
      break;
    }
    code = code.slice(0, startPos) + ' ' + code.slice(endPos + 2);
  }

  // Strip trailing // single-line comment
  code = code.replace(/\/\/.*$/, '');
  return { code, inBlock };
}

// Import-specifier patterns: [kind, regex] (KERNEL-IMPORT-SPECIFIER-LINT-1).
// Separate from HARD_BANS on purpose — HARD_BANS is consumed by the page-side
// determinism gate (header above) and pages are out of scope for this rule.
// The lookbehind excludes property access (`obj.import(`) and identifiers merely
// ending in "import"; the trailing \b excludes `importx`-style identifiers.
// /g + matchAll: every occurrence reported, and matchAll never advances the
// shared pattern objects' lastIndex across lines or files.
const IMPORT_SPEC_PATTERNS = [
  ['static import-from',      /(?<![\w$.])import\b\s*[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g],
  ['static export-from',      /(?<![\w$.])export\b\s*[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g],
  ['bare side-effect import', /(?<![\w$.])import\b\s*['"]([^'"]+)['"]/g],
  ['dynamic import()',        /(?<![\w$.])import\b\s*\(\s*['"]([^'"]+)['"]/g],
];

// Scan one kernel module's lines for import-specifier violations. Returns
// { violations: [{ line, kind, spec }], dynamicImports: [spec] } where dynamicImports
// lists EVERY dynamic import() specifier found (allowlisted or not) so callers can
// reconcile the "imports" allowlist against the tree. Runs on comment-stripped code
// via the same stripper as the ban scan.
export function scanImports(fname, lines) {
  const violations = [];
  const dynamicImports = [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const { code, inBlock: nextBlock } = stripCommentsLine(lines[i], inBlock);
    inBlock = nextBlock;
    if (!code.trim()) continue;
    for (const [kind, re] of IMPORT_SPEC_PATTERNS) {
      for (const m of code.matchAll(re)) {
        const spec = m[1];
        if (kind === 'dynamic import()') {
          dynamicImports.push(spec);
          if (!ALLOWED_DYNAMIC_IMPORTS.has(`${fname}\u0000${spec}`)) {
            violations.push({ line: i + 1, kind, spec });
          }
        } else if (spec !== './_hash.mjs') {
          violations.push({ line: i + 1, kind, spec });
        }
      }
    }
  }
  return { violations, dynamicImports };
}

function main() {
let errors = 0;
let warnings = 0;
let filesScanned = 0;
let importViolationsCount = 0;
const staleAllowlist = new Set(ALLOWED_TRANSCENDENTALS);
// Track which baseline entries were actually seen (stale baseline detection)
const baselineSeen = new Set();
// Import-allowlist reconciliation (KERNEL-IMPORT-SPECIFIER-LINT-1)
const allowedDynamicSeen = new Set();
const staleImports = new Set(ALLOWED_DYNAMIC_IMPORTS);

for (const fname of readdirSync(KERNELS_DIR).sort()) {
  if (!fname.endsWith('.kernel.mjs')) continue;
  filesScanned++;

  const fpath = resolve(KERNELS_DIR, fname);
  const lines = readFileSync(fpath, 'utf8').split('\n');
  const isAllowlisted = ALLOWED_TRANSCENDENTALS.has(fname);
  if (isAllowlisted) staleAllowlist.delete(fname);

  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const ln = i + 1;
    const { code, inBlock: nextBlock } = stripCommentsLine(raw, inBlock);
    inBlock = nextBlock;
    if (!code.trim()) continue;

    const key = `${fname}:${ln}`;

    // Hard-ban checks
    for (const [label, pattern] of HARD_BANS) {
      if (pattern.test(code)) {
        if (BASELINE_SET.has(key)) {
          baselineSeen.add(key);
          console.warn(`⚠  BASELINE [${label}]  ${key}  (pre-existing; tracked for remediation)`);
          warnings++;
        } else {
          console.error(`✗ HARD-BAN [${label}]  ${fname}:${ln}`);
          console.error(`    ${raw.trim()}`);
          errors++;
        }
      }
    }

    // Transcendental check (allowlist-gated; baseline not applicable)
    if (TRANSCENDENTAL_RE.test(code) && !isAllowlisted) {
      console.error(`✗ TRANSCENDENTAL not in allowlist  ${fname}:${ln}`);
      console.error(`    ${raw.trim()}`);
      console.error(`    Add "${fname}" to scripts/kernel-determinism-allowlist.json`);
      console.error(`    only if the call is intentionally pinned (fdlibm swap or guest-identical).`);
      errors++;
    }
  }

  // Import-specifier check (KERNEL-IMPORT-SPECIFIER-LINT-1) — a second pass over the
  // same comment-stripped lines, deliberately NOT folded into HARD_BANS: HARD_BANS is
  // imported by the page-side determinism gate, and pages legitimately import beyond
  // _hash. The §18 guest loader resolves ONLY './_hash.mjs'.
  const { violations: importViolations, dynamicImports } = scanImports(fname, lines);
  for (const v of importViolations) {
    console.error(`✗ IMPORT-SPEC [${v.kind}]  ${fname}:${v.line}  → "${v.spec}"`);
    console.error(`    ${lines[v.line - 1].trim()}`);
    console.error(`    kernel-vm strips import lines before running, so no vm gate sees this —`);
    console.error(`    a real §18 prove fails on it first (efaf79b3 → 903aeb9a precedent).`);
    if (v.kind === 'dynamic import()') {
      console.error(`    Allowlist ONLY a lazy signer path the guest never resolves: add`);
      console.error(`    { "file": "${fname}", "spec": "${v.spec}" } to kernel-determinism-allowlist.json "imports".`);
    } else {
      console.error(`    Fix: import from './_hash.mjs' or inline the code (the guest resolves nothing else).`);
    }
    errors++;
    importViolationsCount++;
  }
  for (const spec of dynamicImports) {
    const key = `${fname}\u0000${spec}`;
    if (ALLOWED_DYNAMIC_IMPORTS.has(key)) {
      allowedDynamicSeen.add(key);
      staleImports.delete(key);
    }
  }
}

// Stale allowlist entries (file no longer exists)
for (const stale of staleAllowlist) {
  console.error(`⚠  stale allowlist entry "${stale}" — file not found in chaingraph/kernels/`);
}

// Stale baseline entries (code was fixed, entry should be removed)
for (const key of BASELINE_SET) {
  if (!baselineSeen.has(key)) {
    console.warn(`⚠  stale baseline "${key}" — violation no longer present; remove from hard_ban_baseline.`);
  }
}

// Stale import-allowlist entries ((file, spec) no longer present in the tree)
for (const key of staleImports) {
  const [file, spec] = key.split('\u0000');
  console.warn(`⚠  stale import allowlist entry "${file}" → "${spec}" — not present in chaingraph/kernels/; remove from "imports".`);
}

if (errors) {
  console.error(`\n✗ kernel-determinism FAILED — ${errors} new violation(s) across ${filesScanned} kernel(s).`);
  if (warnings) console.error(`  (${warnings} pre-existing baseline violation(s) warned separately.)`);
  console.error('  Fix: replace banned construct with a deterministic equivalent (e.g. fmtEnUS()');
  console.error('  for toLocaleString), or for transcendentals add the file to the allowlist.');
  process.exit(1);
}
if (warnings) {
  console.log(`⚠  kernel-determinism PASSED with ${warnings} baseline warning(s) — ${filesScanned} modules scanned, 0 violations, ${importViolationsCount} import-specifier violations, ${allowedDynamicSeen.size} allowlisted dynamic import(s).`);
  console.log(`   Baseline violations are pre-existing and tracked for remediation.`);
} else {
  console.log(`✓ kernel-determinism clean — ${filesScanned} modules scanned, 0 violations, ${importViolationsCount} import-specifier violations, ${allowedDynamicSeen.size} allowlisted dynamic import(s).`);
}
}

// Run the scan only when executed directly. Importing this module (which
// check-page-determinism.mjs does, for HARD_BANS) must not run the kernel gate.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
