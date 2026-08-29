#!/usr/bin/env node
/**
 * run-mutation-tier.test.mjs — control for copySandboxDeps() (SANDBOX-FILELIST-SWEEP-2).
 *
 * WHAT THIS PROVES. Before this row, run-mutation-tier.mjs primed its Stryker scratch sandbox by
 * copying every `chaingraph/kernels/_*.mjs` and `chaingraph/kernels/__proptests__/_*.mjs` file — a
 * filename CONVENTION, not a derivation from what the copied kernel/proptest pair actually imports.
 * It looked derived and was not: a shared helper introduced without the `_` prefix, or a proptest
 * that started importing a non-underscore sibling, would be silently left out of the sandbox and
 * break with an opaque ERR_MODULE_NOT_FOUND deep inside Stryker's command runner — the exact defect
 * class SANDBOX-FILELIST-GATE-1 (PR #1505) already fixed once for check-shard-assembly.test.mjs and
 * check-nav-reachability.test.mjs.
 *
 * R1 below REPRODUCES that near-miss against a throwaway fixture repo (never real kernels — the
 * estate has none today, verified: every proptest that imports a sibling helper imports exactly
 * `./_pbt-common.mjs`) using a standalone copy of the OLD convention-based logic, so the failure
 * mode is demonstrated rather than asserted. R2 proves copySandboxDeps() — the code actually wired
 * into run-mutation-tier.mjs today — gets the same fixture right. R3 proves a genuinely missing
 * dependency still fails, but with ONE NAMED line, never a bare ERR_MODULE_NOT_FOUND (SO #40(b)).
 *
 * Run: node scripts/run-mutation-tier.test.mjs
 */

import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copySandboxDeps } from './run-mutation-tier.mjs';

let passed = 0;
let failed = 0;
const cleanup = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

process.on('exit', () => {
  for (const d of cleanup) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
});

/**
 * A throwaway repo shaped like chaingraph/kernels/: one kernel, one proptest that imports a
 * SIBLING helper without the `_` prefix — the shape derivation must catch and the old
 * filename-convention copier could not.
 */
function buildFixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'rmt-fixture-'));
  cleanup.push(root);
  const kernelsDir = join(root, 'chaingraph', 'kernels');
  const proptestsDir = join(kernelsDir, '__proptests__');
  mkdirSync(kernelsDir, { recursive: true });
  mkdirSync(proptestsDir, { recursive: true });
  writeFileSync(join(kernelsDir, 'fixture-id.kernel.mjs'), "export function buildArtifact() { return 1; }\n");
  // NOT underscore-prefixed — a plain sibling helper, e.g. a second-generation kernel sharing a
  // small utility with its own proptest instead of the estate-wide `_pbt-common.mjs`.
  writeFileSync(join(proptestsDir, 'helper.mjs'), "export const scale = (n) => n * 2;\n");
  writeFileSync(join(proptestsDir, 'fixture-id.proptest.mjs'),
    "import { scale } from './helper.mjs';\nconsole.log(scale(1));\n");
  mkdirSync(join(kernelsDir, 'fixtures'), { recursive: true });
  writeFileSync(join(kernelsDir, 'fixtures', 'fixture-id.fixtures.json'), '{}\n');
  return {
    root,
    kernelRelPath: 'chaingraph/kernels/fixture-id.kernel.mjs',
    proptestRelPath: 'chaingraph/kernels/__proptests__/fixture-id.proptest.mjs',
    fixturesRelPath: 'chaingraph/kernels/fixtures/fixture-id.fixtures.json',
    helperRelPath: 'chaingraph/kernels/__proptests__/helper.mjs',
  };
}

/**
 * The OLD copier: everything starting with `_` in kernels/ and kernels/__proptests__/, plus the
 * kernel/proptest/fixtures themselves. Reproduced here verbatim as a NEGATIVE control — that
 * function no longer exists in run-mutation-tier.mjs, which is the point of this row.
 */
