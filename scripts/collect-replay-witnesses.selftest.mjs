#!/usr/bin/env node
// scripts/collect-replay-witnesses.selftest.mjs: offline controls for the witness collector.
// Planted verification records stand in for `gh attestation verify --format json` output, so each
// admission case (agree, disagree, edited fork, self-hosted runner, wrong workflow path) is
// classified without touching the network.
//
// Self-test: node scripts/collect-replay-witnesses.selftest.mjs

import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractRecord, classifyRecord, buildRoll, collectLive, diffResults, reportDisagreements, runtimeLabel,
  WITNESS_WORKFLOW_PATH, BEACON_PREFIX,
} from './collect-replay-witnesses.mjs';
import { createHash } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
let passed = 0;
async function test(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }

const COMMIT = 'c'.repeat(40);
const FORK = 'alice/ainumbers';
const CORPUS = 'f'.repeat(64);
const BEACON = sha256(BEACON_PREFIX + CORPUS);
const AGREED = 'a'.repeat(64);
const upstreamCommits = new Set([COMMIT]);
const ctx = { fork: FORK, beacon: BEACON, expectedResult: AGREED, commitInUpstream: (s) => upstreamCommits.has(s) };

/** A planted gh-verify entry; overrides tweak one property at a time. */
function planted(over = {}) {
  const o = { repo: FORK, path: WITNESS_WORKFLOW_PATH, runner: 'github-hosted', commit: COMMIT, beacon: BEACON, result: AGREED, env: { os: 'linux', arch: 'x64', node: 'v20.11.0' }, ...over };
  return {
    verificationResult: {
      statement: {
        subject: [{ name: 'replay-beacon', digest: { sha256: o.beacon } }, { name: 'replay-result', digest: { sha256: o.result } }],
        predicate: o.env,
      },
      signature: { certificate: {
        buildSignerURI: `https://github.com/${o.repo}/${o.path}@refs/heads/main`,
        runnerEnvironment: o.runner,
        sourceRepositoryDigest: o.commit,
      } },
    },
  };
}
const cls = (over) => classifyRecord(extractRecord(planted(over)), ctx);

await test('agree: hosted runner, witness workflow, upstream commit, agreed result', () => {
  assert.deepEqual(cls({}), { status: 'agree', reason: 'result-equals-agreed-digest' });
});
await test('disagree: valid bundle whose result differs stays classified, not dropped', () => {
  assert.equal(cls({ result: 'b'.repeat(64) }).status, 'disagree');
});
await test('edited fork: source commit not in upstream is rejected', () => {
  assert.deepEqual(cls({ commit: 'd'.repeat(40) }), { status: 'rejected', reason: 'source-commit-not-in-upstream' });
});
await test('self-hosted runner is rejected', () => {
  assert.deepEqual(cls({ runner: 'self-hosted' }), { status: 'rejected', reason: 'not-github-hosted-runner' });
});
await test('wrong workflow path is rejected', () => {
  assert.deepEqual(cls({ path: '.github/workflows/other.yml' }), { status: 'rejected', reason: 'wrong-workflow-path' });
});
await test('a bundle signed by another repository is rejected', () => {
  assert.deepEqual(cls({ repo: 'mallory/ainumbers' }), { status: 'rejected', reason: 'signer-not-the-fork' });
});
await test('a bundle for another beacon is rejected', () => {
  assert.equal(cls({ beacon: '1'.repeat(64) }).reason, 'beacon-mismatch');
});
await test('runtime label', () => {
  assert.equal(runtimeLabel({ os: 'win32', arch: 'x64', node: 'v20.1.0' }), 'win-x64-node20');
});

const replay = { result: { corpus_digest: CORPUS, modules: { m1: 'x', m2: 'y' }, mismatches: {}, excluded_count: 0 }, counts: {} };
const house = { signature_status: 'signed' };

await test('counting: distinct accounts per module, current digest only, house never summed', () => {
  const w = (account, mods, result = 'agree') => ({ account, account_created: '2020-01-01', fork: `${account}/ainumbers`, corpus_digest: CORPUS, result, runtimes: ['linux-x64-node20'], bundle_url: 'u', modules_agreed: mods });
  const roll = buildRoll({ replay, house, witnesses: [w('a', ['m1', 'm2']), w('a', ['m1']), w('b', ['m1', 'stale'])], disagreements: [] });
  assert.equal(roll.modules.m1.outside.accounts_agree, 2);   // a counted once, b once
  assert.equal(roll.modules.m2.outside.accounts_agree, 1);
  assert.equal(roll.modules.stale, undefined);               // a moved digest counts nowhere
  assert.equal(roll.modules.m1.house.agree, 1);              // separate line, never added in
});
await test('zero outside witnesses is a valid, plain roll', () => {
  const roll = buildRoll({ replay, house, witnesses: [], disagreements: [] });
  assert.equal(roll.modules.m1.outside.accounts_agree, 0);
  assert.deepEqual(roll.witnesses, []);
});
await test('diff names the differing vector ids', () => {
  assert.deepEqual(diffResults(replay.result, { mismatches: { m1: ['art-1/v2', 'art-1/v1'] } }), ['art-1/v1', 'art-1/v2']);
  assert.deepEqual(diffResults(replay.result, { modules: { m1: 'x', m2: 'CHANGED' } }), ['module:m2']);
});

