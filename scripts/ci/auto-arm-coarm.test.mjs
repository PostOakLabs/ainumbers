// Fixture tests for LINEAGE-COARM-1 in auto-arm.mjs (coarmIneligible,
// coarmDecision and decide() with ctx.coarm) and the pure helpers of
// coarm-gates.mjs. Run: node --test scripts/ci/auto-arm-coarm.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decide, coarmIneligible, coarmDecision, coarmKey, COARM_MAX, SPEC_PATH, SHARED_RESIDUAL, NODE_PREFIX,
} from './auto-arm.mjs';
import { parseArgs, scrubEnv, tokenVars, mergeVerdicts, GATES } from './coarm-gates.mjs';

const TIP = 'a'.repeat(40);
const H = (n) => String(n).padStart(40, '0');
const REC = (c) => `registry/kernel/${c.repeat(64)}.json`;
const green = [{ name: 'ci', bucket: 'pass' }];
// A typical waiting kernel PR: kernel, fixtures, receipt, node json, page, own record rename.
const kpr = (n, branch, o = {}) => ({
  number: n, branch, isDraft: false, labels: [], headSha: H(n), newNodePaths: [],
  files: [`chaingraph/kernels/art-${n}.kernel.mjs`, `chaingraph/kernels/fixtures/art-${n}.fixtures.json`,
    `${NODE_PREFIX}art-${n}.json`, `chaingraph/art-${n}.html`, REC(String(n % 10))],
  ...o,
});
const A = kpr(1, 'k1', { labels: ['automerge'] });
const B = kpr(2, 'k2');
const verdictFor = (set, ok = true, base = TIP) => ({ base, prs: set.map((p) => ({ number: p.number, headSha: p.headSha })), ok });
const coarmOk = (set = [A, B], o = {}) => ({ regenGreen: true, recentEject: false, verdicts: [verdictFor(set)], ...o });
const ctx = (o = {}) => ({
  allow: { prs: { k1: 'ROW-1', k2: 'ROW-2', k3: 'ROW-3' }, lineage: ['k1', 'k2', 'k3'] },
  mainTip: TIP, mergeFirstParent: TIP, openBranches: ['k1', 'k2', 'k3'],
  armedLineage: [A], otherLineageArmed: true, ...o,
});

test('coarmIneligible: a record-renaming kernel PR is eligible', () => {
  assert.equal(coarmIneligible(B), null);
});
test('coarmIneligible: every exclusion, and unknown new-node facts fail closed', () => {
  assert.equal(coarmIneligible({ files: ['tools/x.html'], newNodePaths: [] }), 'not-lineage-class');
  assert.match(coarmIneligible({ ...B, files: [...B.files, 'chaingraph/kernels/registry-lineage-records.json'] }), /^main-only-path:/);
  assert.match(coarmIneligible({ ...B, files: [...B.files, 'chaingraph/receipt-bundles/2.bundle.json'] }), /^main-only-path:/);
  assert.match(coarmIneligible({ ...B, files: [...B.files, 'registry/absence/tree.json'] }), /^registry-path-not-a-kernel-record:/);
  assert.match(coarmIneligible({ ...B, files: [...B.files, 'registry/kernel/short.json'] }), /^registry-path-not-a-kernel-record:/);
  assert.equal(coarmIneligible({ ...B, files: [...B.files, SPEC_PATH] }), `touches-shared-file:${SPEC_PATH}`);
  for (const r of SHARED_RESIDUAL) assert.equal(coarmIneligible({ ...B, files: [...B.files, r] }), `touches-shared-file:${r}`);
  assert.match(coarmIneligible({ ...B, newNodePaths: [`${NODE_PREFIX}art-999.json`] }), /^adds-node:/);
  assert.equal(coarmIneligible({ ...B, newNodePaths: undefined }), 'new-node-check-unknown');
  assert.equal(coarmIneligible({ ...B, files: [...B.files, ...Array.from({ length: 95 }, (_, i) => `tools/${i}.html`)] }), 'file-list-capped');
});
test('coarmKey binds base and each head sha, order-free', () => {
  assert.equal(coarmKey(TIP, [A, B]), coarmKey(TIP, [B, A]));
  assert.notEqual(coarmKey(TIP, [A, B]), coarmKey(TIP, [A, { ...B, headSha: H(9) }]));
  assert.notEqual(coarmKey(TIP, [A, B]), coarmKey('b'.repeat(40), [A, B]));
});

