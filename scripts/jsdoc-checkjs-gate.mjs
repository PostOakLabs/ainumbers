#!/usr/bin/env node
// jsdoc-checkjs-gate.mjs — scope-corrected wrapper for the incremental
// `tsc --checkJs` CI gate (.github/workflows/jsdoc-checkjs.yml).
//
// PROBLEM THIS FIXES (measured 2026-08-10):
//   The workflow already scopes its own INPUT correctly — it diffs the base/head
//   commit range and passes only new/touched `chaingraph/kernels/**/*.mjs` files
//   to tsc as root files. But `--checkJs` type-checks the whole PROGRAM tsc
//   builds to resolve those roots' types, and reports diagnostics for every file
//   in that program — including a touched file's IMPORTED, completely untouched
//   sibling `.kernel.mjs`. That sibling carries pre-existing type debt (this repo
//   ships plain, hand-authored `.mjs` kernels with no shared runtime dependency,
//   so shapes like `HashMD`, `Uint8Array.fromHex`, or BigInt/number mixing were
//   never typed against a `.d.ts`). Proven with a positive control: running the
//   OLD (unfiltered) tsc invocation against `art-590`'s floor file — already
//   merged, completely untouched by any pending diff — reproduces the identical
//   failure shape, which is what proves the defect is pre-existing and systemic,
//   not caused by any one diff. PR #1160 (a chaingraph assembly PR) hit this
//   for real: its only touched files were 3 new `__proptests__/*.proptest.mjs`
//   floor files, yet the gate failed on diagnostics inside their sibling
//   `.kernel.mjs` files, none of which the diff touched.
//
// THE FIX — two narrow, independently-justified rules, ⛔ not a blanket pass:
//   (1) SCOPE TO TOUCHED FILES. A diagnostic is only ever allowed to FAIL the
//       gate if it is reported against a file in the touched/root set this run
//       was given. A diagnostic against any other file (a dependency tsc pulled
//       in only to resolve types) is pre-existing debt by definition — it is
//       reported to the log for visibility, never counted toward failure.
//   (2) A NARROW, NAMED ALLOWLIST for the one deliberate, permanent gap this
//       repo accepts: any `.mjs` under `chaingraph/kernels/__proptests__/`
//       (floor files, their shared helpers, and helper selftests alike) uses
//       Node builtins (`node:fs`, `node:path`, `node:url`, `process`) to read
//       fixtures at test time, and this repo installs no `@types/node`
//       — SO #47 (2026-08-11) exempts that package narrowly, but it is not
//       reachable in a zero-`package.json` repo without `npm install` (SO #10
//       hard ban); see the DENOISE PASS note above for the measured reason.
//       TS2307 ("cannot find module 'node:…'") and TS2580 ("cannot find name
//       'process'") are matched
//       by BOTH their code AND their message text, and ONLY inside that one
//       directory — a TS2307 for a mistyped relative import, or either code
//       anywhere else, still fails the gate like any other diagnostic.
//
// WHAT THIS DELIBERATELY DOES NOT DO: it does not allowlist any other TS code,
// anywhere, including inside a touched `.kernel.mjs` itself — a brand-new or
// directly-edited kernel with a real type error (e.g. the same `HashMD`/
// `fromHex` shapes, if THAT file is the one being touched) still fails the
// gate. That is intentional: the proven failure mode is dependency drag-in from
// an UNTOUCHED file, and this fix targets exactly that, nothing wider. A gate
// that passes everything is not a fix.
//
// RULE (3) — LINE-SCOPE, not just file-scope (TOUCHTAX-DIFFSCOPE-1, 2026-08-27, J19 §3.3).
// Rule (1) above scopes to touched FILES, but `tsc --checkJs` reports every diagnostic in a
// touched file's whole program — including one on a line this diff never wrote. Measured: the
// `Property 'now' does not exist` diagnostic this file's own DENOISE PASS note already names
// below blocked REGZ-CORRECTION-APPLY-1 (#1502) on three kernels whose only change was a
// one-line COMMENT deletion elsewhere in the same file — a pre-existing type gap, unrelated to
// the diff, re-gated purely because the file was touched at all. A diagnostic on a touched file
// is now BLOCKING only if its own line is new/changed vs origin/main (via the shared
// scripts/diff-scope.mjs helper — the SAME module check-clause-digest.mjs and
// KERNEL-CITATION-CLASS-1 use, one helper, not three copies); a diagnostic on a line
// byte-identical to origin/main is reported for visibility, never blocking. A diagnostic in a
// BRAND-NEW file, or when the diff itself is undeterminable (no base ref, shallow clone), stays
// fully in scope — fails CLOSED, never open (SO #34c). Nothing about a diagnostic on a genuinely
// NEW or CHANGED line is weakened: rule (1)'s own worked example above (the C13 set) already
// relied on every kernel there being untouched; a PR that directly edits a kernel with this exact
// destructuring shape still fails on that kernel's own new/changed lines, exactly as documented.
//
// DENOISE PASS (JSDOC-CHECKJS-DENOISE-1, 2026-08-11) — measured on the
// FV-PROPFLOOR-SHARD-C13-1 file set (PR #1165), 68 raw tsc errors:
//   - `chaingraph/kernels/globals.d.ts` ambient-declares `scalbn` (a hand-
//     ported fdlibm global several kernels call inline, e.g. art-278). This
//     is a true free-standing global, so an ambient declare resolves it with
//     zero kernel edits — verified, drops 4 of the 68.
//   - `tsconfig.check.json` is now the SSOT for compilerOptions (NodeNext
//     module+resolution, paired per TS's own requirement that they agree),
//     read by loadCompilerOptionFlags() below rather than duplicated as a
//     second hardcoded flag list.
//   - SO #47 (2026-08-11) granted a narrow `@types/node` exemption
//     (devDependencies only, CI-only, pinned major) that would resolve the
//     remaining `node:*`/`process`/`Buffer` diagnostics for real instead of
//     via allowlist. It is NOT wired in here: this repo (unlike the worker)
//     ships no `package.json`, `npx --package=@types/node` installs into a
//     content-hashed cache directory outside any resolvable typeRoots, and
//     making it resolve requires either a hardcoded (non-deterministic,
//     breaks on any npx cache-layout change — a #0 SURVIVES-THE-MAINTAINER
//     violation) path scrape, or `npm install`, which SO #10 bans outright
//     with no carve-out for "just this once." Measured, not assumed: see
//     board `JSDOC-CHECKJS-DENOISE-1` check-off for the repro. The rule (2)
//     allowlist below therefore stays live — it is the only working fix for
//     this class today, unchanged from before this pass.
//   - The `Property 'now' does not exist on type '{ parent_hashes?...}'`
//     diagnostic (10 of the 68) is NOT fixed by globals.d.ts and cannot be:
//     it is TypeScript inferring a destructured-parameter type purely from
//     each binding element's OWN default value (`{ now, parent_hashes = [],
//     ... } = {}`), and `now` has no default — an ambient global declaration
//     has no effect on that local, per-call-site inference. The only real
//     fix is a one-line `now = undefined` default in each kernel's own
//     signature, which is a kernel edit and out of this row's fence. It
//     stays non-blocking today only because rule (1) (scope-to-touched)
//     already excludes it whenever the kernel itself is untouched — true for
//     every kernel in the C13 set. A PR that directly adds or edits a
//     kernel with this exact destructuring shape will hit it for real.
//
// Usage: node scripts/jsdoc-checkjs-gate.mjs [--diff-scope <REF>] <file> [<file> ...]
//   Each <file> is a root file to type-check (same list already computed by
//   the workflow's "List new/touched kernel files" step — passed through as
//   shell array elements, never re-parsed from string). Exit 0 = no blocking
//   diagnostic. Exit 1 = at least one blocking diagnostic, or tsc itself could
//   not run for a reason unrelated to type-checking.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDiffScopeRef, changedLineSet } from './diff-scope.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// parseArgv — strip a `--diff-scope <REF>` gate flag out of the file-argument list. Exported and
// unit-tested (JSDOC-GATE-DIFFSCOPE-OFFBYONE-1) so the absent-flag case — indexOf returns -1,
// which an earlier version treated as "exclude index 0" and silently dropped the FIRST file
// argument on every normal invocation — can never regress silently again.
export function parseArgv(argv) {
  const diffScopeArgIdx = argv.indexOf('--diff-scope');
  const files = argv.filter((a, i) => {
    if (!a) return false;
    if (diffScopeArgIdx === -1) return true;
    return i !== diffScopeArgIdx && i !== diffScopeArgIdx + 1;
  });
  return { files, diffScopeRef: diffScopeArgIdx !== -1 ? argv[diffScopeArgIdx + 1] : null };
}

