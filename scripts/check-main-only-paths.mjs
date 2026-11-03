#!/usr/bin/env node
// check-main-only-paths.mjs — MAIN-ONLY-PATHS-GATE-1 (2026-11-03).
//
// A PR may not carry a file that only main's derived regen writes. derived-artifacts-regen.yml is
// the single writer for every shared derived artifact (SO #35, repo/CLAUDE.md "Wave Completion
// Checklist"); a PR that commits one anyway goes DIRTY the next time main's regen bot rewrites the
// same file, and every later PR that touched it conflicts too. Measured 2026-11-03: besides
// RESERVATIONS.json, the DIRTY PRs conflicted on mcp.html, docs/index.html, mcp/catalog.json,
// .well-known/*.json, about.html, chaingraph/chaingraph-hub.html and
// chaingraph/data/chain-builder-catalog.gen.js — all main-regen outputs.
//
// SSOT: scripts/derived-artifacts.mjs COVERED (the regen's declared write set, the same list the
// regen workflow stages "by explicit pathspec" via `derived-artifacts.mjs --paths`). Nothing here
// restates a path list. The script only CLASSIFIES the COVERED entries:
//
//   whole-file  an exact file path declared by an entry that rewrites the whole file. Any change
//               in the PR diff (add, modify, delete) is refused.
//   sentinel    an .html file declared ONLY by entries that rewrite count sentinels inside an authored
//               page (SENTINEL_WRITER_IDS: verify-counts --fix, sync-stats --fix; their non-HTML
//               targets are whole-file). Prose edits are
//               the PR's business; a changed line carrying a sentinel (`<!--COUNT:`, `data-count=`,
//               a numeric `id="…count…"` span) is refused, because main's regen owns that region.
//   region      a file declared ONLY by entries that rewrite one generated block inside a page the
//               PR authors (REGION_WRITER_IDS). Never refused: node, chain and hub pages are
//               PR-authored, and pr-autofix.yml writes the ask-agent / a11y blocks per PR.
//   tree        a declared directory prefix (tools, chaingraph, skills, source, manifests/ …).
//               Never refused: those trees hold PR-authored files beside the generated ones.
//
// PER-PR DERIVABLES (never refused): pr-autofix.yml writes these on the PR head branch itself —
// see its header ("the per-PR derivables autofix"): manifest examples (manifests/*.manifest.json,
// a declared tree here), ask-agent + a11y blocks on chaingraph/*.html and tools/*.html (region
// entries here), and its writer-scope containment allowlist PER_PR_DERIVABLES below. The §18
// baseline (scripts/compute-proof-baseline.json) is NOT per-PR any more: pr-autofix retired that
// writer 2026-10-19 and the file is main-regen single-writer (derived-artifacts.mjs id
// 'compute-proof-baseline'), so it is refused like any other whole-file artifact.
//
// ROW CARRIERS (ROW_CARRIERS below): the monolith and the lineage binding are main-regen outputs,
// but two row shapes the regen cannot serve commit them in the PR. Each is allowed only when the
// diff carries that row's signature.
//
// CONTEXT
//   pull_request (CI)   HARD. Diff = merge-base(origin/$GITHUB_BASE_REF, HEAD)..HEAD.
//   local (no event)    HARD. Diff = merge-base(origin/main, HEAD)..HEAD — the pre-push hook view;
//                       on main itself the range is empty and the gate passes.
//   merge_group / push / workflow_dispatch / anything else: NOT RUN (exit 0). The queue tree and
//                       main legitimately carry the regen's own commits.
//
// Usage:
//   node scripts/check-main-only-paths.mjs                          # gate
//   node scripts/check-main-only-paths.mjs --base <ref> --head <ref> # dry-run any range (ignores event)
//   node scripts/check-main-only-paths.mjs --list                   # print the classified path sets
//   node scripts/check-main-only-paths.mjs --json                   # machine verdict on stdout
//   node scripts/check-main-only-paths.mjs --self-test              # RED/GREEN fixtures

import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { COVERED } from './derived-artifacts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const FIXTURES = resolve(HERE, 'check-main-only-paths.fixtures.json');

// Entries that rewrite count sentinels inside authored pages (verify-counts.mjs --fix,
// sync-stats.mjs --fix). Each id must exist in COVERED (drift guard in classify()).
export const SENTINEL_WRITER_IDS = new Set(['counts', 'stats']);