await test('collectLive over planted forks: agree kept, disagree kept in the roll, junk rejected', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cw-'));
  const badFile = join(dir, 'replay-result.json');
  const badBody = JSON.stringify({ modules: { m1: 'x', m2: 'DIFF' }, mismatches: {} });
  writeFileSync(badFile, badBody);
  const dsse = (res) => ({ bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify({ subject: [{ name: 'replay-result', digest: { sha256: res } }] })).toString('base64') } } });
  const forks = ['alice/ainumbers', 'bob/ainumbers', 'carol/ainumbers', 'dave/ainumbers'];
  const atts = { 'alice/ainumbers': [dsse(AGREED)], 'bob/ainumbers': [dsse(sha256(badBody))], 'carol/ainumbers': [dsse(AGREED)], 'dave/ainumbers': [] };
  const gh = (args) => {
    const a = args.join(' ');
    if (a.includes('/forks')) return forks.join('\n') + '\n';
    const m = /repos\/([^/]+\/[^/]+)\/attestations\//.exec(a);
    if (m) { if (!atts[m[1]]?.length) throw new Error('404'); return JSON.stringify({ attestations: atts[m[1]] }); }
    if (a.startsWith('api users/')) return JSON.stringify({ created_at: '2019-05-06T00:00:00Z' });
    throw new Error(`unexpected gh ${a}`);
  };
  const verify = (file, fork) => {
    if (file === badFile && fork === 'bob/ainumbers') return [planted({ repo: fork, result: sha256(badBody) })];
    if (file !== badFile && fork === 'alice/ainumbers') return [planted({ repo: fork }), planted({ repo: fork, env: { os: 'win32', arch: 'x64', node: 'v20.1.0' } })];
    if (file !== badFile && fork === 'carol/ainumbers') return [planted({ repo: fork, runner: 'self-hosted' })];
    return [];
  };
  const deps = { gh, verify, download: (fork) => (fork === 'bob/ainumbers' ? [badFile] : []), commitInUpstream: (s) => upstreamCommits.has(s), agreedFile: join(dir, 'agreed.json') };
  // Result digests in the planted statements must equal the agreed digest the collector derives,
  // so plant the real one: the collector computes expectedResult from the replay result itself.
  const { serializeResult } = await import('./replay-result.mjs');
  const expected = sha256(serializeResult(replay.result));
  atts['alice/ainumbers'] = [dsse(expected)]; atts['carol/ainumbers'] = [dsse(expected)];
  const plantedExpected = (over) => planted({ ...over, result: expected });
  deps.verify = (file, fork) => {
    if (file === badFile && fork === 'bob/ainumbers') return [planted({ repo: fork, result: sha256(badBody) })];
    if (file !== badFile && fork === 'alice/ainumbers') return [plantedExpected({ repo: fork }), plantedExpected({ repo: fork, env: { os: 'win32', arch: 'x64', node: 'v20.1.0' } })];
    if (file !== badFile && fork === 'carol/ainumbers') return [plantedExpected({ repo: fork, runner: 'self-hosted' })];
    return [];
  };
  const got = await collectLive({ replay, deps, prior: null });
  const roll = buildRoll({ replay, house, witnesses: got.witnesses, disagreements: got.disagreements });
  assert.equal(roll.modules.m1.outside.accounts_agree, 1);                 // alice only
  assert.deepEqual(roll.modules.m1.outside.runtimes, ['linux-x64-node20', 'win-x64-node20']);
  assert.ok(got.rejected.some((r) => r.fork === 'carol/ainumbers' && r.reason === 'not-github-hosted-runner'));
  assert.equal(roll.disagreements.length, 1);                              // bob stays in the roll
  assert.deepEqual(roll.disagreements[0].vector_ids, ['module:m2']);
  assert.ok(roll.witnesses.some((w) => w.account === 'bob' && w.result === 'disagree'));
  assert.equal(roll.witnesses.find((w) => w.account === 'alice').account_created, '2019-05-06');
});

await test('one issue per corpus digest: open once, then comment', () => {
  const calls = [];
  let open = [];
  const gh = (args) => {
    calls.push(args[1]);
    if (args[1] === 'list') return JSON.stringify(open);
    if (args[1] === 'create') { open = [{ number: 7, title: args[args.indexOf('--title') + 1] }]; return 'url'; }
    return '';
  };
  const d = [{ account: 'bob', fork: 'bob/ainumbers', corpus_digest: CORPUS, vector_ids: ['module:m2'], bundle_url: 'u' }];
  assert.deepEqual(reportDisagreements({ disagreements: d, gh }).map((a) => a.action), ['opened']);
  assert.deepEqual(reportDisagreements({ disagreements: d, gh }).map((a) => a.action), ['commented']);
});

console.log(`collect-replay-witnesses selftest: ${passed} passed`);