const PROPTEST_DIR = 'chaingraph/kernels/__proptests__/';
// (code, message-pattern) pairs — BOTH must match, and only inside
// PROPTEST_DIR, for a diagnostic to be allowlisted. See header rule (2).
const NODE_GLOBAL_ALLOWLIST = [
  { code: 'TS2307', pattern: /Cannot find module 'node:/ },
  { code: 'TS2580', pattern: /Cannot find name 'process'/ },
];

// tsc --pretty false diagnostic line shape: "<path>(<line>,<col>): error <TSxxxx>: <message>"
const DIAG_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

// normalizePath — strip a leading "./" so a caller-supplied touched path
// compares equal to tsc's own (unprefixed) diagnostic paths either way.
export function normalizePath(p) {
  return p.replace(/^\.\//, '');
}

// isAllowlistedNodeGlobal — pure predicate for rule (2). Exported so a test
// can hit both the true and false branch without invoking tsc.
// Scoped to the DIRECTORY, not an enumerated filename or suffix — any
// `.mjs` under PROPTEST_DIR (floor files, shared helpers, their selftests)
// hits the same no-@types/node gap and needs the same allowlist. A
// filename/suffix list re-breaks on the next shared helper (JSDOC-GATE-
// ALLOWLIST-FIX-1, 2026-08-14: `_pbt-common.mjs` + `.selftest.mjs` were
// excluded by the old `.proptest.mjs`-only suffix check).
export function isAllowlistedNodeGlobal(path, code, message) {
  if (!path.startsWith(PROPTEST_DIR) || !path.endsWith('.mjs')) return false;
  return NODE_GLOBAL_ALLOWLIST.some((rule) => rule.code === code && rule.pattern.test(message));
}

// classifyDiagnostics — pure function over tsc's raw stdout+stderr text, the
// touched-file list, and (TOUCHTAX-DIFFSCOPE-1) an optional per-file changed-
// line map. No filesystem or process access, so a unit test can feed it a
// captured tsc transcript directly. Returns per-line classification plus the
// counts the CLI entry point uses to decide pass/fail.
//
// `changedLinesByFile`: Map<normalizedPath, Set<lineNumber> | 'ALL'>. A path
// ABSENT from the map (the default — omitting the 3rd arg reproduces every
// existing caller's EXACT prior behaviour, byte for byte) or mapped to 'ALL'
// means "no line-level shield available for this file" — every diagnostic on
// a touched file stays fully in scope, same as before this row. Only a path
// mapped to an actual Set() gets line-level shielding, and only for line
// numbers NOT in that set (fail CLOSED: an unmapped/undeterminable file is
// the SAFE default, never the shielded one).
export function classifyDiagnostics(tscOutput, touchedFiles, changedLinesByFile = new Map()) {
  const touched = new Set(touchedFiles.map(normalizePath));
  const lines = (tscOutput || '').split(/\r?\n/);

  const classified = [];
  let blocking = 0;
  let ignoredDependency = 0;
  let ignoredAllowlisted = 0;
  let ignoredPreExisting = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(DIAG_RE);
    if (!m) {
      classified.push({ kind: 'unparsed', line });
      continue;
    }
    const [, rawPath, rawLine, , code, message] = m;
    const path = normalizePath(rawPath);
    const lineNo = parseInt(rawLine, 10);

    if (!touched.has(path)) {
      ignoredDependency++;
      classified.push({ kind: 'ignored-dependency', line, path, code });
      continue;
    }
    if (isAllowlistedNodeGlobal(path, code, message)) {
      ignoredAllowlisted++;
      classified.push({ kind: 'ignored-allowlisted', line, path, code });
      continue;
    }
    const changedSet = changedLinesByFile.get(path);
    if (changedSet && changedSet !== 'ALL' && !changedSet.has(lineNo)) {
      // Line-diff proves this exact line is byte-identical to origin/main — pre-existing type
      // debt this diff did not write, shielded even though the FILE as a whole is touched.
      ignoredPreExisting++;
      classified.push({ kind: 'ignored-pre-existing', line, path, code });
      continue;
    }
    blocking++;
    classified.push({ kind: 'blocking', line, path, code });
  }

  return { classified, blocking, ignoredDependency, ignoredAllowlisted, ignoredPreExisting };
}

// GLOBALS_DTS — ambient scalbn declaration (see its own header for the
// no-top-level-import/export footgun). Always added as an extra root
// alongside the touched files so tsc's type resolution sees it on every
// run; it is never itself a "touched" file, so any diagnostic tsc somehow
// reported against it would fall into ignoredDependency, not blocking.
const GLOBALS_DTS = 'chaingraph/kernels/globals.d.ts';

// TSCONFIG_PATH — SSOT for compiler options (tsconfig.check.json). tsc's
// own --project flag cannot be combined with an explicit file-argument list
// (TS5042: "Option 'project' cannot be mixed with source files on a command
// line"), and passing an explicit file list is exactly how this gate keeps
// checking scoped to touched files only — so this reads the same JSON a
// human would point an editor or `tsc --project` at, and re-applies its
// compilerOptions as CLI flags instead.
const TSCONFIG_PATH = 'tsconfig.check.json';

// loadCompilerOptionFlags — flatten tsconfig.check.json's compilerOptions
// into the CLI flag shape tsc expects. Only the small option-value shapes
// this repo's tsconfig actually uses are handled (boolean, string) — this
// is not a general tsconfig-to-CLI translator.
export function loadCompilerOptionFlags(tsconfigJson) {
  const { compilerOptions } = JSON.parse(tsconfigJson);
  const flags = [];
  for (const [key, value] of Object.entries(compilerOptions)) {
    if (typeof value === 'boolean') {
      if (value) flags.push(`--${key}`);
      else flags.push(`--${key}`, 'false');
    } else {
      flags.push(`--${key}`, String(value));
    }
  }
  return flags;
}

// runTsc — the one impure boundary (spawns a child process). Kept separate
// so classifyDiagnostics (the logic this row exists to fix) can be tested
// without a TypeScript install or network access.
//
// win32 note (JSDOC-CHECKJS-PREFLIGHT-1, 2026-08-16): spawning `npx.cmd`
// directly with `shell` unset throws EINVAL on current Node (measured on
// Node 24 — a regression from the assumption the header comment used to
// make, that PATHEXT resolution alone makes a bare `.cmd` spawnSync-able).
// The naive fix is `shell: true`, but Node's own DEP0190 warning says
// exactly why that is wrong here: with `shell: true` on Windows, a `.cmd`
// spawn's args are NOT safely escaped, only concatenated — reopening the
// shell-metacharacter class this script's header already goes out of its
// way to avoid (filenames are diff-derived, not fully trusted). The actual
// fix is to skip the `.cmd` batch wrapper entirely: `npx`'s real entry
// point is a plain `.js` file (`npx-cli.js`) bundled next to the Node
// binary, and running THAT through `node` is a normal execve of an
// executable with an argv array — no shell, no wrapper, no CVE surface,
// on any platform. Falls back to the old `npx.cmd` spawn only if that file
// is missing (an unusual Node install layout) — CI (ubuntu-latest) never
// takes any win32 branch here.
function resolveWindowsNpxInvocation() {
  const npxCliJs = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  if (existsSync(npxCliJs)) return { cmd: process.execPath, prefixArgs: [npxCliJs] };
  return { cmd: 'npx.cmd', prefixArgs: [] };
}

export function runTsc(files, tsconfigJson) {
  const { cmd, prefixArgs } = process.platform === 'win32'
    ? resolveWindowsNpxInvocation()
    : { cmd: 'npx', prefixArgs: [] };
  return spawnSync(
    cmd,
    [
      ...prefixArgs,
      '--yes', '--package=typescript@5.7.2', 'tsc',
      ...loadCompilerOptionFlags(tsconfigJson),
      ...files,
      GLOBALS_DTS,
    ],
    { encoding: 'utf8' },
  );
}

// ── CLI entry point ──────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {

// --diff-scope <REF> is a gate flag, not a root file — strip it before building the file list
// (parseArgv, JSDOC-GATE-DIFFSCOPE-OFFBYONE-1 — see its own header for the off-by-one this fixes).
const { files } = parseArgv(process.argv.slice(2));
if (files.length === 0) {
  console.log('jsdoc-checkjs-gate: no files given — nothing to check.');
  process.exit(0);
}

// TOUCHTAX-DIFFSCOPE-1: per-touched-file line-diff vs origin/main, via the shared
// scripts/diff-scope.mjs helper. A file whose scope cannot be determined (undeterminable base
// ref, or a brand-new file) is left OUT of the map entirely — classifyDiagnostics's default for
// an absent key is "no shield, fully in scope", which is the fail-CLOSED behaviour SO #34c
// requires. This is a pure lookup add-on: rule (1)'s existing touched-file scoping is unchanged.
const baseRef = resolveDiffScopeRef(REPO, {});
const changedLinesByFile = new Map();
for (const f of files) {
  const rel = normalizePath(f);
  const scope = changedLineSet(REPO, rel, baseRef);
  if (scope.ok && !scope.isNew) changedLinesByFile.set(rel, scope.lines);
  // else: leave unset — undeterminable or brand-new both fall back to "no shield" by omission.
}

const tsconfigJson = readFileSync(TSCONFIG_PATH, 'utf8');
const result = runTsc(files, tsconfigJson);
const output = `${result.stdout || ''}${result.stderr || ''}`;
const { classified, blocking, ignoredDependency, ignoredAllowlisted, ignoredPreExisting } = classifyDiagnostics(output, files, changedLinesByFile);

// GitHub Actions' hosted runner has a DEFAULT tsc problem matcher always
// active (no add-matcher call anywhere in this repo — confirmed by grep).
// It annotates ANY line matching `<path>(<line>,<col>): error TS<code>:
// <message>` — anywhere in stdout, prefix or not — as annotation_level
// "failure". Measured via `gh api .../check-runs/<id>/annotations` on run
// 31486811429: all 10 annotations (GitHub caps at 10/check-run) were
// ignored-class diagnostics, because the raw tsc line was printed verbatim
// for every kind, including ignored ones. formatIgnored re-punctuates the
// SAME path/line/col/message (nothing dropped) so the string no longer
// matches that matcher's regex — no parens, no literal "error TS" token —
// so it still prints but never annotates. The `[BLOCKING]` line for a real
// diagnostic is left byte-identical to tsc's own output so the matcher
// keeps annotating it, unchanged.
function formatIgnored(diagLine) {
  const m = diagLine.match(DIAG_RE);
  if (!m) return diagLine;
  const [, rawPath, line, col, code, message] = m;
  return `${rawPath}:${line}:${col} — ${code}: ${message}`;
}

for (const c of classified) {
  if (c.kind === 'ignored-dependency') console.log(`[pre-existing dependency, not in this diff, ignored] ${formatIgnored(c.line)}`);
  else if (c.kind === 'ignored-allowlisted') console.log(`[allowlisted: no @types/node in __proptests__ floor files (SO #10), ignored] ${formatIgnored(c.line)}`);
  else if (c.kind === 'ignored-pre-existing') console.log(`[pre-existing line, byte-identical to origin/main, TOUCHTAX-DIFFSCOPE-1, ignored] ${formatIgnored(c.line)}`);
  else if (c.kind === 'blocking') console.log(`[BLOCKING] ${c.line}`);
  else console.log(c.line);
}

const summaryLine =
  `jsdoc-checkjs-gate summary: ${blocking} blocking, ${ignoredDependency} pre-existing dependency diagnostic(s) ignored, ` +
  `${ignoredAllowlisted} allowlisted (no @types/node) diagnostic(s) ignored, ${ignoredPreExisting} pre-existing (unchanged) line diagnostic(s) shielded, ` +
  `checked ${files.length} touched file(s).`;
// On a clean run, restate the denominator as a ::notice:: so it's visible
// on the run without mailing a failure digest — a plain console.log line
// here would not annotate at all, but a notice keeps a green run's summary
// as discoverable as a red run's failure summary already is.
if (blocking === 0) console.log(`\n::notice::${summaryLine}`);
else console.log(`\n${summaryLine}`);

if (blocking > 0) {
  console.error(`\n✗ jsdoc-checkjs-gate FAILED — ${blocking} blocking diagnostic(s) in a touched file. See [BLOCKING] lines above.`);
  process.exit(1);
}

// tsc exiting non-zero with zero parseable diagnostics means something other
// than a type error went wrong (bad flags, npx/network failure, a crash) —
// never silently treat that as a pass.
if (result.status !== 0 && blocking === 0 && ignoredDependency === 0 && ignoredAllowlisted === 0 && ignoredPreExisting === 0) {
  console.error(`\n✗ jsdoc-checkjs-gate FAILED — tsc exited ${result.status} with no parseable diagnostics (see output above); treating as failure rather than a silent pass.`);
  process.exit(result.status || 1);
}

console.log(`\n✓ jsdoc-checkjs-gate clean — no blocking diagnostics in the touched file set.`);
process.exit(0);

} // IS_MAIN
