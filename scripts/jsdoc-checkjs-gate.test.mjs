#!/usr/bin/env node
// scripts/jsdoc-checkjs-gate.test.mjs — fixture proof for classifyDiagnostics(), including the
// TOUCHTAX-DIFFSCOPE-1 line-scope shield (J19 §3.3). Pure function, no filesystem/git/tsc — feeds
// a captured tsc-shaped transcript directly, so this is fast and exercises the exact REGZ-
// CORRECTION-APPLY-1 (#1502) shape: a touched kernel file carrying ONE new/changed diagnostic
// line plus one PRE-EXISTING (byte-identical to origin/main) diagnostic line elsewhere in the
// same file.
//
// Zero-dependency. Non-zero exit blocks.  node scripts/jsdoc-checkjs-gate.test.mjs

import { classifyDiagnostics, normalizePath, isAllowlistedNodeGlobal, parseArgv } from './jsdoc-checkjs-gate.mjs';

const out = [];
let fail = 0;
const log = (s) => { out.push(s); console.log(s); };
const err = (s) => { out.push(s); console.error(s); fail++; };
const ok = (cond, label) => (cond ? log(`✓ ${label}`) : err(`✗ ${label}`));

log('— pre-existing behaviour (rule 1/2), UNCHANGED by omitting the 3rd arg —');
{
  const tsc = [
    `chaingraph/kernels/art-touched.kernel.mjs(10,5): error TS2339: Property 'now' does not exist on type '{}'.`,
    `chaingraph/kernels/art-untouched-dep.kernel.mjs(4,1): error TS2339: dependency-only diagnostic.`,
  ].join('\n');
  const { blocking, ignoredDependency, ignoredPreExisting } = classifyDiagnostics(tsc, ['chaingraph/kernels/art-touched.kernel.mjs']);
  ok(blocking === 1, 'the touched file diagnostic is blocking (no map = no shield, old behaviour preserved)');
  ok(ignoredDependency === 1, 'the untouched dependency diagnostic is ignored-dependency, as before');
  ok(ignoredPreExisting === 0, 'ignoredPreExisting is 0 when no changedLinesByFile map is given at all');
}

log('— TOUCHTAX-DIFFSCOPE-1: the REGZ #1502 shape — one new line, one pre-existing line, same file —');
{
  const path = 'chaingraph/kernels/art-regz.kernel.mjs';
  const tsc = [
    `${path}(10,5): error TS2339: Property 'now' does not exist on type '{}'.`, // pre-existing, unrelated line
    `${path}(42,3): error TS2322: Type mismatch on the actually-edited line.`,   // new/changed line
  ].join('\n');
  const changedLinesByFile = new Map([[path, new Set([42])]]); // ONLY line 42 changed vs origin/main
  const { classified, blocking, ignoredPreExisting } = classifyDiagnostics(tsc, [path], changedLinesByFile);
  ok(blocking === 1, 'exactly one BLOCKING diagnostic — the one on the new/changed line 42');
  ok(ignoredPreExisting === 1, 'exactly one pre-existing diagnostic shielded — line 10, byte-identical to origin/main');
  const blockingLine = classified.find((c) => c.kind === 'blocking');
  ok(blockingLine && blockingLine.line.includes('(42,3)'), 'the blocking entry is the line-42 diagnostic, not line 10');
  const shieldedLine = classified.find((c) => c.kind === 'ignored-pre-existing');
  ok(shieldedLine && shieldedLine.line.includes('(10,5)'), 'the shielded entry is the line-10 diagnostic');
}

log('— fail CLOSED: a file absent from changedLinesByFile (undeterminable/brand-new) gets NO shield —');
{
  const path = 'chaingraph/kernels/art-undeterminable.kernel.mjs';
  const tsc = `${path}(10,5): error TS2339: some pre-existing-looking diagnostic.`;
  const changedLinesByFile = new Map(); // path deliberately absent — simulates undeterminable/new
  const { blocking, ignoredPreExisting } = classifyDiagnostics(tsc, [path], changedLinesByFile);
  ok(blocking === 1, 'with no scope entry for this file, the diagnostic stays BLOCKING — never silently shielded');
  ok(ignoredPreExisting === 0, 'zero pre-existing-shielded — absence of scope information is not evidence of pre-existing debt');
}

log(`— fail CLOSED (explicit): the 'ALL' sentinel (brand-new file) shields nothing —`);
{
  const path = 'chaingraph/kernels/art-brandnew.kernel.mjs';
  const tsc = `${path}(1,1): error TS2339: diagnostic in a brand-new file.`;
  const changedLinesByFile = new Map([[path, 'ALL']]);
  const { blocking, ignoredPreExisting } = classifyDiagnostics(tsc, [path], changedLinesByFile);
  ok(blocking === 1, `'ALL' sentinel never shields — brand-new files stay fully in scope`);
  ok(ignoredPreExisting === 0, 'zero shielded under the ALL sentinel');
}

