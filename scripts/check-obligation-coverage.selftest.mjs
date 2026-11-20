// scripts/check-obligation-coverage.selftest.mjs — GATE-SELFTEST-META-1 controls
// for scripts/check-obligation-coverage.mjs (row OBLIGATION-SCHEMA-1-RESUME-1).
//
// Proves the checker CAN go red: every planted defect below must surface as a
// specific error, and the matching green fixture must pass clean. The last leg
// runs the real gate CLI against the real repo tree, which must be green (the
// O4 baseline carries every cited-but-unlisted digest).
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkO1, checkO2, checkO3, o3Gaps, checkO4, expectedVerdictClass } from './check-obligation-coverage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const failures = [];
const ok = (m) => console.log('  PASS ' + m);
const fail = (m) => { failures.push(m); console.log('  FAIL ' + m); };

// asserts the gate reports at least one error matching `needle` for this defect
function expectRed(name, errors, needle) {
  const hit = errors.find((e) => e.includes(needle));
  if (hit) ok(`${name}: red as expected (${hit.slice(0, 90)})`);
  else fail(`${name}: expected an error containing "${needle}", got [${errors.join(' | ').slice(0, 200)}]`);
}
function expectGreen(name, errors) {
  if (errors.length === 0) ok(`${name}: green as expected`);
  else fail(`${name}: expected no errors, got [${errors.join(' | ').slice(0, 200)}]`);
}

// ── shared verdict reader ────────────────────────────────────────────────────
console.log('expectedVerdictClass (shared verdict reader):');
{
  const pos = { output_payload: { is_high_cost: true }, compliance_flags: ['X'] };
  const neg = { output_payload: { is_high_cost: false }, compliance_flags: [] };
  const ref = { output_payload: { hash_refusal: true } };
  if (expectedVerdictClass(pos) === 'positive') ok('flag-backed positive reads positive'); else fail('flag-backed positive misread');
  if (expectedVerdictClass(neg) === 'negative') ok('flagless quiet vector reads negative'); else fail('flagless quiet vector misread');
  if (expectedVerdictClass(ref) === 'refusal') ok('hash_refusal payload reads refusal'); else fail('hash_refusal payload misread');
  if (expectedVerdictClass(neg, 'is_high_cost') === 'negative') ok('explicit signal falsy reads negative'); else fail('explicit falsy signal misread');
  if (expectedVerdictClass(pos, 'is_high_cost') === 'positive') ok('explicit signal truthy reads positive'); else fail('explicit truthy signal misread');
  if (expectedVerdictClass(pos, 'no.such.path') === null) ok('missing signal path reads null (caller reds it)'); else fail('missing signal path misread');
  // signal wins over flags: flags present but the obligation-scoped signal quiet
  if (expectedVerdictClass(pos, 'is_high_cost') === 'positive' && expectedVerdictClass({ output_payload: { is_high_cost: true }, compliance_flags: [] }, 'is_high_cost') === 'positive') ok('signal classifies per-obligation, not per-node'); else fail('signal classification broken');
}

// ── O1 red then green ────────────────────────────────────────────────────────
console.log('O1 list well-formedness (red controls, then green):');
const goodList = {
  clause_digest: 'sha256:' + 'a'.repeat(64),
  excerpt_bytes: 1000,
  split_by: 'model-a', split_at: '2026-11-15',
  reviewed_by: 'model-b', reviewed_at: '2026-11-15',
  obligations: [
    { id: 'O1', label: 'first testable obligation', span: { start: 0, end: 400 }, kind: 'condition' },
    { id: 'O2', label: 'second testable obligation', span: { start: 400, end: 900 }, kind: 'threshold' },
    { id: 'O3', label: 'a cross-reference obligation', span: { start: 900, end: 999 }, kind: 'definition' },
  ],
};
{
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const outOfRange = clone(goodList); outOfRange.obligations[1].span.end = 2000;
  expectRed('span out of range', checkO1(outOfRange), 'exceeds excerpt_bytes');
  const overlap = clone(goodList); overlap.obligations[1].span.start = 200;
  expectRed('overlapping spans', checkO1(overlap), 'span overlap');
  const dup = clone(goodList); dup.obligations[2].id = 'O2';
  expectRed('duplicate ids', checkO1(dup), 'duplicate obligation id');
  const selfReview = clone(goodList); selfReview.reviewed_by = selfReview.split_by;
  expectRed('reviewer equals splitter', checkO1(selfReview), 'must differ from split_by');
  const badKind = clone(goodList); badKind.obligations[0].kind = 'vibe';
  expectRed('unknown kind', checkO1(badKind), 'not in');
  const badDigest = clone(goodList); badDigest.clause_digest = 'sha256:xyz';
  expectRed('malformed digest', checkO1(badDigest), 'sha256:<64 hex>');
  const tooFew = clone(goodList); tooFew.obligations = tooFew.obligations.slice(0, 2);
  expectRed('fewer than 3 obligations', checkO1(tooFew), '3..25');
  expectGreen('well-formed list', checkO1(goodList));
}

