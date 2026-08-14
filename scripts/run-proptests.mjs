// run-proptests.mjs — property-testing floor runner (FV-PROPFLOOR-INFRA-1).
//
// WHY: FV-PBT-FLOOR-BUILD-SPEC.md §2 — a permanent property-test floor across
// all 578 kernels only pays off if it runs unattended in CI on every kernel
// edit. This is the shared runner every rollout shard (FV-PROPFLOOR-SHARD-*)
// depends on. Singleton infra row — no kernel property files are authored here.
//
// WHAT IT DOES:
//   Globs chaingraph/kernels/__proptests__/*.proptest.mjs, runs each file as a
//   child `node <file>` process, and aggregates pass/fail. A property file
//   signals failure by exiting non-zero (uncaught throw, process.exit(1), or
//   assertion failure) — this runner does not import property-file internals,
//   it only checks the child's exit code, so a broken file cannot crash the
//   runner itself.
//
//   An EMPTY __proptests__/ directory (no .proptest.mjs files) is a NO-OP
//   PASS — this is the gate every first shard depends on (§7 row 1 "done").
//
// ZERO-DEP: pure Node built-ins only (node:fs, node:path, node:child_process,
// node:url). No fast-check, no new package.json dependency — §2's zero-dep
// boundary, inherited from the B1 pilot's hand-rolled harness pattern.
//
// USAGE:
//   node scripts/run-proptests.mjs             → run all *.proptest.mjs, exit 1 on any failure
//   node scripts/run-proptests.mjs --check      → same (alias, matches other repo gates' --check convention)
//   node scripts/run-proptests.mjs --out FILE   → also write a JSON results manifest to FILE
//   node scripts/run-proptests.mjs --base <ref> [--head <sha>]
//     FV-PREPUSH-FLOOR-SCOPE-1: scope the run to only the kernels this diff touches.
//     --base <ref> alone (local/pre-push): union of working-tree + staged + committed-vs-
//       merge-base(<ref>) diffs, same pattern preflight.mjs's touchedFloorFiles() uses.
//     --base <sha> --head <sha> (CI, no working tree): diffs base..head only.
//     SOUNDNESS, checked not assumed: every *.proptest.mjs imports ONLY its own sibling
//     ../<id>.kernel.mjs (grepped across all 588 floor files, zero exceptions, zero shared
//     imports) — no cross-file registry, no global count, no ratchet lives inside THIS gate,
//     so per-kernel scoping is exact here. The whole-corpus invariant some floor gates DO
//     carry lives in the separate check-fv-floor-coverage.mjs ratchet, which this row does
//     not touch and which still runs full-estate every time. The one real cross-cutting
//     hazard is chaingraph/kernels/_*.mjs shared helpers (595 kernels import _hash.mjs) — a
//     change there can move every kernel's output, so scoping FALLS BACK to a full run
//     whenever a shared helper, or an undeterminable diff, is in play. Never silently narrows.
//
// MANIFEST SHAPE (FV-COVERAGE-GATE-1 hook point — chosen here, NOT built here,
// per FV-PBT-FLOOR-BUILD-SPEC.md §6 row 1 "Gates" column):
//   { kernelId: { ok: bool, file: relPath } }
//   kernelId is derived from the filename convention <kernel-id>.proptest.mjs
//   (mirrors chaingraph/kernels/fixtures/<kernel-id>.fixtures.json). A future
//   coverage gate can read each shard's manifest, cross-reference kernelId
//   against chaingraph.json's kernel_digest / spec_digest, and flag any
//   kernel-id present in chaingraph.json but absent from this manifest (no
//   floor coverage) or present with ok:false (floor failing). This runner
//   does not itself read or compare digests — that stays FV-COVERAGE-GATE-1's
//   job, unbuilt here.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync, execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PROPTESTS_DIR = resolve(REPO, 'chaingraph', 'kernels', '__proptests__');
const KERNELS_DIR = resolve(REPO, 'chaingraph', 'kernels');
const FIXTURES_DIR = resolve(KERNELS_DIR, 'fixtures');

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT_FILE = outIdx !== -1 ? argv[outIdx + 1] : null;
const baseIdx = argv.indexOf('--base');
const BASE_REF = baseIdx !== -1 ? argv[baseIdx + 1] : null;
const headIdx = argv.indexOf('--head');
const DISCOVERY_LEG = argv.includes('--discovery-leg');
const discoveryOutIdx = argv.indexOf('--discovery-out');
const DISCOVERY_OUT = discoveryOutIdx !== -1 ? argv[discoveryOutIdx + 1] : null;
const HEAD_REF = headIdx !== -1 ? argv[headIdx + 1] : null;

function findPropertyFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.proptest.mjs'))
    .sort()
    .map((f) => join(dir, f));
}

function kernelIdOf(filePath) {
  return basename(filePath).replace(/\.proptest\.mjs$/, '');
}

// --- --base/--head scoping (FV-PREPUSH-FLOOR-SCOPE-1) -----------------------

