/**
 * KERNEL-PREFLIGHT-RATCHETS-1 controls: kernel-preflight's READY bar includes the three
 * estate ratchets (flag-mirror, R4 null-class, flags-computed), judged only on findings
 * that name the kernel under test.
 *
 *   GREEN: an existing, baselined-clean kernel passes all three steps.
 *   RED:   a scratch kernel with an unconditional compliance_flags push (a NEW
 *          flags-computed violation, id absent from every baseline) fails that step.
 *
 * MUTATION-BOUND-FROM-PREFLIGHT-1 controls: the advisory mutation wall bound (check 7c).
 * Driven through the step's documented pre-measured-sample override
 * (KERNEL_PREFLIGHT_MUTATION_SAMPLE_JSON) so the selftest never spawns a real Stryker
 * run; the numbers are the ones the art-783 cure measured (1787 mutants, 1377.7 s full
 * wall). 733-servicing-compliance-clock is the base kernel: it passes every step green
 * (including the jsdoc gate AS A TOUCHED ROOT — it is not among the ~610 kernels sharing
 * the buildArtifact destructure shape tsc flags the moment they become touched, which
 * art-617 is) and carries NO sibling <id>.mutation.json bound, so one appended comment
 * line makes it a TOUCHED kernel with no sibling bound — the exact state the step fires
 * in, with every OTHER step still green so the exit-code assertions stay meaningful.
 *
 *   783:   the printed would-set bound is within 15% of 2.3 x 1377.7 s, the sibling
 *          content is printed, and the run still exits 0 (the step never changes the
 *          exit code — asserted WITH the advisory visibly firing, not vacuously).
 *   small: a small sample stays under the 600 s default and prints no would-set bound.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnv } from './_git-env-lib.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREFLIGHT = resolve(REPO, 'scripts', 'kernel-preflight.mjs');
const RATCHET_LABELS = ['Flag-mirror', 'R4 null-class', 'Flags-computed'];
const BOUND_LABEL = 'Mutation wall bound (advisory, MUTATION-BOUND-FROM-PREFLIGHT-1)';
const GREEN_ID = '733-servicing-compliance-clock';

function preflight(id) {
  const r = spawnSync(process.execPath, [PREFLIGHT, id, '--fast', '--keep-going'], { cwd: REPO, encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
}

test('GREEN: a clean kernel passes all three ratchet steps', () => {
  const out = preflight('art-617-m3p-monthly-cap-calculator');
  for (const label of RATCHET_LABELS) {
    assert.match(out, new RegExp(`✓ PASS\\s+\\d+ms\\s+${label}`), `${label} should PASS:\n${out}`);
  }
});

test('RED: a new unconditional flag emission fails the flags-computed step', () => {
  const id = 'art-9999-ratchet-probe';
  const file = resolve(REPO, 'chaingraph', 'kernels', `${id}.kernel.mjs`);
  writeFileSync(file, [
    `export const meta = { tool_id: '${id}' };`,
    'export function compute(pp) {',
    '  const compliance_flags = [];',
    "  compliance_flags.push('PROBE_COMPUTED');",
    '  return { output_payload: { ok: true }, compliance_flags };',
    '}',
    '',
  ].join('\n'));
  // The ratchet scripts enumerate git-tracked kernels, so register the scratch file as
  // intent-to-add for the run and unregister it in `finally`.
  const rel = `chaingraph/kernels/${id}.kernel.mjs`;
  try {
    spawnSync('git', ['add', '-N', '--', rel], { cwd: REPO, env: gitEnv() });
    const out = preflight(id);
    assert.match(out, /✗ FAIL\s+\d+ms\s+Flags-computed/, out);
    assert.match(out, new RegExp(`${id} is named by node scripts/check-flags-computed\\.mjs`), out);
  } finally {
    spawnSync('git', ['rm', '--cached', '-q', '-f', '--', rel], { cwd: REPO, env: gitEnv() });
    rmSync(file, { force: true });
  }
});

// ── mutation wall bound (advisory, MUTATION-BOUND-FROM-PREFLIGHT-1) ───────

// Runs the full preflight (NO --fast: --fast skips the advisory step outright)
// with a pre-measured sample injected through the step's documented override.
function preflightWithInjectedSample(id, sample) {
  const r = spawnSync(process.execPath, [PREFLIGHT, id, '--keep-going'], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, KERNEL_PREFLIGHT_MUTATION_SAMPLE_JSON: JSON.stringify(sample) },
  });
  return { out: (r.stdout || '') + (r.stderr || ''), code: r.status };
}

// One appended comment line makes 733 a TOUCHED kernel (it differs from
// origin/main) with NO sibling bound — the exact state the advisory fires in.
// The bytes are restored even on assertion failure.
function withTouchedKernel(fn) {
  const file = resolve(REPO, 'chaingraph', 'kernels', `${GREEN_ID}.kernel.mjs`);
  const original = readFileSync(file, 'utf8');
  writeFileSync(file, `${original}\n// mutation-bound advisory probe touch (selftest; restored below)\n`);
  try { return fn(); } finally { writeFileSync(file, original); }
}

// "The step never changes the exit code" cannot be asserted as exit 0 on a
// TOUCHED live kernel: the touch itself breaks the floor-digest stamp (the
// kernel's authoring digest no longer matches), which is this test's own
// known, controlled consequence and the run's ONLY failure. So the property
// is asserted differentially: the SAME touched state with the advisory
// FIRING (test 1) and SILENT (test 2) must produce the identical exit code
// and the identical single-failure profile — the advisory's own row is N-A
// in both. The green side is covered by the untouched GREEN test above,
// which passes exit 0 with the step wired in (N-A, untouched kernel).
const touchFailureProfile = (out) => {
  const fails = out.split('\n').filter((l) => l.startsWith('✗'));
  assert.equal(fails.length, 1, `the touch must cause exactly its own floor-digest failure, got:\n${fails.join('\n')}`);
  assert.match(fails[0], /Floor digest stamp/, `the one failure must be the floor digest stamp the touch itself broke:\n${fails[0]}`);
};

test('BOUND 783: the measured sample prints a would-set bound within 15% of 2.3 x 1377.7 s, with the sibling content, advisory N-A while the run keeps its own exit code', () => {
  withTouchedKernel(() => {
    const { out, code } = preflightWithInjectedSample(GREEN_ID, { mutantCount: 1787, secondsPerMutant: 1377.7 / 1787 });
    assert.match(out, new RegExp(`N-A\\s+\\d+ms\\s+${BOUND_LABEL.replace(/[(),]/g, '\\$&')}`), `the advisory step must appear as N-A (never FAIL):\n${out.slice(-4000)}`);
    const m = out.match(/would-set bound (\d+) s/);
    assert.ok(m, `no "would-set bound N s" line in the output:\n${out.slice(-4000)}`);
    const n = Number(m[1]);
    const target = 2.3 * 1377.7; // 3168.71 s — the art-783 cure's own bound basis
    assert.ok(Math.abs(n - target) / target <= 0.15, `bound ${n} s must be within 15% of ${target.toFixed(1)} s`);
    assert.match(out, new RegExp(`\\{"kernelTimeoutSeconds":${n}\\}`), 'the would-be sibling content must be printed');
    assert.equal(code, 1, `the run's exit must be the touch's own floor-digest 1, got ${code}`);
    touchFailureProfile(out);
  });
});

test('BOUND small: a sample under the 600 s default prints no would-set bound, and the failure profile is identical to the firing run (the step never changes the exit code)', () => {
  withTouchedKernel(() => {
    // 40 mutants x 0.8 s/mutant x 2.3 = 73.6 s — far under the 600 s default.
    const { out, code } = preflightWithInjectedSample(GREEN_ID, { mutantCount: 40, secondsPerMutant: 0.8 });
    assert.doesNotMatch(out, /would-set bound/, `a small kernel must print no would-set bound:\n${out.slice(-4000)}`);
    assert.equal(code, 1, 'the advisory-silent run must exit with the SAME code the firing run exits with');
    touchFailureProfile(out);
  });
});

// ── §30.4 branch-aware scope of check 11 (SO #38 / DIAG-SO38-SCOPE-1) ─────
//
// SPEC.md §30.4: "A pre-existing node with no standards_basis declaration is
// reported as a gap ... and is never itself a CI failure" — §30 gates a node
// only when it is NEW or CHANGED relative to origin/main. Check 11's old
// unconditional shape hard-failed 68 pre-existing kernels on a clean main
// checkout (diag census 2026-11-25, 779 kernels scanned); the §15 SSOT gate
// (check-clause-digest.mjs) already scoped the same rule to touched nodes and
// reported the pre-existing class green. Three controls, one per behaviour:
//
//   (a) a node BYTE-IDENTICAL to origin/main that declares regulatory_basis
//       (the FAST-PROVE-BATCH-1 discriminator) but carries no standards_basis
//       is reported N-A — the visible §30.4 gap — and the run stays READY.
//   (b) the SAME gap on a CHANGED node still FAILs — nothing about touched
//       bytes is weakened (no-waiver ruling).
//   (c) a changed node that DECLARES standards_basis passes as before — the
//       scoping wrapper rewrites only FAILs on untouched nodes, never PASS.
//
// Subjects are SELECTED, not hardcoded: (a)/(b) pick the first sorted
// census-class kernel (regulatory_basis in source, shard present with no
// standards_basis, kernel+shard byte-identical to origin/main — the exact
// class research/_diag-census-so38.mjs counted at 68-of-779), so the test
// survives any single node of the class being backfilled by its owning row
// (RIDER-KERNEL/CLAUSE-DIGEST-LAND-0816-1). (c) picks the first sorted shard
// that declares implements_standard/cites_informative with >=1 digest. When
// the census class is fully cured on the tree, (a) skips honestly (its
// subject no longer exists) and (b) falls back to a scratch NEW kernel —
// differsFromOriginMain treats absent-from-main as touched, the same
// primitive — so "touched bytes gate" stays proven either way.

const CHECK11 = 'cited_clause_digest present-or-N/A (SO #38/§30)';
const check11Line = (out) =>
  out.split('\n').find((l) => l.trimEnd().endsWith(CHECK11) && /^[✓✗·]/.test(l));
const originText = (relPath) => {
  const r = spawnSync('git', ['show', `origin/main:${relPath}`], { cwd: REPO, encoding: 'utf8', env: gitEnv() });
  return r.status === 0 ? r.stdout : null;
};
const matchesCensusClass = (id) => {
  const kernelPath = resolve(REPO, 'chaingraph', 'kernels', `${id}.kernel.mjs`);
  const kernelSrc = readFileSync(kernelPath, 'utf8');
  if (!/\bregulatory_basis\s*:/.test(kernelSrc)) return false;
  const shardRel = `chaingraph/graph/nodes/${id}.json`;
  let shardText;
  try { shardText = readFileSync(resolve(REPO, shardRel), 'utf8'); } catch { return false; }
  let shard;
  try { shard = JSON.parse(shardText); } catch { return false; }
  if (shard.standards_basis !== undefined) return false;
  // byte-identical on BOTH files — the §30.4 pre-existing state itself (raw
  // bytes compared, never a re-stringified parse: stringify is not identity).
  return originText(`chaingraph/kernels/${id}.kernel.mjs`) === kernelSrc
    && originText(shardRel) === shardText;
};
function pickCensusId() {
  const kdir = resolve(REPO, 'chaingraph', 'kernels');
  return readdirSync(kdir)
    .filter((f) => f.endsWith('.kernel.mjs'))
    .map((f) => f.replace(/\.kernel\.mjs$/, ''))
    .sort()
    .find(matchesCensusClass) ?? null;
}
function pickDeclaredId() {
  const ndir = resolve(REPO, 'chaingraph', 'graph', 'nodes');
  const declared = readdirSync(ndir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()
    .filter((id) => {
      const shard = JSON.parse(readFileSync(resolve(ndir, `${id}.json`), 'utf8'));
      const basis = shard.standards_basis;
      return (basis === 'implements_standard' || basis === 'cites_informative')
        && Array.isArray(shard.cited_clause_digest) && shard.cited_clause_digest.length > 0
        && originText(`chaingraph/kernels/${id}.kernel.mjs`)
          === readFileSync(resolve(REPO, 'chaingraph', 'kernels', `${id}.kernel.mjs`), 'utf8');
    });
  return declared[0] ?? null;
}
// Full run (exit code included) — `preflight()` above drops the code, and the
// (a) control must prove READY, not just its own row.
function preflightRun(id) {
  const r = spawnSync(process.execPath, [PREFLIGHT, id, '--fast', '--keep-going'], { cwd: REPO, encoding: 'utf8' });
  return { out: (r.stdout || '') + (r.stderr || ''), code: r.status };
}
// Append one probe comment to a tracked kernel's bytes (its working-tree copy
// differs from origin/main = CHANGED under differsFromOriginMain), run a step,
// always restore. Same shape the BOUND tests use on 733.
function withTouchedKernelBytes(id, fn) {
  const file = resolve(REPO, 'chaingraph', 'kernels', `${id}.kernel.mjs`);
  const original = readFileSync(file, 'utf8');
  writeFileSync(file, `${original}\n// so38-scope probe touch (selftest; restored in finally)\n`);
  try { return fn(); } finally { writeFileSync(file, original); }
}

test('SCOPE §30.4 (a): a main-identical regulatory_basis node without standards_basis reports the gap N-A, never FAIL, and the run stays READY', (t) => {
  const id = pickCensusId();
  if (!id) t.skip('census class fully backfilled on this tree — no pre-existing node left to scope');
  const { out, code } = preflightRun(id);
  const line = check11Line(out);
  assert.ok(line, `check 11 must appear in the report:\n${out.slice(-4000)}`);
  assert.match(line, /^·\s+N-A\s+\d+ms\s{2}cited_clause_digest present-or-N\/A \(SO #38\/§30\)$/,
    `a pre-existing gap must be reported N-A, got: ${line}`);
  assert.match(out, /SCOPE \(SPEC\.md §30\.4/, 'the N-A row must cite the §30.4 scoping decision');
  assert.match(out, new RegExp(`${id} is byte-identical to origin/main`), 'the N-A row must name the subject and its main-identical state');
  assert.doesNotMatch(out, /✗\s+FAIL\s+\d+ms\s{2}cited_clause_digest present-or-N\/A/, 'check 11 must never report FAIL for this node');
  assert.equal(code, 0, `the run must stay READY on a clean main-identical node, got exit ${code}:\n${out.slice(-4000)}`);
});

test('SCOPE §30.4 (b): the same gap on a CHANGED node still FAILs', (t) => {
  const id = pickCensusId();
  if (id) {
    const { out } = withTouchedKernelBytes(id, () => preflightRun(id));
    const line = check11Line(out);
    assert.ok(line, `check 11 must appear in the report:\n${out.slice(-4000)}`);
    assert.match(line, /^✗\s+FAIL\s+\d+ms\s{2}cited_clause_digest present-or-N\/A \(SO #38\/§30\)$/,
      `a touched node with the gap must FAIL check 11, got: ${line}`);
    assert.match(out, /carries no standards_basis field at all/, 'the failure must name the missing §30.3 declaration');
  } else {
    // Census class cured: prove the touched-bytes rule with a NEW kernel instead —
    // differsFromOriginMain classes absent-from-main as touched, the same primitive.
    const probeId = 'art-9998-so38-scope-probe';
    const file = resolve(REPO, 'chaingraph', 'kernels', `${probeId}.kernel.mjs`);
    writeFileSync(file, [
      `export const meta = { tool_id: '${probeId}' };`,
      'export function compute(pp) {',
      '  return { output_payload: { ok: true, regulatory_basis: ["selftest fixture"] } };',
      '}',
      '',
    ].join('\n'));
    const rel = `chaingraph/kernels/${probeId}.kernel.mjs`;
    try {
      spawnSync('git', ['add', '-N', '--', rel], { cwd: REPO, env: gitEnv() });
      const { out } = preflightRun(probeId);
      const line = check11Line(out);
      assert.ok(line, `check 11 must appear in the report:\n${out.slice(-4000)}`);
      assert.match(line, /^✗\s+FAIL\s+\d+ms\s{2}cited_clause_digest present-or-N\/A \(SO #38\/§30\)$/,
        `a touched node with the gap must FAIL check 11, got: ${line}`);
    } finally {
      spawnSync('git', ['rm', '--cached', '-q', '-f', '--', rel], { cwd: REPO, env: gitEnv() });
      rmSync(file, { force: true });
    }
  }
});

test('SCOPE §30.4 (c): a changed node that declares standards_basis passes as before', (t) => {
  const id = pickDeclaredId();
  if (!id) t.skip('no standards_basis-declaring node on this tree');
  const { out } = withTouchedKernelBytes(id, () => preflightRun(id));
  const line = check11Line(out);
  assert.ok(line, `check 11 must appear in the report:\n${out.slice(-4000)}`);
  assert.match(line, /^✓\s+PASS\s+\d+ms\s{2}cited_clause_digest present-or-N\/A \(SO #38\/§30\)$/,
    `a declared node must PASS check 11 even when changed, got: ${line}`);
  assert.doesNotMatch(out, /SCOPE \(SPEC\.md §30\.4/, 'the scoping wrapper must never annotate a PASS row');
});