// Entries that rewrite one generated block inside a PR-authored page. Each id must exist in COVERED.
export const REGION_WRITER_IDS = new Set([
  'chain-ask-agent',    // ask-agent block on chaingraph/chains/*.html (pr-autofix writes node-page blocks per PR)
  'hub-scenes',         // scene region on chaingraph/guide-*.html hub pages
  'node-page-footers',  // footer region on chaingraph/<n>-*.html node pages (a node PR authors its page)
  'mcp-activity-embed', // one HTML comment in index.html (index.html is whole-file via 'catalog' anyway)
]);

// pr-autofix.yml writer-scope containment: the writers' own baseline outputs a PR may carry.
// Keep in step with that workflow's WRITER-SCOPE CONTAINMENT header (minus the retired §18 writer).
export const PER_PR_DERIVABLES = new Set([
  'scripts/a11y-baseline.json',
  'scripts/manifest-examples-baseline.json',
]);

// Whole-file artifacts a sanctioned row shape still carries, each allowed ONLY when the same diff
// has that row's signature. Anything else that touches them is refused like any other artifact.
//   ASSEMBLE/LAND rows: the main-side assembler refuses (writes nothing) on node removals/renames
//   or any graph/chains/ change — derived-artifacts.mjs id 'chaingraph-assemble' — so those PRs
//   commit the monolith themselves.
//   New-node enrollment: check-a11y-tree.mjs's mid-flight condition (a shard on disk not in
//   chaingraph.meta.json order.nodes) reds the queue and tells the PR to commit the regenerated
//   monolith (#2384; QUEUE-EJECT-NEWNODE-ASSEMBLE-1 owns that gate). Refusing it here would
//   deadlock every new-node PR between two gates, so an added node shard carries it too.
//   Lineage publish+anchor rows: gen-registry-lineage.mjs is EXCLUDED from the regen (Sigsum
//   budget), so the PR that publishes registry/lineage/ carries its absence tree + binding record
//   (derived-artifacts.mjs id 'registry-absence-tree').
export const ROW_CARRIERS = [
  { paths: ['chaingraph/chaingraph.json', 'chaingraph/chaingraph.meta.json'], row: 'ASSEMBLE/LAND or new-node enrollment (graph/chains/ change, node shard added or removed)',
    when: (changes) => changes.some((c) => c.path.startsWith('chaingraph/graph/chains/') || ((c.status === 'A' || c.status === 'D') && c.path.startsWith('chaingraph/graph/nodes/'))) },
  { paths: ['registry/absence/tree.json', 'chaingraph/kernels/registry-lineage-records.json'], row: 'lineage publish (registry/lineage/ change)',
    when: (changes) => changes.some((c) => c.path.startsWith('registry/lineage/')) },
];

// A changed line in a sentinel-only file is main-owned when it carries one of these.
export const SENTINEL_RE = /<!--\s*COUNT:|data-count=|id="[^"]*count[^"]*"[^>]*>\d+</;

export const REFUSAL_HINT = (p) => `main's regen writes this; drop it from the PR (git checkout origin/main -- ${p})`;

function isDir(p) {
  if (p.endsWith('/')) return true;
  try { return statSync(resolve(REPO, p)).isDirectory(); } catch { return false; }
}

/**
 * Classify the COVERED entries. Returns { whole, sentinel, region, trees } as Sets of paths.
 * `dirOf` is injectable for the self-test; the default reads the checkout.
 */
export function classify(covered = COVERED, dirOf = isDir) {
  const ids = new Set(covered.map((c) => c.id));
  for (const id of [...SENTINEL_WRITER_IDS, ...REGION_WRITER_IDS]) {
    if (!ids.has(id)) throw new Error(`check-main-only-paths: classifier names COVERED id "${id}", which derived-artifacts.mjs no longer declares. Update SENTINEL_WRITER_IDS / REGION_WRITER_IDS — a stale id silently changes what is refused.`);
  }
  const owners = new Map(); // path -> Set(entry id)
  const trees = new Set();
  for (const c of covered) {
    for (const p of c.artifacts || []) {
      if (dirOf(p)) { trees.add(p.replace(/\/$/, '')); continue; }
      if (!owners.has(p)) owners.set(p, new Set());
      owners.get(p).add(c.id);
    }
  }
  const whole = new Set(), sentinel = new Set(), region = new Set();
  for (const [p, by] of owners) {
    if (PER_PR_DERIVABLES.has(p)) continue;
    const ids = [...by];
    if (ids.some((id) => !SENTINEL_WRITER_IDS.has(id) && !REGION_WRITER_IDS.has(id))) whole.add(p);
    // A sentinel writer's non-HTML target (e.g. .well-known/mcp/server-card.json) has no authored
    // prose around the counts: the whole file is the generator's.
    else if (ids.some((id) => SENTINEL_WRITER_IDS.has(id))) (p.endsWith('.html') ? sentinel : whole).add(p);
    else region.add(p);
  }
  return { whole, sentinel, region, trees };
}

/** Parse `git diff -U0` text into Map(path -> [changed line text, without the +/- marker]). */
export function parseUnifiedDiff(text) {
  const out = new Map();
  let cur = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) { cur = null; continue; }
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      const p = line.slice(4).trim();
      if (p !== '/dev/null') { cur = p.replace(/^[ab]\//, ''); if (!out.has(cur)) out.set(cur, []); }
      continue;
    }
    if (!cur || line.startsWith('@@')) continue;
    if (line.startsWith('+') || line.startsWith('-')) out.get(cur).push(line.slice(1));
  }
  return out;
}