function oldConventionCopy(fx, scratchRoot) {
  const kernelsSrc = join(fx.root, 'chaingraph', 'kernels');
  const proptestsSrc = join(kernelsSrc, '__proptests__');
  const kernelsDest = join(scratchRoot, 'chaingraph', 'kernels');
  const proptestsDest = join(kernelsDest, '__proptests__');
  mkdirSync(proptestsDest, { recursive: true });
  mkdirSync(join(kernelsDest, 'fixtures'), { recursive: true });
  for (const [dir, dest] of [[kernelsSrc, kernelsDest], [proptestsSrc, proptestsDest]]) {
    for (const f of readdirSync(dir)) {
      if (f.startsWith('_') && f.endsWith('.mjs')) cpSync(join(dir, f), join(dest, f));
    }
  }
  cpSync(join(fx.root, fx.kernelRelPath), join(scratchRoot, fx.kernelRelPath));
  cpSync(join(fx.root, fx.proptestRelPath), join(scratchRoot, fx.proptestRelPath));
  cpSync(join(fx.root, fx.fixturesRelPath), join(scratchRoot, fx.fixturesRelPath));
}

console.log('run-mutation-tier controls — sandbox dependency copying');

test('R1 the OLD `_`-prefix convention silently drops a non-underscore sibling (the reproduced near-miss)', () => {
  const fx = buildFixtureRepo();
  const scratchRoot = mkdtempSync(join(tmpdir(), 'rmt-scratch-old-'));
  cleanup.push(scratchRoot);
  oldConventionCopy(fx, scratchRoot);
  assert(!existsSync(join(scratchRoot, fx.helperRelPath)),
    'helper.mjs must be MISSING under the old convention — if this ever passes, the near-miss this row fixed no longer reproduces');
  assert(existsSync(join(scratchRoot, fx.proptestRelPath)),
    'the proptest itself must still have been copied — the break is in what it imports, not in itself');
});

test('R2 copySandboxDeps() (the code actually wired in today) copies the same non-underscore sibling correctly', () => {
  const fx = buildFixtureRepo();
  const scratchRoot = mkdtempSync(join(tmpdir(), 'rmt-scratch-new-'));
  cleanup.push(scratchRoot);
  const files = copySandboxDeps(fx.kernelRelPath, fx.proptestRelPath, fx.fixturesRelPath, scratchRoot, fx.root);
  assert(existsSync(join(scratchRoot, fx.helperRelPath)),
    `derivation must have found and copied helper.mjs; got files=${JSON.stringify(files)}`);
  assert(files.includes(fx.helperRelPath), `derived file list must name helper.mjs; got ${JSON.stringify(files)}`);
  assert(existsSync(join(scratchRoot, fx.kernelRelPath)) && existsSync(join(scratchRoot, fx.proptestRelPath))
    && existsSync(join(scratchRoot, fx.fixturesRelPath)), 'kernel, proptest and fixtures must all still be copied');
});

test('R3 a genuinely missing dependency fails with ONE NAMED line, never a bare ERR_MODULE_NOT_FOUND', () => {
  const fx = buildFixtureRepo();
  // Delete the helper entirely — nothing on disk can satisfy the import.
  rmSync(join(fx.root, fx.helperRelPath));
  const scratchRoot = mkdtempSync(join(tmpdir(), 'rmt-scratch-missing-'));
  cleanup.push(scratchRoot);
  let threw = null;
  try { copySandboxDeps(fx.kernelRelPath, fx.proptestRelPath, fx.fixturesRelPath, scratchRoot, fx.root); }
  catch (e) { threw = e; }
  assert(threw, 'a missing dependency must throw, not silently produce an incomplete sandbox');
  assert(!/ERR_MODULE_NOT_FOUND/.test(threw.message), `must not be a bare ERR_MODULE_NOT_FOUND:\n${threw.message}`);
  assert(/helper\.mjs/.test(threw.message) && /fixture-id\.proptest\.mjs/.test(threw.message),
    `must name BOTH the missing file and its importer:\n${threw.message}`);
});

console.log(`\nrun-mutation-tier controls: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
