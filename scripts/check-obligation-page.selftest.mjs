// scripts/check-obligation-page.selftest.mjs — GATE-SELFTEST-META-1 controls
// for scripts/check-obligation-page.mjs (row OBLIGATION-PAGE-1).
//
// Proves gate O6 CAN go red: every planted defect below must surface as a
// specific finding, and the matching green fixture must pass clean. Two legs
// never depend on twin freshness, which is main-side single-writer state:
//   - the hermetic CLI leg runs the gate against a temp fixture tree with
//     --root, where the fail-closed local context makes every finding blocking;
//   - the round-trip leg re-parses the REAL generator's rendered block against
//     the REAL coverage files, so renderer and gate can never silently diverge.
// The real-tree CLI leg tolerates exactly one red class — twin staleness —
// because between a coverage-affecting merge and main's derived-artifacts regen
// the committed twin is stale by construction (SO #35); any other red there is
// a real defect and fails the selftest.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseNotCovered, checkO6, disposition, expectedNotCovered } from './check-obligation-page.mjs';
import { renderObligationBlock } from './gen-page-md-twins.mjs';
import { readdirSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const failures = [];
const ok = (m) => console.log('  PASS ' + m);
const fail = (m) => { failures.push(m); console.log('  FAIL ' + m); };

function expectRed(name, problems, needle) {
  const hit = problems.find((p) => p.includes(needle));
  if (hit) ok(`${name}: red as expected (${hit.slice(0, 90)})`);
  else fail(`${name}: expected a problem containing "${needle}", got [${problems.join(' | ').slice(0, 220)}]`);
}
function expectGreen(name, problems) {
  if (problems.length === 0) ok(`${name}: green as expected`);
  else fail(`${name}: expected no problems, got [${problems.join(' | ').slice(0, 220)}]`);
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const cov = {
  node_id: 'art-0000-synthetic',
  clause_digests: ['sha256:' + 'a'.repeat(64)],
  covers: { O2: { accept: ['vec_hit'], refuse: ['vec_quiet'] } },
  out_of_scope: [
    { id: 'O1', reason: 'the synthetic node does not implement the dwelling condition' },
    { id: 'O3', reason: 'the synthetic node does not implement the cross-reference' },
  ],
  uncovered: [],
};
const twinMd = '# Synthetic node\n\nSome prose.\n\n' + renderObligationBlock({
  covered: [{ id: 'O2', label: 'the synthetic trigger test' }],
  notCovered: cov.out_of_scope,
}) + '\n';

// ── parseNotCovered ──────────────────────────────────────────────────────────
console.log('parseNotCovered:');
{
  if (parseNotCovered(twinMd) === null) fail('block-bearing twin parsed as null');
  else ok('block-bearing twin parses');
  const got = parseNotCovered(twinMd);
  if (JSON.stringify(got.items) === JSON.stringify(expectedNotCovered(cov))) ok('items equal the coverage out_of_scope list');
  else fail(`items drifted: ${JSON.stringify(got.items).slice(0, 200)}`);
  if (parseNotCovered('# No block here\n\nplain\n') === null) ok('twin without the section parses as null');
  else fail('twin without the section should be null');
  const stopAtNext = parseNotCovered('## Not covered\n\n- O1: first reason\n\n## Covered\n\n- O9: not an item\n');
  if (stopAtNext && stopAtNext.items.length === 1 && stopAtNext.items[0].id === 'O1') ok('section ends at the next ## heading');
  else fail('section did not end at the next ## heading');
  const withDup = parseNotCovered('## Not covered\n\n- O1: first copy\n- O1: second copy\n');
  if (withDup && withDup.dups.includes('O1') && withDup.items.length === 2) ok('duplicate block id recorded');
  else fail('duplicate block id not recorded');
  const proseIgnored = parseNotCovered('## Not covered\n\nIntro line the renderer emits.\n\n- O2: the reason\n');
  if (proseIgnored && proseIgnored.items.length === 1 && proseIgnored.items[0].id === 'O2') ok('non-list prose under the heading ignored');
  else fail('prose under the heading misparsed');
}

// ── checkO6 red then green ───────────────────────────────────────────────────
console.log('checkO6 page agreement (red controls, then green):');
{
  const clone = (o) => JSON.parse(JSON.stringify(o));
  expectGreen('fresh twin matches coverage', checkO6(cov, twinMd));
  expectGreen('empty out_of_scope and no block is green', checkO6({ ...clone(cov), out_of_scope: [] }, '# twin with no block\n'));
  expectRed('twin missing on disk', checkO6(cov, null), 'STALE: twin missing on disk');
  expectRed('no block but coverage lists obligations', checkO6(cov, '# twin with no block\n'), 'twin has no Not covered block');
  const minusOne = clone(twinMd).replace(/- O3: .*\n/, '');
  expectRed('block missing an item', checkO6(cov, minusOne), 'twin is missing O3');
  const withExtra = twinMd.replace(/- O1: .*\n/, '- O1: the synthetic node does not implement the dwelling condition\n- O9: an obligation the list never had\n');
  expectRed('block has an extra item', checkO6(cov, withExtra), 'twin has extra O9');
  const drifted = twinMd.replace('the synthetic node does not implement the cross-reference', 'a rewritten reason the file never said');
  expectRed('reason drift', checkO6(cov, drifted), 'reason drift on O3');
  const reordered = clone(cov);
  reordered.out_of_scope = [reordered.out_of_scope[1], reordered.out_of_scope[0]];
  expectRed('order differs from the coverage file', checkO6(reordered, twinMd), 'different order');
  const dupOos = clone(cov);
  dupOos.out_of_scope = dupOos.out_of_scope.concat([{ id: 'O1', reason: 'the synthetic node does not implement the dwelling condition' }]);
  expectRed('duplicate id in coverage', checkO6(dupOos, twinMd), 'HARD: coverage out_of_scope lists O1 more than once');
  const dupBlock = parseNotCovered('## Not covered\n\n- O1: first copy\n- O1: second copy\n');
  const dupProblems = checkO6({ ...clone(cov), out_of_scope: [{ id: 'O1', reason: 'first copy' }, { id: 'O1', reason: 'second copy' }] }, '## Not covered\n\n- O1: first copy\n- O1: second copy\n');
  if (dupProblems.some((p) => p.startsWith('HARD:')) && dupBlock) ok('duplicate ids red on both sides of the equality');
  else fail('duplicate ids did not red on both sides');
  // the humanize-visible em-dash: the file must carry page-safe prose
  const emdash = clone(cov);
  emdash.out_of_scope = [{ id: 'O1', reason: 'not modeled — by design' }];
  expectRed('em-dash reason fails the equality (page-safe prose required)', checkO6(emdash, twinMd.replace('the synthetic node does not implement the dwelling condition', 'not modeled - by design')), 'reason drift on O1');
}

// ── disposition ──────────────────────────────────────────────────────────────
console.log('disposition (the PR-context split):');
{
  const problems = ['HARD: coverage file x.json has no node_id', 'STALE: twin missing on disk but coverage lists 1 out-of-scope obligation(s) (O1)'];
  const [mainBlocking, mainAdvisory] = disposition(problems, true);
  if (mainBlocking.length === 2 && mainAdvisory.length === 0) ok('main context: everything blocks');
  else fail('main context split wrong');
  const [prBlocking, prAdvisory] = disposition(problems, false);
  if (prBlocking.length === 1 && prBlocking[0].startsWith('HARD:') && prAdvisory.length === 1 && prAdvisory[0].startsWith('STALE:')) ok('PR context: STALE advisory, HARD blocking');
  else fail('PR context split wrong');
}

// ── hermetic CLI leg (temp tree, --root, fail-closed context) ────────────────
console.log('hermetic CLI leg (fixture tree):');
{
  const tmp = mkdtempSync(join(tmpdir(), 'obligation-page-selftest-'));
  const cgDir = join(tmp, 'chaingraph');
  const covDir = join(cgDir, 'obligations', 'coverage');
  mkdirSync(covDir, { recursive: true });
  writeFileSync(join(cgDir, 'chaingraph.json'), JSON.stringify({
    nodes: [{ tool_id: 'art-0000-synthetic', status: 'live', url: 'https://ainumbers.co/chaingraph/art-0000-synthetic.html' }],
    chains: [],
  }));
  writeFileSync(join(cgDir, 'art-0000-synthetic.md'), twinMd);
  writeFileSync(join(covDir, 'art-0000-synthetic.json'), JSON.stringify(cov));
  const runGate = (root) => spawnSync('node', [join(HERE, 'check-obligation-page.mjs'), ...(root ? ['--root', root] : [])], { encoding: 'utf8' });

  let r = runGate(tmp);
  if (r.status === 0 && /O6 OK: 1 coverage file/.test(r.stdout)) ok('fresh fixture tree green via the CLI');
  else fail(`fresh fixture tree should be green, status ${r.status}: ${(r.stdout + r.stderr).slice(0, 220)}`);

  writeFileSync(join(cgDir, 'art-0000-synthetic.md'), twinMd.replace(/- O3: .*\n/, ''));
  r = runGate(tmp);
  if (r.status === 1 && /STALE: twin Not covered block != coverage out_of_scope/.test(r.stdout + r.stderr) && /twin is missing O3/.test(r.stdout + r.stderr)) ok('tampered twin reds via the CLI (fail-closed context blocks STALE)');
  else fail(`tampered twin should exit 1, status ${r.status}: ${(r.stdout + r.stderr).slice(0, 220)}`);

  writeFileSync(join(cgDir, 'art-0000-synthetic.md'), twinMd);
  writeFileSync(join(covDir, 'art-0001-ghost.json'), JSON.stringify({ ...JSON.parse(JSON.stringify(cov)), node_id: 'art-0001-ghost' }));
  r = runGate(tmp);
  if (r.status === 1 && /not a live twin-scope node/.test(r.stdout + r.stderr)) ok('coverage naming an unknown node reds HARD via the CLI');
  else fail(`ghost node should exit 1, status ${r.status}: ${(r.stdout + r.stderr).slice(0, 220)}`);

  writeFileSync(join(covDir, 'art-0002-broken.json'), '{ not json');
  r = runGate(tmp);
  if (r.status === 1 && /does not parse/.test(r.stdout + r.stderr)) ok('unparseable coverage file reds HARD via the CLI');
  else fail(`broken coverage should exit 1, status ${r.status}: ${(r.stdout + r.stderr).slice(0, 220)}`);

  // coverage with an empty out_of_scope and a block-less twin is green
  rmSync(join(covDir, 'art-0001-ghost.json'));
  rmSync(join(covDir, 'art-0002-broken.json'));
  writeFileSync(join(covDir, 'art-0003-quiet.json'), JSON.stringify({ ...JSON.parse(JSON.stringify(cov)), node_id: 'art-0003-quiet', out_of_scope: [] }));
  writeFileSync(join(cgDir, 'chaingraph.json'), JSON.stringify({
    nodes: [
      { tool_id: 'art-0000-synthetic', status: 'live', url: 'https://ainumbers.co/chaingraph/art-0000-synthetic.html' },
      { tool_id: 'art-0003-quiet', status: 'live', url: 'https://ainumbers.co/chaingraph/art-0003-quiet.html' },
    ],
    chains: [],
  }));
  r = runGate(tmp);
  if (r.status === 0 && /2 coverage file/.test(r.stdout)) ok('empty out_of_scope with a block-less twin is green');
  else fail(`quiet node should be green, status ${r.status}: ${(r.stdout + r.stderr).slice(0, 220)}`);

  rmSync(tmp, { recursive: true, force: true });
}

// ── renderer/parser round-trip on the REAL tree (context-free) ───────────────
console.log('round-trip leg (real generator output vs real coverage files):');
{
  const { collectTwinTargets } = await import('./gen-page-md-twins.mjs');
  const REPO = resolve(HERE, '..');
  const covDir = join(REPO, 'chaingraph', 'obligations', 'coverage');
  let files = [];
  try { files = readdirSync(covDir).filter((f) => f.endsWith('.json')).sort(); } catch { /* none */ }
  if (!files.length) fail('real tree has no coverage files to round-trip');
  const targets = collectTwinTargets(REPO);
  const byTool = new Map(targets.filter((t) => t.kind === 'node').map((t) => [t.toolId, t]));
  for (const f of files) {
    const covReal = JSON.parse(readFileSync(join(covDir, f), 'utf8'));
    const t = byTool.get(covReal.node_id);
    if (!t) { fail(`coverage ${f} names ${covReal.node_id}, which the twin collector does not target`); continue; }
    if (!t.obligations) { fail(`coverage ${f} exists but the collector rendered no block for ${covReal.node_id}`); continue; }
    const rendered = renderObligationBlock(t.obligations);
    const parsed = parseNotCovered(rendered);
    const expected = expectedNotCovered(covReal);
    if (!parsed) {
      if (expected.length === 0) ok(`${covReal.node_id}: empty out_of_scope renders section-less, matching coverage`);
      else fail(`rendered block for ${covReal.node_id} has no Not covered section to parse`);
      continue;
    }
    if (JSON.stringify(parsed.items) === JSON.stringify(expected)) ok(`${covReal.node_id}: rendered Not covered list round-trips to the coverage file`);
    else fail(`${covReal.node_id}: rendered Not covered list != coverage file: ${JSON.stringify(parsed.items).slice(0, 200)}`);
    if (parsed.dups.length === 0) ok(`${covReal.node_id}: no duplicate block ids in the render`);
    else fail(`${covReal.node_id}: duplicate block ids ${parsed.dups.join(', ')}`);
  }
}

// ── real-tree CLI leg (tolerates only the by-construction staleness red) ─────
console.log('real-tree CLI leg (staleness reds tolerated, anything else fails):');
{
  const r = spawnSync('node', [join(HERE, 'check-obligation-page.mjs')], { encoding: 'utf8', cwd: join(HERE, '..') });
  const out = r.stdout + r.stderr;
  if (!/O6 OK:/.test(out)) fail(`real-tree run printed no O6 summary line: ${out.slice(0, 220)}`);
  else ok('real-tree run printed its summary line');
  if (r.status === 0) ok('real-tree gate green (fresh or advisory-on-PR)');
  else {
    const redLines = r.stderr.split('\n').filter((l) => /^  /.test(l));
    const allStale = redLines.length > 0 && redLines.every((l) => l.includes('STALE:'));
    if (r.status === 1 && allStale) ok(`real-tree gate red but only on twin staleness (by-construction between merge and main's regen): ${redLines.length} line(s)`);
    else fail(`real-tree gate exited ${r.status} with a non-staleness red: ${out.slice(0, 300)}`);
  }
}

console.log(failures.length ? `SELFTEST RED: ${failures.length} failure(s)` : 'SELFTEST GREEN: all controls passed');
process.exit(failures.length ? 1 : 0);
