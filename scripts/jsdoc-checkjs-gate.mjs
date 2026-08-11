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
//       repo accepts: `chaingraph/kernels/__proptests__/*.proptest.mjs` floor
//       files use Node builtins (`node:fs`, `node:path`, `node:url`, `process`)
//       to read fixtures at test time, and this repo never installs @types/node
//       — that is NEW npm surface, which SO #10 bans outright and SO #32's CI-
//       dependency carve-out explicitly does not widen. TS2307 ("cannot find
//       module 'node:…'") and TS2580 ("cannot find name 'process'") are matched
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
// Usage: node scripts/jsdoc-checkjs-gate.mjs <file> [<file> ...]
//   Each <file> is a root file to type-check (same list already computed by
//   the workflow's "List new/touched kernel files" step — passed through as
//   shell array elements, never re-parsed from string). Exit 0 = no blocking
//   diagnostic. Exit 1 = at least one blocking diagnostic, or tsc itself could
//   not run for a reason unrelated to type-checking.

import { spawnSync } from 'node:child_process';

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
export function isAllowlistedNodeGlobal(path, code, message) {
  if (!path.startsWith(PROPTEST_DIR) || !path.endsWith('.proptest.mjs')) return false;
  return NODE_GLOBAL_ALLOWLIST.some((rule) => rule.code === code && rule.pattern.test(message));
}

// classifyDiagnostics — pure function over tsc's raw stdout+stderr text and
// the touched-file list. No filesystem or process access, so a unit test can
// feed it a captured tsc transcript directly. Returns per-line classification
// plus the counts the CLI entry point uses to decide pass/fail.
export function classifyDiagnostics(tscOutput, touchedFiles) {
  const touched = new Set(touchedFiles.map(normalizePath));
  const lines = (tscOutput || '').split(/\r?\n/);

  const classified = [];
  let blocking = 0;
  let ignoredDependency = 0;
  let ignoredAllowlisted = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(DIAG_RE);
    if (!m) {
      classified.push({ kind: 'unparsed', line });
      continue;
    }
    const [, rawPath, , , code, message] = m;
    const path = normalizePath(rawPath);

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
    blocking++;
    classified.push({ kind: 'blocking', line, path, code });
  }

  return { classified, blocking, ignoredDependency, ignoredAllowlisted };
}

// runTsc — the one impure boundary (spawns a child process). Kept separate
// so classifyDiagnostics (the logic this row exists to fix) can be tested
// without a TypeScript install or network access.
export function runTsc(files) {
  // No `shell: true` — args stay an array passed straight to execve, never
  // concatenated into shell text, so nothing here can be reinterpreted as
  // shell syntax. `npx.cmd` on win32 is Windows' own PATHEXT resolution
  // requirement, not a shell invocation; CI (ubuntu-latest) always takes the
  // plain `npx` branch.
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return spawnSync(
    npxCmd,
    [
      '--yes', '--package=typescript@5.7.2', 'tsc',
      '--noEmit', '--checkJs', '--allowJs',
      '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'bundler',
      '--skipLibCheck', '--pretty', 'false',
      ...files,
    ],
    { encoding: 'utf8' },
  );
}

// ── CLI entry point ──────────────────────────────────────────────────────
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {

const files = process.argv.slice(2).filter(Boolean);
if (files.length === 0) {
  console.log('jsdoc-checkjs-gate: no files given — nothing to check.');
  process.exit(0);
}

const result = runTsc(files);
const output = `${result.stdout || ''}${result.stderr || ''}`;
const { classified, blocking, ignoredDependency, ignoredAllowlisted } = classifyDiagnostics(output, files);

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
  else if (c.kind === 'blocking') console.log(`[BLOCKING] ${c.line}`);
  else console.log(c.line);
}

const summaryLine =
  `jsdoc-checkjs-gate summary: ${blocking} blocking, ${ignoredDependency} pre-existing dependency diagnostic(s) ignored, ` +
  `${ignoredAllowlisted} allowlisted (no @types/node) diagnostic(s) ignored, checked ${files.length} touched file(s).`;
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
if (result.status !== 0 && blocking === 0 && ignoredDependency === 0 && ignoredAllowlisted === 0) {
  console.error(`\n✗ jsdoc-checkjs-gate FAILED — tsc exited ${result.status} with no parseable diagnostics (see output above); treating as failure rather than a silent pass.`);
  process.exit(result.status || 1);
}

console.log(`\n✓ jsdoc-checkjs-gate clean — no blocking diagnostics in the touched file set.`);
process.exit(0);

} // IS_MAIN