/**
 * Pure verdict. changes: [{ path, status, lines? }] (lines = changed line texts, needed only for
 * sentinel files). Returns [{ path, why }] — every refused path.
 */
export function refusals(changes, sets) {
  const out = [];
  const carried = new Set(ROW_CARRIERS.filter((r) => r.when(changes)).flatMap((r) => r.paths));
  for (const ch of changes) {
    if (carried.has(ch.path)) continue;
    if (sets.whole.has(ch.path)) out.push({ path: ch.path, why: `whole-file derived artifact (${ch.status})` });
    else if (sets.sentinel.has(ch.path)) {
      if (ch.status === 'A' || ch.status === 'D') { out.push({ path: ch.path, why: `count-sentinel page ${ch.status === 'A' ? 'added' : 'deleted'}` }); continue; }
      const hit = (ch.lines || []).find((l) => SENTINEL_RE.test(l));
      if (hit) out.push({ path: ch.path, why: `count sentinel edited: ${hit.trim().slice(0, 120)}` });
    }
  }
  return out;
}

/** Which mode a run takes. Returns 'hard' or 'skip'. */
export function decideContext(env, explicitRange) {
  if (explicitRange) return 'hard';
  const ev = env.GITHUB_EVENT_NAME;
  if (!ev) return 'hard';
  return ev === 'pull_request' ? 'hard' : 'skip';
}