// ── O2 red then green ────────────────────────────────────────────────────────
console.log('O2 coverage is real (red controls, then green):');
const goodFixtures = {
  tool_id: 'art-0000-synthetic',
  vectors: [
    { name: 'vec_hit', description: 'hits', policy_parameters: {}, output_payload: { fired: true, note: 'x' }, compliance_flags: ['F'] },
    { name: 'vec_quiet', description: 'quiet', policy_parameters: {}, output_payload: { fired: false, note: 'x' }, compliance_flags: [] },
    { name: 'vec_refuse', description: 'refuses', policy_parameters: {}, output_payload: { hash_refusal: true }, compliance_flags: [] },
  ],
};
const goodCoverage = {
  node_id: 'art-0000-synthetic',
  clause_digests: ['sha256:' + 'a'.repeat(64)],
  covers: {
    O2: { accept: ['vec_hit'], refuse: ['vec_quiet'], signal: 'fired' },
    O1: { accept: ['vec_hit'], refuse: ['vec_refuse'] },
  },
  out_of_scope: [{ id: 'O3', reason: 'the synthetic node does not implement this cross-reference' }],
  uncovered: [],
};
const lists = new Map([['sha256:' + 'a'.repeat(64), goodList.obligations]]);
{
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ghost = clone(goodCoverage); ghost.covers.O2.accept = ['no_such_vector'];
  expectRed('named vector missing from fixtures', checkO2(ghost, goodFixtures, lists), 'does not exist in the node\'s fixtures');
  const wrongSide = clone(goodCoverage); wrongSide.covers.O2.refuse = ['vec_hit'];
  expectRed('accept-class vector listed on refuse side', checkO2(wrongSide, goodFixtures, lists), 'does not match the refuse side');
  const wrongSide2 = clone(goodCoverage); wrongSide2.covers.O2.accept = ['vec_quiet'];
  expectRed('negative-class vector listed on accept side', checkO2(wrongSide2, goodFixtures, lists), 'does not match the accept side');
  const badSignal = clone(goodCoverage); badSignal.covers.O2.signal = 'not.a.path';
  expectRed('signal path does not resolve', checkO2(badSignal, goodFixtures, lists), 'does not resolve in vector');
  const ghostId = clone(goodCoverage); ghostId.covers.O99 = { accept: ['vec_hit'], refuse: ['vec_quiet'] };
  expectRed('unknown obligation id', checkO2(ghostId, goodFixtures, lists), 'not in any cited digest');
  const double = clone(goodCoverage); double.uncovered = [{ id: 'O2', reason: 'internally inconsistent duplicate status' }];
  expectRed('id both covered and uncovered', checkO2(double, goodFixtures, lists), 'also in covers');
  const dupVec = clone(goodFixtures); dupVec.vectors.push(clone(goodFixtures.vectors[0]));
  expectRed('duplicate fixture vector name', checkO2(clone(goodCoverage), dupVec, lists), 'duplicate vector name');
  expectGreen('consistent coverage', checkO2(goodCoverage, goodFixtures, lists));
}

