#!/usr/bin/env node
// scripts/renumber-node.mjs (RENUMBER-RESTAMP-1)
//
// Renumber an UNENROLLED chaingraph node (rename its tool_id) and restamp every digest the rename moves.
//
// WHY: #2860 renumbered art-811 -> art-813 by hand (commit f172775aa). The kernel carries its tool_id in
// TOOL_ID and comments, so the id edit moved the kernel's sha256-source identity digest, but the shard kept
// the old stamp and the page kept the old <meta name="kernel-digest">. The PR went green (the node was not
// yet registered or enrolled, so the identity gates never looked at it) and main went red after merge.
// This tool does the rename and the restamp as one step, so the two cannot be separated.
//
// USAGE
//   node scripts/renumber-node.mjs <old> <new> [--dry] [--root=<dir>]
//   node scripts/renumber-node.mjs --self-test
//   <old>/<new> are full tool_ids (811-eth-staking-accounting 813-eth-staking-accounting) or, for <new>, a bare
//   number (813) that replaces the numeric prefix of <old>. A bare <old> number is resolved from the shard name.
//   --dry   print the plan (renames, rewrites, restamps), write nothing, run nothing.
//
// WHAT A RENUMBER TOUCHES (the file set of f172775aa, plus the page stamp it forgot):
//   chaingraph/graph/nodes/<id>.json                       shard            (id strings, then identity restamp)
//   chaingraph/<id>.html                                   page             (id strings, then meta kernel-digest)
//   chaingraph/kernels/<id>.kernel.mjs                     kernel           (id strings)
//   chaingraph/kernels/__proptests__/<id>.proptest.mjs     proptest         (id strings)
//   chaingraph/kernels/fixtures/<id>.fixtures.json         fixtures         (id strings)
//   manifests/<id>.manifest.json                           manifest, if the node has one
//   chaingraph/graph/reservations/art-<N>.json             reservation      (renamed art-<old N> -> art-<new N>)
// NOT touched (derived and single-writer, regenerated on main by derived-artifacts-regen.yml): chaingraph.json,
// chaingraph.meta.json, kernels/index.mjs, okf/, register/, the .md twin, sitemap, llms-full, openapi.
// Refuses an ENROLLED node (id in chaingraph.meta.json order.nodes): renumbering a live node is a successor
// node, not a rename.
//
// RESTAMP (always last): node chaingraph/kernels/gen-kernel-identity.mjs --write --shard=<new>, then --check
// --shard=<new>; the page's <meta name="kernel-digest"> is rewritten from the same sourceDigest().
// Hash code is never reimplemented here; the digest comes from chaingraph/kernels/_buildid.mjs.