function git(args) {
  const r = spawnSync('git', args, { cwd: REPO, env: gitEnv(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

/** Collect the PR's changes in base...head. Returns { changes, mb } or { error }. */
export function collectChanges(baseRef, headRef, sets) {
  const mb = git(['merge-base', baseRef, headRef]);
  if (!mb.ok || !mb.out) return { error: `merge-base(${baseRef}, ${headRef}) does not resolve: ${mb.err || 'empty'}` };
  const ns = git(['diff', '--no-renames', '--name-status', mb.out, headRef]);
  if (!ns.ok) return { error: `git diff --name-status failed: ${ns.err}` };
  const changes = ns.out.split('\n').filter(Boolean).map((l) => {
    const [status, ...rest] = l.split('\t');
    return { status: status[0], path: rest.join('\t') };
  });
  const sentinelTouched = changes.filter((c) => sets.sentinel.has(c.path) && c.status === 'M').map((c) => c.path);
  if (sentinelTouched.length) {
    const d = git(['diff', '--no-renames', '-U0', mb.out, headRef, '--', ...sentinelTouched]);
    if (!d.ok) return { error: `git diff -U0 failed: ${d.err}` };
    const lines = parseUnifiedDiff(d.out);
    for (const c of changes) if (lines.has(c.path)) c.lines = lines.get(c.path);
  }
  return { changes, mb: mb.out };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────────────

function selfTest() {
  let fails = 0;
  const check = (name, ok, detail = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok || !detail ? '' : ` — ${detail}`}`); if (!ok) fails++; };
  const fx = JSON.parse(readFileSync(FIXTURES, 'utf8'));
  const sets = classify();

  console.log('layer 1 — RED/GREEN fixtures against the live SSOT (scripts/derived-artifacts.mjs COVERED)');
  for (const c of fx.cases) {
    const got = refusals(c.changes, sets).map((r) => r.path).sort();
    const want = [...c.refused].sort();
    check(`${c.kind} ${c.name}`, JSON.stringify(got) === JSON.stringify(want), `refused ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }

  console.log('layer 2 — classifier invariants');
  for (const p of fx.mustBeWhole) check(`whole-file: ${p}`, sets.whole.has(p));
  for (const p of fx.mustBeSentinel) check(`sentinel: ${p}`, sets.sentinel.has(p));
  for (const p of PER_PR_DERIVABLES) check(`per-PR derivable never refused: ${p}`, !sets.whole.has(p) && !sets.sentinel.has(p));
  let threw = false;
  try { classify([{ id: 'only', artifacts: ['x.json'] }], () => false); } catch { threw = true; }
  check('drift guard: a classifier id missing from COVERED throws', threw);
  const toy = classify([
    { id: 'counts', artifacts: ['a.html', 'b.html'] }, { id: 'stats', artifacts: [] },
    { id: 'catalog', artifacts: ['b.html'] }, { id: 'chain-ask-agent', artifacts: ['c.html'] },
    { id: 'hub-scenes', artifacts: [] }, { id: 'node-page-footers', artifacts: [] }, { id: 'mcp-activity-embed', artifacts: [] },
    { id: 'tree', artifacts: ['dir/'] },
  ], (p) => p.endsWith('/'));
  check('toy: sentinel-only file is sentinel', toy.sentinel.has('a.html') && !toy.whole.has('a.html'));
  check('toy: a whole-file owner wins over a sentinel owner', toy.whole.has('b.html'));
  check('toy: region-only file is region', toy.region.has('c.html'));
  check('toy: directory artifact is a tree', toy.trees.has('dir') && !toy.whole.has('dir/'));

  console.log('layer 3 — diff parser + context');
  const parsed = parseUnifiedDiff(fx.unifiedDiff);
  check('parser: two files', parsed.size === 2, [...parsed.keys()].join(','));
  check('parser: changed lines kept, context dropped', (parsed.get('about.html') || []).length === 2);
  check('context: pull_request is hard', decideContext({ GITHUB_EVENT_NAME: 'pull_request' }) === 'hard');
  check('context: local (unset) is hard', decideContext({}) === 'hard');
  check('context: merge_group is skipped', decideContext({ GITHUB_EVENT_NAME: 'merge_group' }) === 'skip');
  check('context: push (main) is skipped', decideContext({ GITHUB_EVENT_NAME: 'push' }) === 'skip');
  check('context: explicit --base/--head is hard on merge_group', decideContext({ GITHUB_EVENT_NAME: 'merge_group' }, true) === 'hard');

  if (fails) { console.error(`✗ check-main-only-paths self-test: ${fails} check(s) failed`); process.exit(1); }
  console.log(`✓ check-main-only-paths self-test: all checks passed (${fx.cases.length} fixtures)`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────

const invokedAsMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  const argv = process.argv.slice(2);
  const argVal = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes('--self-test')) { selfTest(); process.exit(0); }
  const sets = classify();
  if (argv.includes('--list')) {
    for (const k of ['whole', 'sentinel', 'region', 'trees']) {
      console.log(`# ${k} (${sets[k].size})`);
      for (const p of [...sets[k]].sort()) console.log(p);
    }
    process.exit(0);
  }
  const explicit = Boolean(argVal('--base') || argVal('--head'));
  if (decideContext(process.env, explicit) === 'skip') {
    console.log(`check-main-only-paths: not run on ${process.env.GITHUB_EVENT_NAME} (PR-side gate; the queue and main carry the regen's own commits).`);
    process.exit(0);
  }
  const baseRef = argVal('--base') || `origin/${process.env.GITHUB_BASE_REF || 'main'}`;
  const headRef = argVal('--head') || 'HEAD';
  const got = collectChanges(baseRef, headRef, sets);
  if (got.error) { console.error(`✗ check-main-only-paths: ${got.error}. Failing closed.`); process.exit(1); }
  const refused = refusals(got.changes, sets);
  if (argv.includes('--json')) console.log(JSON.stringify({ base: baseRef, head: headRef, merge_base: got.mb, changed: got.changes.length, refused }));
  if (refused.length) {
    console.error(`✗ check-main-only-paths FAILED: ${refused.length} main-only path(s) in ${baseRef}...${headRef} (merge-base ${got.mb.slice(0, 12)}):`);
    for (const r of refused) console.error(`  • ${r.path} — ${r.why}\n      ${REFUSAL_HINT(r.path)}`);
    console.error('  derived-artifacts-regen.yml is the single writer for these on main (SO #35, scripts/derived-artifacts.mjs COVERED).');
    process.exit(1);
  }
  console.log(`✓ check-main-only-paths clean: ${got.changes.length} changed path(s) in ${baseRef}...${headRef}, none main-only (${sets.whole.size} whole-file + ${sets.sentinel.size} sentinel-page paths from derived-artifacts.mjs).`);
}