// ── O4 red then green (synthetic tree) ───────────────────────────────────────
console.log('O4 stale lists (red controls, then green, synthetic tree):');
const tmp = mkdtempSync(join(tmpdir(), 'obligation-selftest-'));
const nodesDir = join(tmp, 'nodes'); const obligationsDir = join(tmp, 'obligations');
const coverageDir = join(obligationsDir, 'coverage'); const baselinePath = join(obligationsDir, 'o4-baseline.json');
mkdirSync(nodesDir, { recursive: true }); mkdirSync(coverageDir, { recursive: true });
const DIG_A = 'sha256:' + 'a'.repeat(64);
const DIG_B = 'sha256:' + 'b'.repeat(64);
const DIG_C = 'sha256:' + 'c'.repeat(64);
writeFileSync(join(nodesDir, 'art-0000-synthetic.json'), JSON.stringify({ tool_id: 'art-0000-synthetic', cited_clause_digest: [{ digest: DIG_A }] }));
writeFileSync(join(nodesDir, 'art-0001-also.json'), JSON.stringify({ tool_id: 'art-0001-also', cited_clause_digest: [{ digest: DIG_B }] }));
writeFileSync(join(nodesDir, 'art-0002-clean.json'), JSON.stringify({ tool_id: 'art-0002-clean', status: 'live' }));
writeFileSync(join(obligationsDir, 'a'.repeat(64) + '.json'), JSON.stringify(goodList));
writeFileSync(join(coverageDir, 'art-0000-synthetic.json'), JSON.stringify(goodCoverage));
{
  const clone = (o) => JSON.parse(JSON.stringify(o));
  // green baseline: DIG_A listed, DIG_B baselined
  const greenBase = { [DIG_B]: 'pending obligation backfill (OBLIGATION-BACKFILL-n)' };
  writeFileSync(baselinePath, JSON.stringify(greenBase, null, 2));
  expectGreen('cited digests listed or baselined', checkO4({ nodesDir, obligationsDir, coverageDir, baselinePath }));

  const noBase = {};
  writeFileSync(baselinePath, JSON.stringify(noBase));
  expectRed('citing digest with no list and no baseline entry', checkO4({ nodesDir, obligationsDir, coverageDir, baselinePath }), 'no obligation list and no o4-baseline entry');

  const staleListed = { [DIG_B]: 'pending obligation backfill (OBLIGATION-BACKFILL-n)', [DIG_A]: 'pending obligation backfill (OBLIGATION-BACKFILL-n)' };
  writeFileSync(baselinePath, JSON.stringify(staleListed));
  expectRed('baseline entry whose digest now has a list', checkO4({ nodesDir, obligationsDir, coverageDir, baselinePath }), 'an obligation list now exists');

  const staleCited = { [DIG_B]: 'pending obligation backfill (OBLIGATION-BACKFILL-n)', [DIG_C]: 'pending obligation backfill (OBLIGATION-BACKFILL-n)' };
  writeFileSync(baselinePath, JSON.stringify(staleCited));
  expectRed('baseline entry no node cites', checkO4({ nodesDir, obligationsDir, coverageDir, baselinePath }), 'no node cites this digest');

  const staleCov = clone(goodCoverage); staleCov.clause_digests = [DIG_B, DIG_C];
  writeFileSync(join(coverageDir, 'art-0000-synthetic.json'), JSON.stringify(staleCov));
  writeFileSync(baselinePath, JSON.stringify(greenBase));
  expectRed('coverage names a digest the node no longer cites', checkO4({ nodesDir, obligationsDir, coverageDir, baselinePath }), 'no longer cites');

  // restore the green state
  writeFileSync(join(coverageDir, 'art-0000-synthetic.json'), JSON.stringify(goodCoverage));
  expectGreen('synthetic tree green again after restore', checkO4({ nodesDir, obligationsDir, coverageDir, baselinePath }));
  rmSync(tmp, { recursive: true, force: true });
}

