#!/usr/bin/env node
/**
 * new-kernel.test.mjs — red/green self-test for NEW-NODE-SCAFFOLD-FULL-1.
 *
 * Scaffolds a sample node (with page) into a throwaway copy of the scaffolder and proves the
 * emitted files already satisfy the recurring new-node gates it can be checked against in
 * isolation: flag-mirror (the real gate, run against the temp estate), the page-kernel digest
 * stamp, the page's role="main" landmark, the shard / reservation shapes, and the main-only
 * rule. The load-bearing case is the mutation: delete the `warnings` mirror member from the
 * scaffold and the real flag-mirror gate must go red.
 *
 * Usage: node scripts/new-kernel.test.mjs   (exit 0 = all cases pass)
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, cpSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const { run: runFlagMirror } = await import(pathToFileURL(resolve(HERE, 'check-flag-mirror.mjs')).href);

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  if (!ok) failures++;
};
const quiet = async (fn) => {
  const log = console.log, err = console.error;
  console.log = () => {}; console.error = () => {};
  try { return await fn(); } finally { console.log = log; console.error = err; }
};

// ── throwaway estate: the scaffolder + templates + the two helpers it imports ──
const root = mkdtempSync(join(tmpdir(), 'newkernel-'));
mkdirSync(join(root, 'scripts'), { recursive: true });
mkdirSync(join(root, 'chaingraph', 'kernels'), { recursive: true });
mkdirSync(join(root, 'chaingraph', 'graph', 'nodes'), { recursive: true });
copyFileSync(resolve(HERE, 'new-kernel.mjs'), join(root, 'scripts', 'new-kernel.mjs'));
cpSync(resolve(HERE, 'kernel-templates'), join(root, 'scripts', 'kernel-templates'), { recursive: true });
for (const f of ['_hash.mjs', '_buildid.mjs']) copyFileSync(resolve(REPO, 'chaingraph', 'kernels', f), join(root, 'chaingraph', 'kernels', f));
writeFileSync(join(root, 'chaingraph', 'hub-categories.json'), JSON.stringify({ 'Sample Category': { order: 1 } }));
writeFileSync(join(root, 'chaingraph', 'graph', 'nodes', 'art-1-seed.json'), JSON.stringify({ wave: 7 }));
writeFileSync(join(root, 'scripts', 'flag-mirror-baseline.json'), JSON.stringify({ entries: [] }));

console.log('new-kernel.test.mjs — scaffold completeness by mutation\n');

const ID = 'art-9001-scaffold-sample';
const proc = spawnSync(process.execPath, [
  join(root, 'scripts', 'new-kernel.mjs'), 'art-9001', 'scaffold-sample',
  '--with-page', '--category', 'Sample Category', '--row', 'SAMPLE-ROW',
], { encoding: 'utf8' });
check('scaffold exits 0', proc.status, 0);

const p = (...a) => join(root, ...a);
const kernelPath = p('chaingraph', 'kernels', `${ID}.kernel.mjs`);
const kernelSrc = readFileSync(kernelPath, 'utf8');

// 1. emitted file set
check('kernel emitted', existsSync(kernelPath), true);
check('shard emitted', existsSync(p('chaingraph', 'graph', 'nodes', `${ID}.json`)), true);
check('page emitted', existsSync(p('chaingraph', `${ID}.html`)), true);
check('kernels/index.mjs NOT written (main-only)', existsSync(p('chaingraph', 'kernels', 'index.mjs')), false);
check('chaingraph.json NOT written', existsSync(p('chaingraph.json')), false);

// 2. reservation file, one per id
const reservation = JSON.parse(readFileSync(p('chaingraph', 'graph', 'reservations', 'art-9001.json'), 'utf8'));
check('reservation row', reservation.row, 'SAMPLE-ROW');
check('reservation shape', Object.keys(reservation).sort(), ['pr', 'reserved', 'row']);
check('legacy RESERVATIONS.json NOT written', existsSync(p('chaingraph', 'graph', 'RESERVATIONS.json')), false);

// 3. page: kernel-digest sentinel equals sourceDigest(kernel bytes); role=main landmark
const { sourceDigest } = await import(pathToFileURL(p('chaingraph', 'kernels', '_buildid.mjs')).href);
const page = readFileSync(p('chaingraph', `${ID}.html`), 'utf8');
const stamp = page.match(/<meta name="kernel-digest" content="([^"]+)">/);
check('page carries exactly one kernel-digest meta', (page.match(/name="kernel-digest"/g) || []).length, 1);
check('page digest == sourceDigest(kernel)', stamp && stamp[1], await sourceDigest(kernelSrc));
check('page has role="main" + aria-description container', /<div[^>]*role="main"[^>]*aria-description="[^"]+"/.test(page), true);

// 4. kernel behaviour: null == absent (R4), conditional flag, mirror tracks the flags
const k = await import(pathToFileURL(kernelPath).href);
const absent = k.compute({});
check('R4: null input == absent input', JSON.stringify(k.compute({ subject: null })), JSON.stringify(absent));
check('conditional flag raised when subject absent', absent.compliance_flags, ['SUBJECT_ABSENT']);
check('no flag when subject present', k.compute({ subject: 'x' }).compliance_flags, []);
check('mirror truthy exactly when flagged', [absent.output_payload.warnings.length > 0, k.compute({ subject: 'x' }).output_payload.warnings.length > 0], [true, false]);

// 5. the REAL flag-mirror gate: GREEN on the scaffold, RED once the mirror member is removed
check('flag-mirror gate GREEN on fresh scaffold', await quiet(() => runFlagMirror({ repo: root, argv: [] })), 0);
// A second scaffold, mutated before the gate first imports it (node caches a module by URL, so
// rewriting the already-imported kernel would not be seen).
spawnSync(process.execPath, [join(root, 'scripts', 'new-kernel.mjs'), 'art-9002', 'scaffold-mutant'], { encoding: 'utf8' });
const mutantPath = p('chaingraph', 'kernels', 'art-9002-scaffold-mutant.kernel.mjs');
const mutantSrc = readFileSync(mutantPath, 'utf8');
const mutated = mutantSrc.replace('output_payload: { subject, warnings }', 'output_payload: { subject }');
check('mutation actually changed the kernel', mutated !== mutantSrc, true);
writeFileSync(mutantPath, mutated);
check('flag-mirror gate RED after removing the warnings mirror', await quiet(() => runFlagMirror({ repo: root, argv: [] })), 1);

// 6. idempotent: a second run refuses to overwrite
const again = spawnSync(process.execPath, [
  join(root, 'scripts', 'new-kernel.mjs'), 'art-9001', 'scaffold-sample', '--with-page', '--category', 'Sample Category',
], { encoding: 'utf8' });
check('second scaffold refuses (exit 1)', again.status, 1);

rmSync(root, { recursive: true, force: true });
if (failures) { console.error(`\n✗ ${failures} case(s) failed`); process.exit(1); }
console.log('\n✓ all cases pass');
