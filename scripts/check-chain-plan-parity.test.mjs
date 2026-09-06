#!/usr/bin/env node
/**
 * scripts/check-chain-plan-parity.test.mjs — fixture proof for the
 * COMPOSER-PLAN-AND-ROOT-WEBMCP-1 parity gate (check-chain-plan-parity.mjs).
 *
 * A gate never seen red is not a gate. In a temp repo fixture this exercises:
 *   1. GREEN  — a fixture repo (chaingraph.json + one composer page + committed
 *               hash set + empty baseline) passes.
 *   2. RED    — flipping ONE handoff byte in the committed set fails check (1).
 *   3. RED    — a page whose manifest handoff diverges from chaingraph.json
 *               fails check (2) unless baselined.
 *   4. RATCHET — a baseline entry whose finding no longer occurs fails as stale.
 *
 * Usage: node scripts/check-chain-plan-parity.test.mjs   (also under `node --test`)
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const GATE = resolve(REPO, 'scripts', 'check-chain-plan-parity.mjs');

function buildFixtureRepo(tmp) {
  const cg = JSON.parse(readFileSync(resolve(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  const chain = JSON.parse(JSON.stringify(cg.chains.find((c) => c.name === 'agent-identity-verification')));
  mkdirSync(resolve(tmp, 'chaingraph', 'chains'), { recursive: true });
  mkdirSync(resolve(tmp, 'chaingraph', 'kernels'), { recursive: true });
  mkdirSync(resolve(tmp, 'scripts'), { recursive: true });
  mkdirSync(resolve(tmp, 'data'), { recursive: true });
  // Kernels + gate are imported by RELATIVE path from the fixture repo root.
  copyFileSync(resolve(REPO, 'chaingraph', 'kernels', '_hash.mjs'), resolve(tmp, 'chaingraph', 'kernels', '_hash.mjs'));
  copyFileSync(resolve(REPO, 'scripts', 'check-chain-plan-parity.mjs'), resolve(tmp, 'scripts', 'check-chain-plan-parity.mjs'));
  writeFileSync(resolve(tmp, 'chaingraph', 'chaingraph.json'), JSON.stringify({ chains: [chain] }));
  copyFileSync(resolve(REPO, 'chaingraph', 'chains', `${chain.name}.html`), resolve(tmp, 'chaingraph', 'chains', `${chain.name}.html`));
  return chain;
}

async function runGate(tmp) {
  try {
    const out = execFileSync(process.execPath, [resolve(tmp, 'scripts', 'check-chain-plan-parity.mjs')], { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

async function writeCommittedSet(tmp, chains, flip) {
  // Recompute via the gate itself (--write), then optionally flip one entry.
  execFileSync(process.execPath, [resolve(tmp, 'scripts', 'check-chain-plan-parity.mjs'), '--write'], { cwd: tmp, stdio: 'ignore' });
  if (flip) {
    const p = resolve(tmp, 'data', 'chain-plan-hashes.json');
    const j = JSON.parse(readFileSync(p, 'utf8'));
    j.hashes[flip] = 'f'.repeat(64);
    writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  }
}

test('parity gate fixture: GREEN control, then RED on committed-set flip, GREEN on restore', async () => {
  const tmp = resolve(REPO, '.tmp-parity-fixture');
  try {
    rmSync(tmp, { recursive: true, force: true });
    const chain = buildFixtureRepo(tmp);
    await writeCommittedSet(tmp, [chain], null);
    const green = await runGate(tmp);
    assert.equal(green.code, 0, 'GREEN control failed: ' + green.out);
    assert.match(green.out, /1\/1 chain plan hashes match/);
    await writeCommittedSet(tmp, [chain], chain.name);
    const red = await runGate(tmp);
    assert.equal(red.code, 1, 'flipped committed entry must RED');
    assert.match(red.out, /!= SSOT recompute/);
    // Restore (recompute) → green again.
    execFileSync(process.execPath, [resolve(tmp, 'scripts', 'check-chain-plan-parity.mjs'), '--write'], { cwd: tmp, stdio: 'ignore' });
    assert.equal((await runGate(tmp)).code, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('parity gate fixture: page staleness REDs, baselined passes, healed baseline entry is stale', async () => {
  const tmp = resolve(REPO, '.tmp-parity-fixture2');
  try {
    rmSync(tmp, { recursive: true, force: true });
    const chain = buildFixtureRepo(tmp);
    await writeCommittedSet(tmp, [chain], null);
    // Mutate the PAGE's manifest handoff (step 1) — page staleness class.
    const pagePath = resolve(tmp, 'chaingraph', 'chains', `${chain.name}.html`);
    const src = readFileSync(pagePath, 'utf8');
    const m = src.match(/(?:const|var|let) CHAIN_MANIFEST = [\s\S]*?"handoff":"([^"]*)"/);
    assert.ok(m, 'fixture page carries a manifest handoff literal');
    const mutated = m[0].replace(`"handoff":"${m[1]}"`, `"handoff":"${m[1]} (stale)"`);
    assert.notEqual(mutated, m[0]);
    writeFileSync(pagePath, src.replace(m[0], mutated));
    const red = await runGate(tmp);
    assert.equal(red.code, 1, 'page handoff divergence must RED');
    assert.match(red.out, /step 1 handoff != chaingraph\.json/);
    // Baseline it → green, reported as baselined.
    writeFileSync(resolve(tmp, 'scripts', 'chain-plan-parity-baseline.json'), JSON.stringify({ [chain.name]: ['handoff:1'] }));
    const green = await runGate(tmp);
    assert.equal(green.code, 0, 'baselined staleness must pass: ' + green.out);
    assert.match(green.out, /1 pre-existing page-staleness finding\(s\) baselined/);
    // Heal the page (restore bytes) → the baseline entry is now stale → RED.
    writeFileSync(pagePath, src);
    const stale = await runGate(tmp);
    assert.equal(stale.code, 1, 'healed page with baseline entry must fail the ratchet');
    assert.match(stale.out, /stale baseline entry 'handoff:1'/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