// ── O4 re-pin flow (row OBLIGATION-REPIN-1): the old list prints beside the new digest ──
console.log('O4 re-pin flow (old list printed beside the new digest, red then green):');
{
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const tmp2 = mkdtempSync(join(tmpdir(), 'obligation-repin-'));
  const nodes2 = join(tmp2, 'nodes'); const obligations2 = join(tmp2, 'obligations');
  const coverage2 = join(obligations2, 'coverage'); const baseline2 = join(obligations2, 'o4-baseline.json');
  mkdirSync(nodes2, { recursive: true }); mkdirSync(coverage2, { recursive: true });
  const O4 = () => checkO4({ nodesDir: nodes2, obligationsDir: obligations2, coverageDir: coverage2, baselinePath: baseline2 });
  // the fresh split a re-pin eventually owes the new digest
  const digBList = {
    clause_digest: DIG_B, excerpt_bytes: 1200,
    split_by: 'model-c', split_at: '2026-11-17',
    reviewed_by: 'model-d', reviewed_at: '2026-11-17',
    obligations: [
      { id: 'O1', label: 'fresh split first obligation', span: { start: 0, end: 600 }, kind: 'condition' },
      { id: 'O2', label: 'fresh split second obligation', span: { start: 600, end: 1100 }, kind: 'threshold' },
      { id: 'O3', label: 'fresh split third obligation', span: { start: 1100, end: 1199 }, kind: 'definition' },
    ],
  };
  // plant the re-pin: the shard now cites DIG_B (unlisted, unbaselined) while
  // its coverage file still names DIG_A, whose list is on disk
  writeFileSync(join(nodes2, 'art-0000-synthetic.json'), JSON.stringify({ tool_id: 'art-0000-synthetic', cited_clause_digest: [{ digest: DIG_B }] }));
  writeFileSync(join(obligations2, 'a'.repeat(64) + '.json'), JSON.stringify(goodList));
  const repinCov = clone(goodCoverage);
  writeFileSync(join(coverage2, 'art-0000-synthetic.json'), JSON.stringify(repinCov));
  writeFileSync(baseline2, JSON.stringify({}));
  {
    const errs = O4();
    expectRed('re-pinned digest has no list', errs, 'no obligation list and no o4-baseline entry');
    expectRed('coverage still names the old digest', errs, 'no longer cites');
    const header = errs.find((e) => e.startsWith('re-pin art-0000-synthetic: old list aaaaaaaa') && e.includes('beside new digest bbbbbbbb'));
    if (header) ok('old list header printed beside the new digest (' + header.slice(0, 90) + ')');
    else fail('no old-list-beside-new-digest header: ' + errs.join(' | ').slice(0, 200));
    if (errs.some((e) => e.includes('[0,400) condition: first testable obligation'))) ok('old list obligations printed with spans and labels');
    else fail('no old-list obligation lines in the re-pin output');
    if (errs.some((e) => e.includes('does not carry over') && e.includes('propose-obligation-split.mjs'))) ok('re-pin red requires the fresh split');
    else fail('no fresh-split requirement line in the re-pin output');
    const headers = errs.filter((e) => e.includes('beside new digest bbbbbbbb')).length;
    if (headers === 1) ok('the same re-pin prints its old list exactly once (unlisted red and stale-coverage red deduped)');
    else fail(`expected exactly 1 beside-header, got ${headers}`);
  }
  // cure the re-pin: a fresh split for DIG_B, the baseline stays empty, the
  // coverage file names the digest the node cites now
  writeFileSync(join(obligations2, 'b'.repeat(64) + '.json'), JSON.stringify(digBList));
  const curedCov = clone(goodCoverage); curedCov.clause_digests = [DIG_B];
  writeFileSync(join(coverage2, 'art-0000-synthetic.json'), JSON.stringify(curedCov));
  expectGreen('fresh split plus updated coverage greens the re-pin', O4());
  // part 3 alone: DIG_B baselined (so the unlisted red is quiet) but the
  // coverage file still names DIG_A; the beside-block must still print
  rmSync(join(obligations2, 'b'.repeat(64) + '.json'));
  writeFileSync(baseline2, JSON.stringify({ [DIG_B]: 'pending obligation backfill (OBLIGATION-BACKFILL-n)' }));
  writeFileSync(join(coverage2, 'art-0000-synthetic.json'), JSON.stringify(repinCov));
  {
    const errs = O4();
    expectRed('baselined re-pin still flags stale coverage', errs, 'no longer cites');
    const headers = errs.filter((e) => e.includes('beside new digest bbbbbbbb')).length;
    if (headers === 1) ok('stale-coverage red alone still prints the old list beside the new digest');
    else fail(`expected exactly 1 beside-header on the stale-coverage-only path, got ${headers}`);
    if (!errs.some((e) => e.includes('no obligation list and no o4-baseline entry'))) ok('baselined new digest keeps the unlisted red quiet');
    else fail('unlisted red fired despite the baseline entry');
  }
  rmSync(tmp2, { recursive: true, force: true });
}

