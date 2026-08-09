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

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PROPTESTS_DIR = resolve(REPO, 'chaingraph', 'kernels', '__proptests__');

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT_FILE = outIdx !== -1 ? argv[outIdx + 1] : null;

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

function main() {
  const files = findPropertyFiles(PROPTESTS_DIR);

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

main();