test('OFF by default: without ctx.coarm the second kernel PR waits exactly as before', () => {
  const r = decide(B, green, ctx());
  assert.equal(r.action, 'wait'); assert.match(r.reason, /baton-held-by:k1|another-lineage-pr-armed-or-queued/);
});
test('ON + every condition met: the second PR arms beside the first (lineage-coarm)', () => {
  const r = decide(B, green, ctx({ coarm: coarmOk() }));
  assert.equal(r.action, 'arm'); assert.match(r.reason, /lineage-coarm/);
});
test('ON + nothing armed: the serial baton decides as before', () => {
  assert.equal(decide(kpr(1, 'k1'), green, ctx({ armedLineage: [], otherLineageArmed: false, coarm: coarmOk() })).action, 'arm');
  assert.match(decide(B, green, ctx({ armedLineage: [], otherLineageArmed: false, coarm: coarmOk() })).reason, /baton-held-by:k1/);
});
test('ON: baton order still holds among the unarmed (k3 waits for k2)', () => {
  const C = kpr(3, 'k3');
  assert.match(decide(C, green, ctx({ coarm: coarmOk([A, C]) })).reason, /baton-held-by:k2/);
});
test('ON: main regen red or unknown holds the lane', () => {
  assert.equal(decide(B, green, ctx({ coarm: coarmOk(undefined, { regenGreen: false }) })).reason, 'coarm-hold:main-regen-not-green');
  assert.equal(decide(B, green, ctx({ coarm: coarmOk(undefined, { regenGreen: null }) })).reason, 'coarm-hold:main-regen-not-green');
});
test('ON: a recent eject (or unknown) falls back to one at a time', () => {
  assert.equal(decide(B, green, ctx({ coarm: coarmOk(undefined, { recentEject: true }) })).reason, 'coarm-hold:recent-eject');
  assert.equal(decide(B, green, ctx({ coarm: coarmOk(undefined, { recentEject: null }) })).reason, 'coarm-hold:recent-eject');
});
test(`ON: cap is ${COARM_MAX}: with two armed a third waits`, () => {
  const C = kpr(3, 'k3');
  const r = decide(C, green, ctx({ armedLineage: [A, B], coarm: coarmOk([A, B, C]) }));
  assert.equal(r.reason, `coarm-full:2/${COARM_MAX}`);
});
test('ON: candidate or armed PR ineligible, or overlapping, waits', () => {
  const spec = { ...B, files: [...B.files, SPEC_PATH] };
  assert.match(decide(spec, green, ctx({ coarm: coarmOk([A, spec]) })).reason, /^coarm-ineligible:touches-shared-file/);
  const armedNode = { ...A, newNodePaths: [`${NODE_PREFIX}art-1.json`] };
  assert.match(decide(B, green, ctx({ armedLineage: [armedNode], coarm: coarmOk([armedNode, B]) })).reason, /^coarm-armed-pr-ineligible:#1:adds-node/);
  const overlap = { ...B, files: [...B.files, 'chaingraph/art-1.html'] };
  assert.match(decide(overlap, green, ctx({ coarm: coarmOk([A, overlap]) })).reason, /^coarm-overlap-with:#1:chaingraph\/art-1.html/);
});
test('ON: verdict missing, red, stale base or stale head waits', () => {
  assert.equal(decide(B, green, ctx({ coarm: coarmOk(undefined, { verdicts: [] }) })).reason, 'coarm-no-verdict-for-set');
  assert.equal(decide(B, green, ctx({ coarm: coarmOk(undefined, { verdicts: [verdictFor([A, B], false)] }) })).reason, 'coarm-verdict-red');
  assert.equal(decide(B, green, ctx({ coarm: coarmOk(undefined, { verdicts: [verdictFor([A, B], true, 'b'.repeat(40))] }) })).reason, 'coarm-no-verdict-for-set');
  const moved = { ...B, headSha: H(77) };
  assert.equal(decide(moved, green, ctx({ coarm: coarmOk([A, B]) })).reason, 'coarm-no-verdict-for-set');
  assert.equal(decide({ ...B, headSha: undefined }, green, ctx({ coarm: coarmOk() })).reason, 'coarm-head-or-tip-unknown');
});
test('ON: the other gates still apply (checks, stale merge ref, workflow files)', () => {
  assert.equal(decide(B, [{ name: 'ci', bucket: 'fail' }], ctx({ coarm: coarmOk() })).action, 'wait');
  assert.equal(decide(B, green, ctx({ mergeFirstParent: 'c'.repeat(40), coarm: coarmOk() })).action, 'update-branch');
  assert.equal(decide({ ...B, files: [...B.files, '.github/workflows/x.yml'] }, green, ctx({ coarm: coarmOk() })).reason, 'touches-.github/workflows');
});
test('coarmDecision without facts blocks once something is armed', () => {
  assert.deepEqual(coarmDecision(B, [A], null, TIP), { block: 'another-lineage-pr-armed-or-queued' });
  assert.deepEqual(coarmDecision(B, [], null, TIP), { mode: 'serial' });
});

// ---- coarm-gates.mjs pure helpers ----
test('coarm-gates parseArgs: needs a 40-hex base and two distinct n:sha PRs', () => {
  const o = parseArgs(['--base', TIP, '--pr', `1:${H(1)}`, '--pr', `2:${H(2)}`, '--out', 'v.json', '--append']);
  assert.deepEqual(o.prs, [{ number: 1, headSha: H(1) }, { number: 2, headSha: H(2) }]);
  assert.equal(o.append, true);
  assert.throws(() => parseArgs(['--base', 'abc', '--pr', `1:${H(1)}`, '--pr', `2:${H(2)}`]));
  assert.throws(() => parseArgs(['--base', TIP, '--pr', `1:${H(1)}`]));
  assert.throws(() => parseArgs(['--base', TIP, '--pr', `1:${H(1)}`, '--pr', `1:${H(2)}`]));
  assert.throws(() => parseArgs(['--base', TIP, '--pr', '1:main', '--pr', `2:${H(2)}`]));
});
test('coarm-gates scrubEnv drops every credential-looking variable', () => {
  const env = scrubEnv({ PATH: '/bin', GH_TOKEN: 'x', GITHUB_TOKEN: 'y', ACTIONS_RUNTIME_TOKEN: 'z', SYNC_APP_PRIVATE_KEY: 'k', HOME: '/h' });
  assert.deepEqual(Object.keys(env).sort(), ['HOME', 'PATH']);
  assert.deepEqual(tokenVars({ GH_TOKEN: 'x', EMPTY_TOKEN: '', PATH: '/bin', MAX_THINKING_TOKENS: '9', X_TOKEN_FILE: '/f' }), ['GH_TOKEN', 'X_TOKEN_FILE']);
});
test('coarm-gates mergeVerdicts replaces an older verdict for the same PR set', () => {
  const v1 = { base: TIP, prs: [{ number: 2, headSha: H(2) }, { number: 1, headSha: H(1) }], ok: false };
  const v2 = { base: TIP, prs: [{ number: 1, headSha: H(1) }, { number: 2, headSha: H(2) }], ok: true };
  const v3 = { base: TIP, prs: [{ number: 1, headSha: H(1) }, { number: 3, headSha: H(3) }], ok: true };
  assert.deepEqual(mergeVerdicts([v1, v3], v2), [v3, v2]);
  assert.deepEqual(mergeVerdicts(null, v2), [v2]);
});
test('coarm-gates runs the four cross-PR gates that caught the measured ejects', () => {
  assert.deepEqual(GATES.map(([n]) => n), ['registry-kernel-resolve', 'dead-link', 'golden-parity', 'id-collision']);
});