// ── O3 nothing uncovered (row OBLIGATION-NEWNODE-1) ──────────────────────────
console.log('O3 nothing uncovered (red controls, then green, both modes):');
{
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const dA = 'sha256:' + 'a'.repeat(64);
  const o3List = [
    { id: 'O1', label: 'a plain condition obligation', span: { start: 0, end: 10 }, kind: 'condition' },
    { id: 'O2', label: 'a threshold obligation here', span: { start: 10, end: 20 }, kind: 'threshold' },
    { id: 'O3', label: 'a definition obligation here', span: { start: 20, end: 30 }, kind: 'definition' },
  ];
  const lists3 = new Map([[dA, o3List]]);
  const fx3 = { vectors: ['hit', 'quiet', 'below_edge', 'at_edge'].map((name) => ({ name })) };
  const full = {
    node_id: 'n', clause_digests: [dA],
    covers: {
      O1: { accept: ['hit'], refuse: ['quiet'] },
      O2: { accept: ['hit'], refuse: ['quiet'], boundary: { below: ['below_edge'], at_or_above: ['at_edge'] } },
    },
    out_of_scope: [], uncovered: [],
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (same(o3Gaps(full, lists3, fx3), [])) ok('fully covered node has no gap (definition needs no vector)'); else fail('full coverage reported a gap: ' + o3Gaps(full, lists3, fx3));
  const unacc = clone(full); delete unacc.covers.O1;
  if (same(o3Gaps(unacc, lists3, fx3), ['O1:unaccounted'])) ok('obligation in no list is red-controlled as unaccounted'); else fail('unaccounted gap missed');
  const oosFix = clone(unacc); oosFix.out_of_scope = [{ id: 'O1', reason: 'declared out of scope with a reason' }];
  if (same(o3Gaps(oosFix, lists3, fx3), [])) ok('out of scope with a reason clears the gap'); else fail('out_of_scope did not clear the gap');
  const uncd = clone(unacc); uncd.uncovered = [{ id: 'O1', reason: 'declared uncovered, a recorded defect' }];
  if (same(o3Gaps(uncd, lists3, fx3), ['O1:uncovered'])) ok('declared uncovered is a gap'); else fail('uncovered gap missed');
  const oneSided = clone(full); oneSided.covers.O1.refuse = [];
  if (same(o3Gaps(oneSided, lists3, fx3), ['O1:one-sided'])) ok('missing refuse vector is a one-sided gap'); else fail('one-sided gap missed');
  const noBound = clone(full); delete noBound.covers.O2.boundary;
  if (same(o3Gaps(noBound, lists3, fx3), ['O2:boundary'])) ok('threshold with no boundary vectors is a boundary gap'); else fail('boundary gap missed');
  const oneSide = clone(full); oneSide.covers.O2.boundary = { below: ['below_edge'] };
  if (same(o3Gaps(oneSide, lists3, fx3), ['O2:boundary'])) ok('boundary vector on one side only is a gap'); else fail('one-sided boundary missed');
  const ghostB = clone(full); ghostB.covers.O2.boundary.below = ['no_such_vector'];
  if (same(o3Gaps(ghostB, lists3, fx3), ['O2:boundary'])) ok('boundary vector absent from fixtures is a gap'); else fail('ghost boundary vector missed');

  // existing-node mode: advisory with a baseline that only shrinks
  const gm = (nid, gaps) => new Map([[nid, gaps]]);
  const none = new Set();
  expectGreen('existing node, gap inside the baseline', checkO3({ gapsByNode: gm('n', ['O1:uncovered']), baseline: { n: ['O1:uncovered'] }, newNodes: none, blockNew: false }).errors);
  expectRed('existing node, gap outside the baseline', checkO3({ gapsByNode: gm('n', ['O1:uncovered', 'O2:boundary']), baseline: { n: ['O1:uncovered'] }, newNodes: none, blockNew: false }).errors, 'not in o3-baseline.json');
  expectRed('existing node, closed gap still baselined', checkO3({ gapsByNode: gm('n', []), baseline: { n: ['O1:uncovered'] }, newNodes: none, blockNew: false }).errors, 'stale o3-baseline entry');
  expectRed('baseline names a node with no coverage file', checkO3({ gapsByNode: new Map(), baseline: { gone: ['O1:uncovered'] }, newNodes: none, blockNew: false }).errors, 'stale o3-baseline node');
  // new-node mode: off is advisory, on is blocking
  const newSet = new Set(['n']);
  const off = checkO3({ gapsByNode: gm('n', ['O1:unaccounted']), baseline: {}, newNodes: newSet, blockNew: false });
  expectGreen('new node with a gap, blocking off', off.errors);
  if (off.advisories.some((a) => a.includes('advisory, block_new_nodes is off'))) ok('blocking off prints the gap as advisory'); else fail('no advisory line with blocking off');
  expectRed('new node with a gap, blocking on', checkO3({ gapsByNode: gm('n', ['O1:unaccounted']), baseline: {}, newNodes: newSet, blockNew: true }).errors, 'block_new_nodes is on');
  expectRed('new node citing a digest with no coverage file, blocking on', checkO3({ gapsByNode: gm('n', ['no-coverage-file']), baseline: {}, newNodes: newSet, blockNew: true }).errors, 'no-coverage-file');
  expectGreen('new node with no gap, blocking on', checkO3({ gapsByNode: gm('n', []), baseline: {}, newNodes: newSet, blockNew: true }).errors);
  const set = JSON.parse(readFileSync(join(HERE, '..', 'chaingraph', 'obligations', 'o3-settings.json'), 'utf8'));
  if (set.block_new_nodes === false) ok('shipped o3-settings.json has block_new_nodes off'); else fail('block_new_nodes is not off in the shipped setting');
}

// ── schema drift guard ───────────────────────────────────────────────────────
console.log('schema drift guard (JSON Schema files match the validators):');
{
  const listSchema = JSON.parse(readFileSync(join(HERE, '..', 'chaingraph', 'obligations', 'obligation-list.schema.json'), 'utf8'));
  const covSchema = JSON.parse(readFileSync(join(HERE, '..', 'chaingraph', 'obligations', 'coverage.schema.json'), 'utf8'));
  const listReq = JSON.stringify(listSchema.required);
  const covReq = JSON.stringify(covSchema.required);
  if (listReq === JSON.stringify(['clause_digest', 'excerpt_bytes', 'split_by', 'split_at', 'reviewed_by', 'reviewed_at', 'obligations'])) ok('obligation-list.schema.json required[] matches checkO1');
  else fail(`obligation-list.schema.json required[] drifted: ${listReq}`);
  if (covReq === JSON.stringify(['node_id', 'clause_digests', 'covers', 'out_of_scope', 'uncovered'])) ok('coverage.schema.json required[] matches checkO2');
  else fail(`coverage.schema.json required[] drifted: ${covReq}`);
}

// ── real-data leg: the actual repo tree must be green ────────────────────────
console.log('real-data leg (repo tree, must be green):');
{
  const out = execFileSync('node', [join(HERE, 'check-obligation-coverage.mjs')], { encoding: 'utf8', cwd: join(HERE, '..') });
  const good = out.includes('check-obligation-coverage: GREEN');
  if (good) ok('gate CLI green on the real repo tree');
  else fail('gate CLI not green on the real repo tree: ' + out.slice(0, 300));
  const o1line = out.split('\n').find((l) => l.startsWith('O1 OK') && l.includes('obligations, split by'));
  if (o1line) ok('real list reported: ' + o1line);
  else fail('no O1 OK line for a real list: ' + out.slice(0, 300));
}

console.log(failures.length ? `SELFTEST RED: ${failures.length} failure(s)` : 'SELFTEST GREEN: all controls passed');
process.exit(failures.length ? 1 : 0);
