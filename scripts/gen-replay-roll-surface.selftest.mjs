#!/usr/bin/env node
// scripts/gen-replay-roll-surface.selftest.mjs: offline controls for the
// witness-roll region writer (REPLAY-ROLL-SURFACE-1). Renders the section from
// a fixture roll and from the live roll, pins the wording rule, the count
// sentinels, the splice fixpoint and the counts.mjs parity.
//
// Self-test: node scripts/gen-replay-roll-surface.selftest.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  renderRegion, renderGuard, spliceRegion, loadRoll, rollCounts,
  ROLL_REL, PAGE_REL, START_LINE, ROOT,
} from './gen-replay-roll-surface.mjs';
import { deriveCounts } from './counts.mjs';

const END_MARKER = '<!-- REPLAY-ROLL-SURFACE:END -->';

let passed = 0;
async function test(name, fn) { await fn(); passed += 1; console.log(`ok - ${name}`); }

function escKey(k) { return k.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// A witness entry shape exactly as collect-replay-witnesses.mjs writes it.
const w = (over = {}) => ({
  account: 'alice', account_created: '2019-05-06', fork: 'alice/ainumbers',
  corpus_digest: 'f'.repeat(64), result: 'agree',
  runtimes: ['linux-x64-node20', 'win-x64-node20'],
  bundle_url: 'https://api.github.com/repos/alice/ainumbers/attestations/sha256:' + 'b'.repeat(64),
  modules_agreed: ['m2', 'm1'], ...over,
});

const fixtureRoll = {
  schema: 'ainumbers.co/replay-witness-roll/v1',
  window: { corpus_digest: 'f'.repeat(64), beacon: 'b'.repeat(64), agreed_result_sha256: 'a'.repeat(64) },
  wording: 'Each count is the number of distinct GitHub accounts whose own hosted runner reproduced the module digest. It says the same fixtures give the same hashes elsewhere, nothing about the rule text.',
  modules: {
    'fixture-only:prov-snap-1-example-stream': { house: { agree: 1, disagree: 0, signed: true }, outside: { accounts_agree: 0, accounts_disagree: 0, runtimes: [] } },
    ['sha256:' + '1'.repeat(64)]: { house: { agree: 1, disagree: 0, signed: true }, outside: { accounts_agree: 2, accounts_disagree: 1, runtimes: ['linux-x64-node20', 'win-x64-node20'] } },
    ['sha256:' + '2'.repeat(64)]: { house: { agree: 0, disagree: 1, signed: false }, outside: { accounts_agree: 0, accounts_disagree: 0, runtimes: [] } },
  },
  witnesses: [
    w(),
    w({ account: 'zoe', fork: 'zoe/ainumbers', result: 'disagree', runtimes: ['macos-arm64-node20'], account_created: '2021-11-02' }),
  ],
  disagreements: [
    { account: 'zoe', fork: 'zoe/ainumbers', corpus_digest: 'f'.repeat(64), vector_ids: ['module:sha256:2222', 'art-9/v1'], bundle_url: 'https://api.github.com/repos/zoe/ainumbers/attestations/sha256:' + 'c'.repeat(64) },
  ],
};

const zeroRoll = {
  ...fixtureRoll,
  modules: { ['sha256:' + '3'.repeat(64)]: { house: { agree: 1, disagree: 0, signed: false }, outside: { accounts_agree: 0, accounts_disagree: 0, runtimes: [] } } },
  witnesses: [],
  disagreements: [],
};

await test('fixture roll: the required phrase with the account count', () => {
  const html = renderGuard(renderRegion(fixtureRoll));
  // alice agrees; zoe's run is a disagreement, so the reproduce count is 1.
  assert.match(html, /reproduced by <!--COUNT:replay\.accounts-->1<!--\/COUNT--> distinct GitHub accounts/);
  assert.ok(!html.includes('reproduced by 1 distinct'), 'the count is carried by the sentinel, not typed into the prose');
});
await test('fixture roll: every witness shows login, creation date, runtimes and bundle link', () => {
  const html = renderGuard(renderRegion(fixtureRoll));
  assert.match(html, /href="https:\/\/github\.com\/alice">alice</);
  assert.match(html, /<td class="m">2019-05-06<\/td>/);
  assert.match(html, /linux-x64-node20, win-x64-node20/);
  assert.match(html, /<td class="m">macos-arm64-node20<\/td>/);
  assert.match(html, /href="https:\/\/github\.com\/zoe\/ainumbers">zoe\/ainumbers</);
  assert.match(html, />attestation bundle<\/a>/);
  assert.match(html, /<span class="v v-ok">agree<\/span>/);
  assert.match(html, /<span class="v v-no">disagree<\/span>/);
});
await test('fixture roll: disagreements are listed, never dropped', () => {
  const html = renderGuard(renderRegion(fixtureRoll));
  assert.match(html, /<h3>Disagreements<\/h3>/);
  assert.match(html, /module:sha256:2222/);
  assert.match(html, /A disagreement stays in the roll\./);
});
await test('fixture roll: per module, the house line and the outside line, never summed', () => {
  const html = renderGuard(renderRegion(fixtureRoll));
  for (const key of Object.keys(fixtureRoll.modules)) assert.ok(html.includes(`>${escKey(key)}<`), `module row for ${key.slice(0, 24)}`);
  assert.match(html, /<td class="m">1\/0<\/td><td><span class="v v-ok">signed<\/span><\/td><td class="m">2\/1<\/td>/);
  assert.match(html, /<td class="m">0\/1<\/td><td><span class="v v-esc">unsigned<\/span><\/td><td class="m">0\/0<\/td>/);
});
await test('fixture roll: the three figures go through count sentinels', () => {
  const html = renderGuard(renderRegion(fixtureRoll));
  assert.match(html, /<!--COUNT:replay\.modules-->3<!--\/COUNT--> modules/);
  assert.match(html, /Recorded disagreements: <!--COUNT:replay\.disagreements-->1<!--\/COUNT-->\./);
  assert.deepEqual(rollCounts(fixtureRoll), { 'replay.modules': 3, 'replay.accounts': 1, 'replay.disagreements': 1 });
});
await test('zero outside witnesses is shown as zero, plainly', () => {
  const html = renderGuard(renderRegion(zeroRoll));
  assert.match(html, /reproduced by <!--COUNT:replay\.accounts-->0<!--\/COUNT--> distinct GitHub accounts/);
  assert.match(html, /No witness record exists yet/);
  assert.ok(!html.includes('<h3>Witness records</h3>'), 'an empty witness table is not rendered, the zero is');
  assert.match(html, /Recorded disagreements: <!--COUNT:replay\.disagreements-->0<!--\/COUNT-->/);
  assert.match(html, /<td class="m">1\/0<\/td><td><span class="v v-esc">unsigned<\/span><\/td><td class="m">0\/0<\/td>/);
});
await test('wording bans hold on every render', () => {
  for (const roll of [fixtureRoll, zeroRoll]) {
    const html = renderGuard(renderRegion(roll));
    assert.doesNotMatch(html, /\bindependent\w*\b/i);
    assert.doesNotMatch(html, /\baudited\b/i);
    assert.doesNotMatch(html, /\bcertified\b/i);
    assert.doesNotMatch(html, /verified by the community/i);
    assert.doesNotMatch(html, /[‒–—―]/);
    assert.doesNotMatch(html, /Wave \d/);
  }
});
await test('render guard refuses a banned word even when the roll carries it', () => {
  const bad = { ...zeroRoll, wording: 'The result was certified by people.' };
  assert.throws(() => renderGuard(renderRegion(bad)), /bans "certified"/);
});
await test('splice is a fixpoint and keeps the markers and the outer page', () => {
  const before = '<html>\n' + START_LINE + '\nOLD\n' + END_MARKER + '\n</html>';
  const once = spliceRegion(before, renderGuard(renderRegion(zeroRoll)), 'test');
  const twice = spliceRegion(once, renderGuard(renderRegion(zeroRoll)), 'test');
  assert.equal(once, twice);
  assert.ok(once.startsWith('<html>\n'));
  assert.ok(once.endsWith(END_MARKER + '\n</html>'));
  assert.ok(!once.includes('OLD'));
  assert.ok(once.includes(START_LINE));
});
await test('roll-sourced strings are escaped and shape-validated', () => {
  const quirky = { ...zeroRoll, wording: 'Counts weigh the login\'s own runner. Nothing else.' };
  const html = renderGuard(renderRegion(quirky));
  assert.ok(html.includes('login&#39;s own runner'));
  const amp = { ...zeroRoll, witnesses: [w({ bundle_url: 'https://api.github.com/repos/a/ainumbers/attestations?x=1&y=2' })] };
  const html2 = renderGuard(renderRegion(amp));
  assert.ok(html2.includes('attestations?x=1&amp;y=2'));
  assert.throws(() => loadRoll({ ...zeroRoll, witnesses: [w({ account: 'a<b>' })] }), /fails its shape rule/);
  assert.throws(() => loadRoll({ ...zeroRoll, witnesses: [w({ bundle_url: 'javascript:alert(1)' })] }), /fails its shape rule/);
  assert.throws(() => loadRoll({ ...zeroRoll, schema: 'other/v1' }), /roll\.schema/);
  assert.throws(() => loadRoll({ ...zeroRoll, wording: 'bad – dash' }), /en\/em dash/);
  assert.throws(() => loadRoll({ ...zeroRoll, modules: { x: { house: { agree: 1, disagree: 0, signed: 'yes' }, outside: {} } } }), /signed: expected a boolean/);
});
await test('the live roll renders, and its figures match counts.mjs (one rule, two callers)', async () => {
  const roll = JSON.parse(readFileSync(join(ROOT, ROLL_REL), 'utf8'));
  const html = renderGuard(renderRegion(roll));
  assert.ok(html.length > 1000, 'the live render is a real region');
  const C = await deriveCounts();
  for (const key of Object.keys(rollCounts(roll))) {
    assert.equal(C[key], rollCounts(roll)[key], `counts.mjs ${key} parity`);
  }
  // The committed page's region is byte-fresh against the live roll (the same
  // property the GATES freshness entry pins; asserted here so this self-test
  // alone proves the row's "renders from the live roll" criterion).
  const page = readFileSync(join(ROOT, PAGE_REL), 'utf8');
  const a = page.indexOf('<!-- REPLAY-ROLL-SURFACE:START');
  const b = page.indexOf(END_MARKER);
  assert.ok(a !== -1 && b !== -1 && b > a, 'the committed page carries the marker pair');
  assert.equal(page.slice(a, b + END_MARKER.length), html);
});

console.log(`gen-replay-roll-surface selftest: ${passed} passed`);