function gitDiffNames(args) {
  try {
    return execSync(`git diff --name-only --diff-filter=ACM ${args}`, {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\n').filter(Boolean);
  } catch {
    return null; // undeterminable
  }
}

// Returns an array of touched repo-relative paths, or null if undeterminable.
function computeTouchedFiles(base, head) {
  if (head) {
    // CI mode: explicit shas, no working tree to union with.
    return gitDiffNames(`${base} ${head}`);
  }
  // Local/pre-push mode: union of working tree + staged + committed-vs-merge-base(base),
  // same three-way union preflight.mjs's touchedFloorFiles()/helmPathsTouched() use.
  const touched = new Set();
  const wt = gitDiffNames('HEAD');
  if (wt === null) return null;
  wt.forEach((f) => touched.add(f));
  const staged = gitDiffNames('--cached');
  if (staged === null) return null;
  staged.forEach((f) => touched.add(f));
  let mergeBase;
  try {
    mergeBase = execSync(`git merge-base ${base} HEAD`, {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
  const committed = gitDiffNames(`${mergeBase} HEAD`);
  if (committed === null) return null;
  committed.forEach((f) => touched.add(f));
  return [...touched];
}

const SHARED_HELPER_RE = /^chaingraph\/kernels\/_[^/]+\.mjs$/;
const PROPTEST_PATH_RE = /^chaingraph\/kernels\/__proptests__\/([^/]+)\.proptest\.mjs$/;
const KERNEL_PATH_RE = /^chaingraph\/kernels\/([^/]+)\.kernel\.mjs$/;

// Returns { files } to run scoped, or { fallback: <reason> } to run everything.
function selectScopedFiles(touchedFiles) {
  if (touchedFiles.some((f) => SHARED_HELPER_RE.test(f))) {
    return { fallback: 'a shared kernel helper (chaingraph/kernels/_*.mjs) was touched — it can move every kernel\'s output, so scoping would be unsound' };
  }
  const ids = new Set();
  for (const f of touchedFiles) {
    const pt = f.match(PROPTEST_PATH_RE);
    if (pt) ids.add(pt[1]);
    const k = f.match(KERNEL_PATH_RE);
    if (k) ids.add(k[1]);
  }
  const files = [...ids]
    .map((id) => join(PROPTESTS_DIR, `${id}.proptest.mjs`))
    .filter(existsSync)
    .sort();
  return { files };
}

function runOne(filePath) {
  const result = spawnSync(process.execPath, [filePath], {
    cwd: REPO,
    encoding: 'utf8',
  });
  return {
    file: filePath,
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    spawnError: result.error ? String(result.error) : null,
  };
}

// FV-PBT-NASTIER-GEN-1 -- NON-BLOCKING discovery leg. Opt-in only (--discovery-leg),
// never runs as part of the default (CI-gating) path above. Probes every floored
// kernel's declared policy_parameters keys (derived from its own committed fixtures,
// never invented) with the nastier generators in _pbt-common.mjs and reports what
// happens -- it NEVER asserts pass/fail and ALWAYS exits 0, per the row's
// "findings, not fixes" done-criterion: each finding routes to its own board row,
// never a same-session fix, and never a same-session generator weakening.
async function runDiscoveryLegMode() {
  const pbtCommonPath = join(PROPTESTS_DIR, '_pbt-common.mjs');
  const { rotatingSeed } = await import(pathToFileURL(pbtCommonPath).href);
  const WORKER_PATH = join(HERE, 'pbt-discovery-leg-worker.mjs');
  const WORKER_TIMEOUT_MS = 5000;

  const files = findPropertyFiles(PROPTESTS_DIR);
  const seed = rotatingSeed();
  const allFindings = [];
  let probed = 0;
  let skippedNoBaseline = 0;
  let loadErrors = 0;
  let hangsOrCrashes = 0;

  for (const file of files) {
    const kernelId = kernelIdOf(file);
    const kernelPath = join(KERNELS_DIR, `${kernelId}.kernel.mjs`);
    const fixturesPath = join(FIXTURES_DIR, `${kernelId}.fixtures.json`);
    if (!existsSync(kernelPath) || !existsSync(fixturesPath)) { skippedNoBaseline++; continue; }

    let fixtures;
    try {
      fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
    } catch (err) {
      loadErrors++;
      allFindings.push({ kernelId, key: null, nastyDesc: null, outcome: { kind: 'load_error', message: `unreadable fixtures: ${String(err && err.message || err)}` } });
      continue;
    }
    const hasBaseline = (fixtures.vectors || []).some((v) => Object.keys(v.policy_parameters || {}).length > 0);
    if (!hasBaseline) { skippedNoBaseline++; continue; }

    // Isolated per-kernel child process, same shape as the committed-seed floor
    // runner above (runOne) -- a nasty value can hang or OOM a kernel, not just
    // throw cleanly, and that reaction is itself a finding, never a reason to take
    // the whole discovery run down.
    const result = spawnSync(process.execPath, [WORKER_PATH, kernelId, kernelPath, fixturesPath, String(seed)], {
      cwd: REPO,
      encoding: 'utf8',
      timeout: WORKER_TIMEOUT_MS,
    });

    if (result.error || result.status !== 0 || result.signal) {
      hangsOrCrashes++;
      const reason = result.signal ? `killed by ${result.signal} (timeout ${WORKER_TIMEOUT_MS}ms)` : (result.error ? String(result.error) : `exit ${result.status}`);
      allFindings.push({ kernelId, key: null, nastyDesc: null, outcome: { kind: 'hang_or_crash', message: reason } });
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse((result.stdout || '').trim().split('\n').pop());
    } catch (err) {
      loadErrors++;
      allFindings.push({ kernelId, key: null, nastyDesc: null, outcome: { kind: 'load_error', message: `unparseable worker output: ${String(err && err.message || err)}` } });
      continue;
    }
    if (parsed.workerError) {
      loadErrors++;
      allFindings.push({ kernelId, key: null, nastyDesc: null, outcome: { kind: 'load_error', message: parsed.workerError } });
      continue;
    }
    probed++;
    allFindings.push(...parsed.findings);
  }

  console.log(`run-proptests --discovery-leg: rotating seed ${seed} (day bucket).`);
  console.log(`run-proptests --discovery-leg: ${probed}/${files.length} kernel(s) probed, ${skippedNoBaseline} skipped (no derivable declared-key baseline in committed fixtures), ${loadErrors} load error(s), ${hangsOrCrashes} hang/crash under a nasty value (timeout ${WORKER_TIMEOUT_MS}ms).`);
  console.log(`run-proptests --discovery-leg: ${allFindings.length} finding(s).`);
  for (const f of allFindings) {
    const msg = f.outcome.message ? `: ${f.outcome.message}` : (f.outcome.violations ? `: ${JSON.stringify(f.outcome.violations)}` : '');
    console.log(`  [FINDING] ${f.kernelId} key=${f.key ?? '(n/a)'} nasty=${f.nastyDesc ?? '(n/a)'} -> ${f.outcome.kind}${msg}`);
  }
  if (DISCOVERY_OUT) {
    writeFileSync(DISCOVERY_OUT, JSON.stringify({ seed, probed, skippedNoBaseline, loadErrors, findings: allFindings }, null, 2) + '\n');
    console.log(`run-proptests --discovery-leg: wrote findings to ${DISCOVERY_OUT}`);
  }
  console.log('run-proptests --discovery-leg: NON-BLOCKING leg -- exiting 0 regardless of findings. Route each finding to its own row; never fix here, never weaken a generator to make one disappear.');
  process.exit(0);
}

async function main() {
  if (DISCOVERY_LEG) {
    await runDiscoveryLegMode();
    return;
  }

  const allFiles = findPropertyFiles(PROPTESTS_DIR);
  let files = allFiles;

  if (BASE_REF) {
    const touched = computeTouchedFiles(BASE_REF, HEAD_REF);
    if (touched === null) {
      console.log('run-proptests: --base diff undeterminable — falling back to a full run.');
    } else {
      const scoped = selectScopedFiles(touched);
      if (scoped.fallback) {
        console.log(`run-proptests: ${scoped.fallback} — falling back to a full run.`);
      } else if (scoped.files.length === 0) {
        console.log(`run-proptests: --base scoping active, 0 floor file(s) touched by this diff — no-op PASS.`);
        process.exit(0);
      } else {
        files = scoped.files;
        console.log(`run-proptests: --base scoping active — running ${files.length}/${allFiles.length} floor file(s) touched by this diff.`);
      }
    }
  }

  if (files.length === 0) {
    console.log('run-proptests: 0 property files found — no-op PASS.');
    console.log(`  (searched: ${PROPTESTS_DIR})`);
    process.exit(0);
  }

  console.log(`run-proptests: running ${files.length} property file(s)...`);

  const results = files.map(runOne);
  const failed = results.filter((r) => !r.ok);

  for (const r of results) {
    const label = r.ok ? 'PASS' : 'FAIL';
    console.log(`  [${label}] ${r.file}`);
    if (!r.ok) {
      if (r.spawnError) console.log(`    spawn error: ${r.spawnError}`);
      if (r.stdout.trim()) console.log(`    stdout:\n${indent(r.stdout)}`);
      if (r.stderr.trim()) console.log(`    stderr:\n${indent(r.stderr)}`);
      console.log(`    exit code: ${r.status}`);
    }
  }

  if (OUT_FILE) {
    const manifest = {};
    for (const r of results) {
      manifest[kernelIdOf(r.file)] = { ok: r.ok, file: relative(REPO, r.file) };
    }
    writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`run-proptests: wrote results manifest to ${OUT_FILE}`);
  }

  console.log('');
  if (failed.length > 0) {
    console.log(`run-proptests: ${failed.length}/${results.length} FAILED.`);
    process.exit(1);
  }

  console.log(`run-proptests: ${results.length}/${results.length} passed.`);
  process.exit(0);
}

function indent(s) {
  return s
    .trimEnd()
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n');
}

main().catch((err) => {
  console.error('run-proptests: uncaught error:', err);
  process.exit(1);
});