import { existsSync, readFileSync, writeFileSync, renameSync, readdirSync, mkdirSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const numOf = (id) => { const m = /^(art-)?(\d+)-/.exec(id); return m ? m[0].replace(/-$/, '') : null; };   // "813" or "art-18"
const slugOf = (id) => id.slice((numOf(id) ?? '').length + 1);

function resolveIds(root, oldArg, newArg) {
  const nodesDir = resolve(root, 'chaingraph/graph/nodes');
  let oldId = oldArg;
  if (/^\d+$/.test(oldArg)) {
    const hits = readdirSync(nodesDir).filter((f) => f.startsWith(oldArg + '-') && f.endsWith('.json'));
    if (hits.length !== 1) throw new Error(`cannot resolve bare number ${oldArg}: ${hits.length} shard(s) match`);
    oldId = hits[0].slice(0, -5);
  }
  const newId = /^\d+$/.test(newArg) ? `${newArg}-${slugOf(oldId)}` : newArg;
  if (oldId === newId) throw new Error('old and new ids are identical');
  return { oldId, newId };
}

function planFor(root, oldId, newId) {
  const oldN = numOf(oldId), newN = numOf(newId);
  const rel = (id) => ({
    shard: `chaingraph/graph/nodes/${id}.json`,
    page: `chaingraph/${id}.html`,
    kernel: `chaingraph/kernels/${id}.kernel.mjs`,
    proptest: `chaingraph/kernels/__proptests__/${id}.proptest.mjs`,
    fixtures: `chaingraph/kernels/fixtures/${id}.fixtures.json`,
    manifest: `manifests/${id}.manifest.json`,
  });
  const a = rel(oldId), b = rel(newId);
  const moves = [];
  for (const k of Object.keys(a)) if (existsSync(resolve(root, a[k]))) moves.push({ kind: k, from: a[k], to: b[k], rewrite: true });
  if (oldN && newN) {
    const ra = `chaingraph/graph/reservations/${oldN.startsWith('art-') ? oldN : 'art-' + oldN}.json`;
    const rb = `chaingraph/graph/reservations/${newN.startsWith('art-') ? newN : 'art-' + newN}.json`;
    if (existsSync(resolve(root, ra))) moves.push({ kind: 'reservation', from: ra, to: rb, rewrite: false });
  }
  return moves;
}

function gitMv(root, from, to) {
  mkdirSync(dirname(resolve(root, to)), { recursive: true });
  if (existsSync(resolve(root, '.git'))) {
    const r = spawnSync('git', ['mv', from, to], { cwd: root, encoding: 'utf8' });
    if (r.status === 0) return;
  }
  renameSync(resolve(root, from), resolve(root, to));
}

function run(root, args, env = {}) {
  return spawnSync('node', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
}

export async function renumber(root, oldArg, newArg, { dry = false, log = console.log } = {}) {
  const { oldId, newId } = resolveIds(root, oldArg, newArg);
  const meta = JSON.parse(readFileSync(resolve(root, 'chaingraph/chaingraph.meta.json'), 'utf8'));
  if ((meta.order?.nodes ?? []).includes(oldId)) throw new Error(`${oldId} is ENROLLED (chaingraph.meta.json order.nodes): a live node is superseded by a successor node, never renumbered`);
  const moves = planFor(root, oldId, newId);
  for (const need of ['shard', 'kernel']) if (!moves.some((m) => m.kind === need)) throw new Error(`no ${need} file for ${oldId}`);
  for (const m of moves) if (existsSync(resolve(root, m.to))) throw new Error(`target already exists: ${m.to}`);

  log(`${dry ? '[dry] ' : ''}renumber ${oldId} -> ${newId}`);
  for (const m of moves) log(`  ${m.kind.padEnd(11)} ${m.from} -> ${m.to}${m.rewrite ? '  (+ id strings)' : ''}`);

  const shardObj = JSON.parse(readFileSync(resolve(root, moves.find((m) => m.kind === 'shard').from), 'utf8'));
  const inScope = shardObj.status === 'live' && shardObj.gpu === false;
  log(`  restamp     gen-kernel-identity --write --shard=${newId}${inScope ? '' : '  (SKIPPED: shard is not live gpu:false)'}`);
  const pageMove = moves.find((m) => m.kind === 'page');
  if (pageMove) log(`  restamp     page <meta name="kernel-digest"> in ${pageMove.to}`);
  if (dry) return { oldId, newId, dry: true };

  for (const m of moves) {
    gitMv(root, m.from, m.to);
    if (m.rewrite) {
      const p = resolve(root, m.to);
      const txt = readFileSync(p, 'utf8');
      if (txt.includes(oldId)) writeFileSync(p, txt.split(oldId).join(newId));
    }
  }

  // Restamp 1: the page's build-time kernel digest (the stamp #2860 also left stale).
  const { sourceDigest } = await import(pathToFileURL(resolve(root, 'chaingraph/kernels/_buildid.mjs')).href);
  const digest = await sourceDigest(readFileSync(resolve(root, `chaingraph/kernels/${newId}.kernel.mjs`), 'utf8'));
  if (pageMove) {
    const p = resolve(root, pageMove.to);
    const html = readFileSync(p, 'utf8');
    const re = /(<meta name="kernel-digest" content=")sha256:[0-9a-f]{64}(">)/;
    if (re.test(html)) writeFileSync(p, html.replace(re, `$1${digest}$2`));
    else log('  note: page carries no <meta name="kernel-digest"> sentinel, nothing to restamp there');
  }

  // Restamp 2: shard identity via the one generator (never a hand-built hash).
  if (inScope) {
    const gen = resolve(root, 'chaingraph/kernels/gen-kernel-identity.mjs');
    const env = { KERNELID_TOUCHED_IDS: newId };
    const w = run(root, [gen, '--write', `--shard=${newId}`], env);
    if (w.status !== 0) throw new Error(`gen-kernel-identity --write failed (exit ${w.status}):\n${w.stdout}${w.stderr}`);
    const c = run(root, [gen, '--check', `--shard=${newId}`], env);
    if (c.status !== 0) throw new Error(`gen-kernel-identity --check failed after restamp (exit ${c.status}):\n${c.stdout}${c.stderr}`);
    log('  restamped and verified: ' + c.stdout.trim().split('\n')[0]);
  }

  // Report stragglers: bare numbered references the id rewrite deliberately does not touch.
  const oldN = numOf(oldId);
  if (oldN) {
    const ref = new RegExp(`\\b${oldN.startsWith('art-') ? oldN : 'art-' + oldN}\\b`);
    for (const m of moves.filter((x) => x.rewrite)) {
      if (ref.test(readFileSync(resolve(root, m.to), 'utf8'))) log(`  warning: ${m.to} still mentions "${oldN.startsWith('art-') ? oldN : 'art-' + oldN}" (bare number); review by hand`);
    }
  }
  log('done. Commit the renames and rewrites by explicit pathspec; run node scripts/preflight.mjs --affected.');
  return { oldId, newId, digest };
}

// ---- self-test -------------------------------------------------------------------------------------------------
async function selfTest() {
  let pass = 0, fail = 0;
  const check = (n, c, d) => { if (c) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.error(`  FAIL ${n}${d ? '\n       ' + d : ''}`); } };
  const OLD = '811-demo-node', NEW = '813-demo-node';
  const dir = mkdtempSync(join(tmpdir(), 'renumber-selftest-'));
  try {
    const w = (rel, txt) => { const p = resolve(dir, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, txt); };
    const K = resolve(dir, 'chaingraph/kernels');
    mkdirSync(K, { recursive: true });
    for (const f of ['gen-kernel-identity.mjs', '_buildid.mjs']) cpSync(resolve(REPO, 'chaingraph/kernels', f), resolve(K, f));
    w('chaingraph/kernels/index.mjs', 'export const KERNELS = {\n};\n');   // unregistered, like a PR-side new node
    w('chaingraph/chaingraph.meta.json', JSON.stringify({ order: { nodes: [] } }));
    const { sourceDigest } = await import(pathToFileURL(resolve(K, '_buildid.mjs')).href);
    const kernelSrc = (id) => `const TOOL_ID = '${id}';\n// ${id}: demo kernel\nexport function compute() { return { id: TOOL_ID }; }\n`;
    const oldDigest = await sourceDigest(kernelSrc(OLD));
    const shard = { tool_id: OLD, status: 'live', gpu: false, url: `https://ainumbers.co/chaingraph/${OLD}.html`,
      compute_capability: 'server',
      compute_images: [{ system: 'sha256-source', image_id: oldDigest, valid_from: '2026-11-03' }],
      compute_proof_ready: 'deferred' };   // a key after compute_images: the generator's upsert anchors on the trailing comma
    w(`chaingraph/graph/nodes/${OLD}.json`, JSON.stringify(shard, null, 2) + '\n');
    w(`chaingraph/kernels/${OLD}.kernel.mjs`, kernelSrc(OLD));
    w(`chaingraph/${OLD}.html`, `<html><head>\n<meta name="kernel-digest" content="${oldDigest}">\n</head><body>${OLD}</body></html>\n`);
    w(`chaingraph/kernels/__proptests__/${OLD}.proptest.mjs`, `// ${OLD}\n`);
    w(`chaingraph/kernels/fixtures/${OLD}.fixtures.json`, JSON.stringify({ tool_id: OLD }) + '\n');
    w('chaingraph/graph/reservations/art-811.json', '{"row":"X","pr":null}\n');

    // dry run: plan only, nothing moves
    const lines = [];
    await renumber(dir, OLD, '813', { dry: true, log: (s) => lines.push(s) });
    check('--dry prints a plan and writes nothing', lines.length > 3 && existsSync(resolve(dir, `chaingraph/kernels/${OLD}.kernel.mjs`)) && !existsSync(resolve(dir, `chaingraph/kernels/${NEW}.kernel.mjs`)));

    // enrolled node is refused
    w('chaingraph/chaingraph.meta.json', JSON.stringify({ order: { nodes: [OLD] } }));
    let refused = false; try { await renumber(dir, OLD, '813', { log: () => {} }); } catch (e) { refused = /ENROLLED/.test(e.message); }
    check('enrolled node is refused', refused);
    w('chaingraph/chaingraph.meta.json', JSON.stringify({ order: { nodes: [] } }));

    // real run
    const out = await renumber(dir, OLD, '813', { log: () => {} });
    const has = (rel) => existsSync(resolve(dir, rel));
    check('all node files and the reservation moved', ['graph/nodes/' + NEW + '.json', NEW + '.html', 'kernels/' + NEW + '.kernel.mjs', 'kernels/__proptests__/' + NEW + '.proptest.mjs', 'kernels/fixtures/' + NEW + '.fixtures.json'].every((r) => has('chaingraph/' + r)) && has('chaingraph/graph/reservations/art-813.json') && !has('chaingraph/graph/reservations/art-811.json'));
    check('no old id string remains in any moved file', ['graph/nodes/' + NEW + '.json', NEW + '.html', 'kernels/' + NEW + '.kernel.mjs', 'kernels/fixtures/' + NEW + '.fixtures.json'].every((r) => !readFileSync(resolve(dir, 'chaingraph/' + r), 'utf8').includes(OLD)));
    const want = await sourceDigest(readFileSync(resolve(dir, `chaingraph/kernels/${NEW}.kernel.mjs`), 'utf8'));
    check('kernel digest moved (the #2860 premise)', want !== oldDigest);
    const sh = JSON.parse(readFileSync(resolve(dir, `chaingraph/graph/nodes/${NEW}.json`), 'utf8'));
    check('shard sha256-source restamped to the recomputed digest', sh.compute_images.find((i) => i.system === 'sha256-source').image_id === want && out.digest === want);
    check('page meta kernel-digest restamped', readFileSync(resolve(dir, `chaingraph/${NEW}.html`), 'utf8').includes(`content="${want}"`));
    const chk = run(dir, [resolve(K, 'gen-kernel-identity.mjs'), '--check', '--shard'], { KERNELID_TOUCHED_IDS: NEW });
    check('gen-kernel-identity --check --shard is green on the result', chk.status === 0, chk.stdout + chk.stderr);

    // RED control: the hand renumber (ids only, no restamp) must be caught by the gate this tool feeds.
    const k2 = resolve(K, `${NEW}.kernel.mjs`);
    writeFileSync(k2, kernelSrc('815-demo-node'));
    const red = run(dir, [resolve(K, 'gen-kernel-identity.mjs'), '--check', '--shard'], { KERNELID_TOUCHED_IDS: NEW });
    check('RED control: id-only kernel edit without restamp fails the shard check', red.status === 1, red.stdout + red.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  console.log(`renumber-node self-test: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) await selfTest();
  const pos = argv.filter((a) => !a.startsWith('--'));
  const rootArg = argv.find((a) => a.startsWith('--root='));
  if (pos.length !== 2) { console.error('usage: renumber-node.mjs <old> <new> [--dry] [--root=<dir>] | --self-test'); process.exit(2); }
  try { await renumber(rootArg ? resolve(rootArg.slice(7)) : REPO, pos[0], pos[1], { dry: argv.includes('--dry') }); }
  catch (e) { console.error('renumber-node: ' + e.message); process.exit(1); }
}
