/**
 * scripts/ci/pr-autofix-kernel.test.mjs — allowlist fixtures for the kernel-PR autofix writers.
 * Pure: no writer runs, no tree is touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { kernelIds, rootPages, allowlists, extraAllowed } from './pr-autofix-kernel.mjs';
import { gitEnv } from '../_git-env-lib.mjs';

const yes = () => true;
const COVERED = ['index.html', 'tools.html', 'sitemap.html', 'sitemap.xml', 'chaingraph', 'tools'];

test('kernel ids come only from existing *.kernel.mjs paths with a valid id', () => {
  const touched = [
    'chaingraph/kernels/art-213-perp.kernel.mjs',
    'chaingraph/kernels/art-213-perp.kernel.mjs',
    'chaingraph/kernels/Bad Id.kernel.mjs',
    'chaingraph/kernels/sub/x.kernel.mjs',
    'chaingraph/kernels/index.mjs',
    'chaingraph/chaingraph.json',
  ];
  assert.deepEqual(kernelIds(touched, yes), ['art-213-perp']);
  assert.deepEqual(kernelIds(touched, () => false), [], 'a deleted kernel names no id');
});

test('identity and schema allowlists are exactly the kernel id own shard and manifest', () => {
  const a = allowlists(['chaingraph/kernels/art-1-x.kernel.mjs'], COVERED, yes);
  assert.deepEqual(a['kernel-identity'], ['chaingraph/graph/nodes/art-1-x.json']);
  assert.deepEqual(a['input-schema'], ['manifests/art-1-x.manifest.json']);
  assert.deepEqual(a['root-chrome'], []);
});

test('no writer allowlist ever contains a shared derived artifact', () => {
  const touched = [
    'chaingraph/kernels/art-1-x.kernel.mjs', 'index.html', 'tools.html', 'sitemap.html',
    'chaingraph/chaingraph.json', 'about.html',
  ];
  const all = extraAllowed(touched, COVERED, yes);
  for (const forbidden of ['index.html', 'tools.html', 'sitemap.html', 'chaingraph/chaingraph.json', 'sitemap.xml']) {
    assert.ok(!all.includes(forbidden), `${forbidden} must not be writable`);
  }
  assert.ok(all.includes('about.html'), 'a touched non-derived root page is writable by root-chrome');
});

test('root pages: only root-level html, nested pages are out', () => {
  assert.deepEqual(rootPages(['a.html', 'tools/b.html', 'c.json', 'd.html']), ['a.html', 'd.html']);
});

test('an untouched root page is never allowed', () => {
  const a = allowlists(['chaingraph/kernels/art-1-x.kernel.mjs'], COVERED, yes);
  assert.ok(!a['root-chrome'].includes('about.html'));
});

// ---- non-applicable writer preconditions skip; real errors still fail ----
import { classifyIdentity, identityStep } from './pr-autofix-kernel.mjs';

const NOT_IN_SCOPE = '✗ art-816-x: not in scope for §17 identity (need status:live, gpu:false, kernel registered in index.mjs, and a .kernel.mjs on disk)';

test('non-live shard: exit 3 with the not-in-scope line is a skip, not a failure', () => {
  assert.equal(classifyIdentity({ status: 3, output: NOT_IN_SCOPE }), 'skip');
  assert.equal(identityStep('art-816-x', () => ({ status: 3, output: NOT_IN_SCOPE }), () => true), 'skip');
});

test('live shard drift: exit 0 is ok (the writer stamped it)', () => {
  const calls = [];
  const run = (a) => { calls.push(a); return { status: 0, output: 'stamped' }; };
  assert.equal(identityStep('art-1-x', run, () => true), 'ok');
  assert.deepEqual(calls[0], ['chaingraph/kernels/gen-kernel-identity.mjs', '--write', '--shard=art-1-x']);
});

test('real writer errors fail: other exit codes and exit 3 without the not-in-scope line', () => {
  assert.equal(classifyIdentity({ status: 4, output: 'SAFETY: stamped shard does not parse' }), 'fail');
  assert.equal(classifyIdentity({ status: 1, output: NOT_IN_SCOPE }), 'fail');
  assert.equal(classifyIdentity({ status: 3, output: 'shard x.json does not parse as JSON' }), 'fail');
  assert.equal(identityStep('art-1-x', () => ({ status: 3, output: 'boom' }), () => true), 'fail');
});

test('missing shard: skipped without running the writer', () => {
  let ran = false;
  assert.equal(identityStep('art-9-x', () => { ran = true; return { status: 0, output: '' }; }, () => false), 'skip');
  assert.equal(ran, false);
});

// ---- whole-PR touched set reaches the identity writer (2026-11-10, #2894) ----
// The job checks out the PR HEAD commit, so the writer's own `git diff HEAD^1 HEAD` probe only sees the
// last commit (after a main merge: main's delta). The script must hand the writer the WHOLE-PR kernel ids.

test('touched ids reach the writer as KERNELID_TOUCHED_IDS (comma list); the args are unchanged', () => {
  const seen = [];
  const run = (a, env) => { seen.push({ a, env }); return { status: 0, output: 'stamped' }; };
  assert.equal(identityStep('art-1-x', run, () => true, ['art-1-x', 'art-2-y']), 'ok');
  assert.deepEqual(seen[0].a, ['chaingraph/kernels/gen-kernel-identity.mjs', '--write', '--shard=art-1-x']);
  assert.deepEqual(seen[0].env, { KERNELID_TOUCHED_IDS: 'art-1-x,art-2-y' });
});

test('no touched list (legacy caller): the writer is run with no env override, exactly as before', () => {
  const seen = [];
  const run = (a, env) => { seen.push({ a, env }); return { status: 0, output: '' }; };
  identityStep('art-1-x', run, () => true);
  assert.equal(seen[0].env, undefined);
});

test('RED/GREEN on the real writer: a main-merge head hides the kernel without the list, the list restores it', async () => {
  // Fixture tree: a shard (live, gpu:false), a kernel file, an index.mjs that does NOT register the node,
  // and a git history whose last commit does not touch the kernel (the main-merge head shape).
  const { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve: res, dirname: dn } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { spawnSync } = await import('node:child_process');
  const repo = res(dn(fileURLToPath(import.meta.url)), '..', '..');
  const root = mkdtempSync(join(tmpdir(), 'autofix-touched-'));
  try {
    const kd = join(root, 'chaingraph', 'kernels');
    mkdirSync(join(root, 'chaingraph', 'graph', 'nodes'), { recursive: true });
    mkdirSync(kd, { recursive: true });
    for (const f of ['gen-kernel-identity.mjs', '_buildid.mjs']) cpSync(join(repo, 'chaingraph', 'kernels', f), join(kd, f));
    mkdirSync(join(root, 'scripts'), { recursive: true });
    cpSync(join(repo, 'scripts', '_git-env-lib.mjs'), join(root, 'scripts', '_git-env-lib.mjs'));
    // the writer imports nothing else from the estate beyond what the copy above and node builtins give it;
    // if it grows an import this control fails loudly (ERR_MODULE_NOT_FOUND) rather than passing vacuously.
    writeFileSync(join(kd, 'index.mjs'), 'export const KERNELS = {\n};\n');
    writeFileSync(join(kd, 'art-1-x.kernel.mjs'), 'export async function buildArtifact(){ return {}; }\n');
    writeFileSync(join(root, 'chaingraph', 'graph', 'nodes', 'art-1-x.json'), JSON.stringify({ tool_id: 'art-1-x', status: 'live', gpu: false }, null, 2) + '\n');
    writeFileSync(join(root, 'chaingraph', 'chaingraph.json'), JSON.stringify({ nodes: [] }) + '\n');
    const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', env: gitEnv() });
    git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    git('add', '-A'); git('commit', '-qm', 'base');
    writeFileSync(join(root, 'unrelated.txt'), 'x'); git('add', '-A'); git('commit', '-qm', 'last commit does not touch the kernel');
    const runWriter = (extra) => spawnSync(process.execPath, [join(kd, 'gen-kernel-identity.mjs'), '--write', '--shard=art-1-x'], {
      cwd: root, encoding: 'utf8', env: gitEnv({ GITHUB_EVENT_NAME: 'pull_request', ...extra }),
    });
    const without = runWriter({});
    assert.equal(without.status, 3, 'RED: without the list the writer must refuse (exit 3): ' + (without.stdout + without.stderr).slice(0, 300));
    assert.ok(/not in scope for \S{0,3}17 identity/.test((without.stdout || '') + (without.stderr || '')), 'RED: refused for the not-in-scope reason, not some other failure');
    const withList = runWriter({ KERNELID_TOUCHED_IDS: 'art-1-x' });
    assert.ok(!/not in scope/.test((withList.stdout || '') + (withList.stderr || '')), 'GREEN: with the list the kernel is in scope: ' + (withList.stdout + withList.stderr).slice(0, 300));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---- the input-schema writer never creates a manifest (2026-11-15, AUTOFIX-INPUT-SCHEMA-NO-CREATE-1) ----
// #3136: a kernel PR whose node had no manifest got one anyway — the writer's BACKFILL-CREATE path
// laid down manifests/810-*.manifest.json (mcp_name over the 30 limit, description over 500) and the
// PR red'd webmcp-meta-budgets. The wiring must skip a manifest-less id with a notice instead of
// invoking the writer at all.

test('manifest-less id: the schema writer is never invoked, the step skips', async () => {
  const { inputSchemaStep } = await import('./pr-autofix-kernel.mjs');
  const calls = [];
  const run = (a) => { calls.push(a); return { status: 0, output: 'created manifests/art-1-x.manifest.json' }; };
  const res = inputSchemaStep('art-1-x', run, () => false);
  assert.equal(res, 'skip');
  assert.equal(calls.length, 0, 'RED: the writer ran for a manifest-less id and its create path lays down a manifest file');
});

test('existing manifest: the writer still runs with exactly the flags it runs today', async () => {
  const { inputSchemaStep } = await import('./pr-autofix-kernel.mjs');
  const calls = [];
  const res = inputSchemaStep('art-1-x', (a) => { calls.push(a); return { status: 0, output: '' }; }, () => true);
  assert.equal(res, 'ok');
  assert.deepEqual(calls[0], ['scripts/gen-input-schemas.mjs', '--write', '--only', 'art-1-x']);
});

test('whole wiring, real script, fake create path: no manifest appears, notice names the id, exit 0', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, cpSync, existsSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve: res, dirname: dn } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { spawnSync } = await import('node:child_process');
  const repo = res(dn(fileURLToPath(import.meta.url)), '..', '..');
  const root = mkdtempSync(join(tmpdir(), 'autofix-nocreate-'));
  try {
    mkdirSync(join(root, 'scripts', 'ci'), { recursive: true });
    mkdirSync(join(root, 'chaingraph', 'kernels'), { recursive: true });
    // the REAL script, unmodified: this exercises the wiring, not a reimplementation of it
    cpSync(join(repo, 'scripts', 'ci', 'pr-autofix-kernel.mjs'), join(root, 'scripts', 'ci', 'pr-autofix-kernel.mjs'));
    cpSync(join(repo, 'scripts', '_git-env-lib.mjs'), join(root, 'scripts', '_git-env-lib.mjs'));
    // estate stubs: coveredPaths() is the script's only other import; the fake schema writer
    // mimics the real BACKFILL-CREATE path — invoked at all, it lays down the manifest
    writeFileSync(join(root, 'scripts', 'derived-artifacts.mjs'), 'export function coveredPaths() { return []; }\n');
    writeFileSync(
      join(root, 'scripts', 'gen-input-schemas.mjs'),
      [
        "import { mkdirSync, writeFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        "const id = process.argv[process.argv.indexOf('--only') + 1];",
        "mkdirSync('manifests', { recursive: true });",
        "writeFileSync(join('manifests', `${id}.manifest.json`), '{}\\n');",
        "console.log(`created manifests/${id}.manifest.json`);",
      ].join('\n'),
    );
    writeFileSync(join(root, 'chaingraph', 'kernels', 'art-1-x.kernel.mjs'), 'export async function buildArtifact(){ return {}; }\n');
    // no chaingraph/graph/nodes/art-1-x.json on purpose: the identity writer skips, out of scope here
    const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', env: gitEnv() });
    git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    git('add', '-A'); git('commit', '-qm', 'base');
    const touched = join(root, 'touched.nul');
    writeFileSync(touched, 'chaingraph/kernels/art-1-x.kernel.mjs\0');
    const r = spawnSync(process.execPath, [join(root, 'scripts', 'ci', 'pr-autofix-kernel.mjs'), '--touched', touched], {
      cwd: root, encoding: 'utf8', env: gitEnv(),
    });
    const out = (r.stdout || '') + (r.stderr || '');
    assert.equal(r.status, 0, 'the run itself exits 0: ' + out.slice(0, 400));
    assert.ok(!existsSync(join(root, 'manifests', 'art-1-x.manifest.json')), 'RED: a manifest file appears for a node that has none (the create path ran)');
    assert.ok(!out.includes('> node scripts/gen-input-schemas.mjs'), 'the schema writer was never invoked');
    assert.ok(out.includes('::notice title=input-schema skipped for art-1-x'), 'GREEN: one notice names the id and the reason');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---- proof-links on a kernel or node-shard change (PR-AUTOFIX-PROOFLINKS-ON-KERNEL-1) ----
// The proof-links block names the kernel digest, the receipt and the registry record, so a kernel
// edit or a re-prove moves it even when the PR never touched the page. Before this row only the
// page step rewrote it, for pages in the touched set, and re-prove PRs hand-healed it (#3239, #3285).

import { proofLinkIds, onlyProofLinksChanged, proofLinksStep } from './pr-autofix-kernel.mjs';

const PL_BLOCK = (digest) => `<!--PROOF-LINKS-->\n<details class="proof-links">\n  <ul>\n  <li>Kernel digest: sha256:${digest}</li>\n  </ul>\n</details>\n<!--/PROOF-LINKS-->`;
const PAGE = (body) => `<!doctype html>\n<html><head><meta name="kernel-digest" content="sha256:aaaa"></head>\n<body>\n<main>x</main>\n${body}<footer>f</footer>\n</body></html>\n`;
// The page and shard exist for ids art-1-x and art-2-y; art-3-z has a shard but no page.
const TREE = new Set([
  'chaingraph/kernels/art-1-x.kernel.mjs', 'chaingraph/graph/nodes/art-1-x.json', 'chaingraph/art-1-x.html',
  'chaingraph/graph/nodes/art-2-y.json', 'chaingraph/art-2-y.html',
  'chaingraph/kernels/art-3-z.kernel.mjs', 'chaingraph/graph/nodes/art-3-z.json',
]);
const inTree = (p) => TREE.has(p);

test('proof-links ids: a kernel OR a node shard triggers, once per id, only for pages the writer owns', () => {
  const touched = [
    'chaingraph/kernels/art-1-x.kernel.mjs',
    'chaingraph/graph/nodes/art-1-x.json', // same id again: one entry
    'chaingraph/graph/nodes/art-2-y.json', // shard only, page untouched: the case this row adds
    'chaingraph/kernels/art-3-z.kernel.mjs', // no top-level page: gen-proof-links does not own it
    'chaingraph/kernels/fixtures/art-1-x.fixtures.json',
    'chaingraph/graph/nodes/Bad Id.json',
    'chaingraph/graph/nodes/sub/art-1-x.json',
  ];
  assert.deepEqual(proofLinkIds(touched, inTree), ['art-1-x', 'art-2-y']);
});

test('proof-links ids: a deleted kernel or shard names no id', () => {
  const gone = (p) => inTree(p) && p !== 'chaingraph/graph/nodes/art-2-y.json';
  assert.deepEqual(proofLinkIds(['chaingraph/graph/nodes/art-2-y.json'], gone), []);
  assert.deepEqual(proofLinkIds(['chaingraph/kernels/art-9-q.kernel.mjs'], inTree), []);
});

test('proof-links allowlist is exactly the node page of each triggering id, and nothing shared', () => {
  const touched = ['chaingraph/kernels/art-1-x.kernel.mjs', 'chaingraph/graph/nodes/art-2-y.json', 'index.html', 'chaingraph/chaingraph.json'];
  const a = allowlists(touched, COVERED, inTree);
  assert.deepEqual(a['proof-links'], ['chaingraph/art-1-x.html', 'chaingraph/art-2-y.html']);
  // the shard-only id does not widen the identity or schema writers
  assert.deepEqual(a['kernel-identity'], ['chaingraph/graph/nodes/art-1-x.json']);
  assert.deepEqual(a['input-schema'], ['manifests/art-1-x.manifest.json']);
  const all = extraAllowed(touched, COVERED, inTree);
  for (const forbidden of ['index.html', 'tools.html', 'sitemap.html', 'chaingraph/chaingraph.json', 'sitemap.xml', 'chaingraph/art-3-z.html']) {
    assert.ok(!all.includes(forbidden), `${forbidden} must not be writable`);
  }
});

test('region fence: replacing the block in place passes; a byte outside it fails', () => {
  const before = PAGE(PL_BLOCK('old') + '\n');
  assert.equal(onlyProofLinksChanged(before, PAGE(PL_BLOCK('new') + '\n')), true);
  assert.equal(onlyProofLinksChanged(before, before), true);
  const headEdit = PAGE(PL_BLOCK('new') + '\n').replace('sha256:aaaa', 'sha256:bbbb');
  assert.equal(onlyProofLinksChanged(before, headEdit), false, 'RED: the kernel-digest meta must never ride this writer');
  const footerEdit = PAGE(PL_BLOCK('new') + '\n').replace('<footer>f</footer>', '<footer>g</footer>');
  assert.equal(onlyProofLinksChanged(before, footerEdit), false);
  assert.equal(onlyProofLinksChanged(before, PAGE('')), false, 'a removed block is not a block rewrite');
});

test('region fence: a first insertion above the footer passes, in both of withBlock\'s shapes', () => {
  const before = PAGE('');
  // before ends with "\n" ahead of <footer>: withBlock adds no separator
  assert.equal(onlyProofLinksChanged(before, PAGE(PL_BLOCK('d') + '\n')), true);
  // before has no newline ahead of <footer>: withBlock adds one
  const tight = before.replace('</main>\n<footer>', '</main><footer>');
  const tightAfter = tight.replace('<footer>', '\n' + PL_BLOCK('d') + '\n<footer>');
  assert.equal(onlyProofLinksChanged(tight, tightAfter), true);
  // an insertion that also edits the body is still an escape
  assert.equal(onlyProofLinksChanged(before, PAGE(PL_BLOCK('d') + '\n').replace('<main>x', '<main>y')), false);
});

test('proof-links step: runs the writer with exactly --only <id>, and classifies its result', () => {
  const calls = [];
  let page = PAGE(PL_BLOCK('old') + '\n');
  const read = () => page;
  const ok = proofLinksStep('art-2-y', (a) => { calls.push(a); page = PAGE(PL_BLOCK('new') + '\n'); return { status: 0, output: '' }; }, read);
  assert.equal(ok, 'ok');
  assert.deepEqual(calls[0], ['scripts/gen-proof-links.mjs', '--only', 'art-2-y']);
  assert.equal(proofLinksStep('art-2-y', () => ({ status: 0, output: '' }), read), 'unchanged');
  assert.equal(proofLinksStep('art-2-y', () => { page = page.replace('<main>x', '<main>y'); return { status: 0, output: '' }; }, read), 'escaped');
  assert.equal(proofLinksStep('art-2-y', () => ({ status: 1, output: 'boom' }), read), 'error');
});

test('whole wiring, real script: a shard-only PR gets the block written; a writer that strays is reverted and fails', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve: res, dirname: dn } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { spawnSync } = await import('node:child_process');
  const repo = res(dn(fileURLToPath(import.meta.url)), '..', '..');
  const setup = (writerBody) => {
    const root = mkdtempSync(join(tmpdir(), 'autofix-prooflinks-'));
    mkdirSync(join(root, 'scripts', 'ci'), { recursive: true });
    mkdirSync(join(root, 'chaingraph', 'graph', 'nodes'), { recursive: true });
    cpSync(join(repo, 'scripts', 'ci', 'pr-autofix-kernel.mjs'), join(root, 'scripts', 'ci', 'pr-autofix-kernel.mjs'));
    cpSync(join(repo, 'scripts', '_git-env-lib.mjs'), join(root, 'scripts', '_git-env-lib.mjs'));
    writeFileSync(join(root, 'scripts', 'derived-artifacts.mjs'), "export function coveredPaths() { return ['chaingraph/art-2-y.html']; }\n");
    // A fake gen-proof-links: rewrites the block from the shard's digest field, like the real one
    // rewrites it from the kernel digest. The stray variant also edits the page head.
    writeFileSync(join(root, 'scripts', 'gen-proof-links.mjs'), writerBody);
    writeFileSync(join(root, 'chaingraph', 'graph', 'nodes', 'art-2-y.json'), '{"tool_id":"art-2-y","digest":"old"}\n');
    writeFileSync(join(root, 'chaingraph', 'art-2-y.html'), PAGE(PL_BLOCK('old') + '\n'));
    const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', env: gitEnv() });
    git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    git('add', '-A'); git('commit', '-qm', 'base');
    // the PR: a re-prove that changed only the shard
    writeFileSync(join(root, 'chaingraph', 'graph', 'nodes', 'art-2-y.json'), '{"tool_id":"art-2-y","digest":"new"}\n');
    git('commit', '-qam', 'prove');
    const touched = join(root, 'touched.nul');
    writeFileSync(touched, 'chaingraph/graph/nodes/art-2-y.json\0');
    const r = spawnSync(process.execPath, [join(root, 'scripts', 'ci', 'pr-autofix-kernel.mjs'), '--touched', touched], { cwd: root, encoding: 'utf8', env: gitEnv() });
    return { root, r, out: (r.stdout || '') + (r.stderr || ''), page: () => readFileSync(join(root, 'chaingraph', 'art-2-y.html'), 'utf8') };
  };
  const writer = (stray) => [
    "import { readFileSync, writeFileSync } from 'node:fs';",
    "const id = process.argv[process.argv.indexOf('--only') + 1];",
    "const d = JSON.parse(readFileSync(`chaingraph/graph/nodes/${id}.json`, 'utf8')).digest;",
    "const p = `chaingraph/${id}.html`;",
    'let h = readFileSync(p, "utf8").replace(/<!--PROOF-LINKS-->[\\s\\S]*?<!--\\/PROOF-LINKS-->/, (m) => m.replace(/sha256:\\w+/, "sha256:" + d));',
    stray ? "h = h.replace('sha256:aaaa', 'sha256:' + d);" : '',
    'writeFileSync(p, h);',
  ].join('\n');

  const good = setup(writer(false));
  try {
    assert.equal(good.r.status, 0, 'the run exits 0: ' + good.out.slice(0, 400));
    assert.ok(good.out.includes('> node scripts/gen-proof-links.mjs --only art-2-y'), 'GREEN: the writer ran for a shard-only PR');
    assert.equal(good.page(), PAGE(PL_BLOCK('new') + '\n'), 'GREEN: the block now names the PR\'s digest, nothing else moved');
  } finally { rmSync(good.root, { recursive: true, force: true }); }

  const bad = setup(writer(true));
  try {
    assert.equal(bad.r.status, 1, 'RED: a write outside the block fails the run: ' + bad.out.slice(0, 400));
    assert.ok(bad.out.includes('proof-links wrote outside its block'), 'the error names the escape');
    assert.equal(bad.page(), PAGE(PL_BLOCK('old') + '\n'), 'the page is restored to what it was before the writer ran');
  } finally { rmSync(bad.root, { recursive: true, force: true }); }
});