log('— allowlist (rule 2) still takes priority over line-shielding, same as before —');
{
  const path = 'chaingraph/kernels/__proptests__/art-x.proptest.mjs';
  const tsc = `${path}(3,1): error TS2307: Cannot find module 'node:fs'.`;
  const changedLinesByFile = new Map([[path, new Set([99])]]); // line 3 NOT in the changed set
  const { blocking, ignoredAllowlisted, ignoredPreExisting } = classifyDiagnostics(tsc, [path], changedLinesByFile);
  ok(ignoredAllowlisted === 1, 'the node-global allowlist still classifies this as ignored-allowlisted');
  ok(blocking === 0 && ignoredPreExisting === 0, 'never double-counted into pre-existing OR blocking');
  ok(isAllowlistedNodeGlobal(path, 'TS2307', "Cannot find module 'node:fs'."), 'sanity: the predicate itself still matches (unchanged export)');
}

log('— normalizePath is unchanged (sanity import check) —');
ok(normalizePath('./a/b.mjs') === 'a/b.mjs', 'strips a leading ./');

log('— parseArgv: JSDOC-GATE-DIFFSCOPE-OFFBYONE-1 regression — the normal (flag-absent) case —');
{
  // This is THE real invocation shape: preflight.mjs / CI never pass --diff-scope. An earlier
  // version of this filter treated indexOf('--diff-scope')===-1 as "exclude index -1+1===0" and
  // silently dropped the FIRST file argument — caught live landing REGZ-CORRECTION-APPLY-1 (#1502),
  // where `--only art-218 art-220 art-234` reported "checked 2 touched file(s)", not 3.
  const { files, diffScopeRef } = parseArgv(['art-218.kernel.mjs', 'art-220.kernel.mjs', 'art-234.kernel.mjs']);
  ok(files.length === 3, `all 3 files survive when --diff-scope is absent (got ${files.length})`);
  ok(files[0] === 'art-218.kernel.mjs', 'the FIRST file is NOT dropped (the exact regression)');
  ok(diffScopeRef === null, 'diffScopeRef is null when the flag is absent');
}

log('— parseArgv: --diff-scope <REF> IS stripped correctly when present, anywhere in argv —');
{
  const atStart = parseArgv(['--diff-scope', 'abc123', 'a.mjs', 'b.mjs']);
  ok(atStart.files.length === 2 && atStart.files[0] === 'a.mjs' && atStart.files[1] === 'b.mjs', 'flag+value at start: both files survive, ref stripped');
  ok(atStart.diffScopeRef === 'abc123', 'diffScopeRef captured correctly (flag at start)');

  const atEnd = parseArgv(['a.mjs', 'b.mjs', '--diff-scope', 'def456']);
  ok(atEnd.files.length === 2 && atEnd.files[0] === 'a.mjs' && atEnd.files[1] === 'b.mjs', 'flag+value at end: both files survive');
  ok(atEnd.diffScopeRef === 'def456', 'diffScopeRef captured correctly (flag at end)');
}

log('— parseArgv: no files at all —');
ok(parseArgv([]).files.length === 0, 'empty argv yields an empty file list, not a crash');

log("— JSDOC-BUFFER-ALLOWLIST-1: the shared buildArtifact signature (TS2339 now) ignore class —");
{
  // The EXACT estate-wide shape (census: 597 of 638 kernels): TS2339, property now, inferred
  // shape { parent_hashes?... } -- the buildArtifact(pp, { now, ... } = {}) signature.
  const path = "chaingraph/kernels/art-anysig.kernel.mjs";
  const sharedTsc = [
    `${path}(234,43): error TS2339: Property ${String.fromCharCode(39)}now${String.fromCharCode(39)} does not exist on type ${String.fromCharCode(123)} parent_hashes?: undefined[]; parent_tool_ids?: undefined[]; chain_depth?: number; ${String.fromCharCode(125)}.`,
  ].join("");
  const shared = classifyDiagnostics(sharedTsc, [path]);
  ok(shared.ignoredSharedSignature === 1, "the shared buildArtifact signature diagnostic is ignored-shared-signature (one landing, 597 kernels)");
  ok(shared.blocking === 0, "zero blocking for the shared signature alone");
  // FALSE BRANCH A: same code TS2339, DIFFERENT property -- must stay blocking.
  const otherProp = `${path}(10,1): error TS2339: Property foo does not exist on type { parent_hashes?: undefined[]; }.`;
  ok(classifyDiagnostics(otherProp, [path]).blocking === 1, "a TS2339 on a DIFFERENT property (foo) is still BLOCKING");
  // FALSE BRANCH B: property now, DIFFERENT inferred shape ({} -- not the shared signature) -- blocking.
  const otherShape = `${path}(10,1): error TS2339: Property now does not exist on type {}.`;
  ok(classifyDiagnostics(otherShape, [path]).blocking === 1, "a TS2339 now on a DIFFERENT shape ({}) is still BLOCKING");
  // FALSE BRANCH C: different code entirely -- blocking.
  const otherCode = `${path}(10,1): error TS2304: Cannot find name nope.`;
  ok(classifyDiagnostics(otherCode, [path]).blocking === 1, "a genuine TS2304 is still BLOCKING (the gate stays real)");
}
console.log(`\n${fail} failure(s) of ${out.filter((s) => s.startsWith('✓') || s.startsWith('✗')).length} assertion(s).`);
process.exit(fail ? 1 : 0);
