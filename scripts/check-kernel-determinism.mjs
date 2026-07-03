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
// PRE-EXISTING VIOLATIONS BASELINE: files in "hard_ban_baseline" have confirmed
// real violations that pre-date this gate and are tracked for remediation. They
// produce a warning, not an error. New violations NOT in the baseline fail the gate.
// Baseline is downward-ratchet only: removing an entry without fixing the code errors.
//
// Wire: scripts/preflight.mjs + .github/workflows/deploy-to-dreamhost.yml

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

// Pre-existing violations: Set of "file:line" keys that existed before this gate
// and are tracked for remediation but must not block the gate from being shipped.
const BASELINE_SET = new Set(
  (Array.isArray(allowlist.hard_ban_baseline)
    ? allowlist.hard_ban_baseline                      // flat array (legacy)
    : (allowlist.hard_ban_baseline?.entries ?? [])     // new { entries: [...] } form
  ).map(e => `${e.file}:${e.line}`)
);

// Hard-ban patterns: [label, regex]
const HARD_BANS = [
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
function stripCommentsLine(raw, inBlock) {
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

let errors = 0;
let warnings = 0;
let filesScanned = 0;
const staleAllowlist = new Set(ALLOWED_TRANSCENDENTALS);
// Track which baseline entries were actually seen (stale baseline detection)
const baselineSeen = new Set();

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

if (errors) {
  console.error(`\n✗ kernel-determinism FAILED — ${errors} new violation(s) across ${filesScanned} kernel(s).`);
  if (warnings) console.error(`  (${warnings} pre-existing baseline violation(s) warned separately.)`);
  console.error('  Fix: replace banned construct with a deterministic equivalent (e.g. fmtEnUS()');
  console.error('  for toLocaleString), or for transcendentals add the file to the allowlist.');
  process.exit(1);
}
if (warnings) {
  console.log(`⚠  kernel-determinism PASSED with ${warnings} baseline warning(s) (${filesScanned} kernels).`);
  console.log(`   Baseline violations are pre-existing and tracked for remediation.`);
} else {
  console.log(`✓ kernel-determinism clean — ${filesScanned} kernel(s), 0 violations.`);
}
