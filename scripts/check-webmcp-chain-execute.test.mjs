#!/usr/bin/env node
/**
 * check-webmcp-chain-execute.test.mjs: self-test pairing for
 * scripts/check-webmcp-chain-execute.mjs (WEBMCP-CHAIN-EXEC-GATE-1).
 *
 * Controls, RED and GREEN, driven through the gate's own exported harness
 * (runPlanChain, judgePart2, judgePart3, ratchet). Fixture page bodies live in
 * scripts/fixtures/webmcp-chain-execute/fixtures.json and are written to a
 * temp dir as .html pages; their hashes come from the real _hash.mjs
 * executionHash handed in as __testHash, so no control builds a preimage.
 *   1. GREEN: a page whose plan_chain returns a v0.4 plan with a reproducible,
 *      stable execution_hash passes part 2.
 *   2. RED: a page with no plan_chain fails part 2.
 *   3. RED: an unstable hash (a per-load nonce in policy_parameters) fails
 *      part 2 across two fresh runs.
 *   4. RED: a plan whose execution_hash does not recompute through _hash.mjs
 *      fails part 2.
 *   5. RED: a plan_chain that reaches for the network fails part 2.
 *   6. RED and GREEN: a step tool_id outside the registered set fails part 3;
 *      wrapper, direct and kernel-only-worker steps pass.
 *   7. Ratchet: a baselined key WARNs, a new key is fresh, a baseline key that
 *      no longer fails is STALE, an un-run chain's key is never STALE.
 *   9. Chain source: a PR-assembled monolith and a DERIVED_ROOT overlay both
 *      judge a new chain absent from the committed monolith (RED unregistered
 *      step, GREEN registered step); an assembler refusal fails closed.
 *   8. LIVE: the real composer page chaingraph/chains/2052a-classify-daily.html
 *      passes part 2 (plan_chain settles, recomputes, stable).
 */

import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { executionHash } from '../chaingraph/kernels/_hash.mjs';
import { runPlanChain, judgePart2, judgePart3, ratchet, verdictBlocks, resolveMonolith } from './check-webmcp-chain-execute.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const FX = JSON.parse(readFileSync(join(HERE, 'fixtures', 'webmcp-chain-execute', 'fixtures.json'), 'utf8'));

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ': ' + detail : ''}`); }
}

const page = (body) => `<!doctype html><html><head><title>fixture</title></head><body>\n<script>\n${body}\n</script>\n</body></html>\n`;

async function part2For(dir, key) {
  const rel = `${key}.html`;
  const abs = join(dir, rel);
  writeFileSync(abs, page(FX[key]));
  const g = { __testHash: executionHash };
  const a = await runPlanChain(abs, rel, `fx-${key}`, g);
  const b = await runPlanChain(abs, rel, `fx-${key}`, g);
  return judgePart2(a, b);
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'chain-exec-'));
  try {
    const stable = await part2For(dir, 'stable');
    check('GREEN: stable reproducible plan_chain passes part 2', stable.ok, stable.problem);

    const noPlan = await part2For(dir, 'no_plan_chain');
    check('RED: page with no plan_chain fails part 2', !noPlan.ok && /no plan_chain/.test(noPlan.problem), noPlan.problem);

    const unstable = await part2For(dir, 'unstable');
    check('RED: unstable hash across two fresh runs fails part 2', !unstable.ok && /unstable/.test(unstable.problem), unstable.problem);

    const wrong = await part2For(dir, 'wrong_hash');
    check('RED: hash that does not recompute through _hash.mjs fails part 2', !wrong.ok && /does not reproduce/.test(wrong.problem), wrong.problem);

    const net = await part2For(dir, 'network');
    check('RED: plan_chain reaching for the network fails part 2', !net.ok && /network access attempted/.test(net.problem), net.problem);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const registry = { wrapper: new Set(['art-w']), direct: new Set(['art-d']), kernelOnly: new Set(['art-k']) };
  const good = judgePart3(['art-w', 'art-d', 'art-k'], registry);
  check('GREEN: wrapper, direct and kernel-only-worker steps pass part 3', good.ok && good.steps.map((s) => s.via).join(',') === 'wrapper,direct,kernel-only-worker', JSON.stringify(good));
  const bad = judgePart3(['art-w', 'art-x'], registry);
  check('RED: a step outside the registered set fails part 3', !bad.ok && bad.unregistered.join() === 'art-x', JSON.stringify(bad));

  const baseline = new Map([['c1#part2', 'r'], ['c2#part3:art-x', 'r'], ['c9#part2', 'r']]);
  const r = ratchet([['c1#part2', 'p'], ['c3#part2', 'p']], baseline, new Set(['c1', 'c2', 'c3']));
  check('Ratchet: baselined key WARNs', r.warned.length === 1 && r.warned[0].startsWith('c1#part2'), JSON.stringify(r));
  check('Ratchet: new key is fresh', r.fresh.length === 1 && r.fresh[0].startsWith('c3#part2'), JSON.stringify(r));
  check('Ratchet: healed baseline key is STALE, un-run chain key is not', r.stale.join() === 'c2#part3:art-x', JSON.stringify(r.stale));

  // Verdict: STALE-only warns on PR + merge_group, blocks on main/local; NEW blocks everywhere.
  check('Verdict: STALE-only does not block a merge_group', verdictBlocks({ fresh: 0, stale: 1, event: 'merge_group' }) === false);
  check('Verdict: STALE-only does not block a pull_request', verdictBlocks({ fresh: 0, stale: 1, event: 'pull_request' }) === false);
  check('Verdict: STALE-only blocks on main push', verdictBlocks({ fresh: 0, stale: 1, event: 'push' }) === true);
  check('Verdict: STALE-only blocks locally (no event)', verdictBlocks({ fresh: 0, stale: 1, event: undefined }) === true);
  check('Verdict: NEW blocks a merge_group', verdictBlocks({ fresh: 1, stale: 0, event: 'merge_group' }) === true);
  check('Verdict: NEW blocks a pull_request (MAIN-ONLY-PATHS-GATE-1)', verdictBlocks({ fresh: 1, stale: 0, event: 'pull_request' }) === true);

  // CHAIN-ADD-PR-SIDE-EXECUTE-1: the chain list must come from the PR-assembled
  // monolith or the DERIVED_ROOT overlay, never only the committed monolith.
  const fxMono = (stepId) => JSON.stringify({ chains: [{ name: 'fx-new-chain', steps: [{ tool_id: stepId }] }] });
  const fxAssemble = (stepId) => (outPath) => { writeFileSync(outPath, fxMono(stepId)); return { status: 0, stderr: '' }; };
  const shard = ['chaingraph/graph/chains/fx-new-chain.json'];
  const stepsOf = (m) => JSON.parse(readFileSync(m.path, 'utf8')).chains.find((c) => c.name === 'fx-new-chain');
  const committed = JSON.parse(readFileSync(join(REPO, 'chaingraph', 'chaingraph.json'), 'utf8'));
  check('Control precondition: fixture chain is absent from the committed monolith', !(committed.chains ?? []).some((c) => c.name === 'fx-new-chain'));

  const savedRoot = process.env.DERIVED_ROOT;
  delete process.env.DERIVED_ROOT;
  try {
    const prBad = resolveMonolith({ repo: REPO, changed: shard, assemble: fxAssemble('art-x') });
    const prChain = prBad.path && stepsOf(prBad);
    check('RED: PR path judges the new chain, unregistered step absent from the committed monolith',
      prBad.source === 'pr-assembled' && prChain && !judgePart3(prChain.steps.map((s) => s.tool_id), registry).ok, JSON.stringify(prBad));
    const prGood = resolveMonolith({ repo: REPO, changed: shard, assemble: fxAssemble('art-w') });
    check('GREEN: PR path, new chain with a registered step passes part 3',
      prGood.source === 'pr-assembled' && judgePart3(stepsOf(prGood).steps.map((s) => s.tool_id), registry).ok, JSON.stringify(prGood));
    const failClosed = resolveMonolith({ repo: REPO, changed: shard, assemble: () => ({ status: 1, stderr: 'refused: fixture' }) });
    check('RED: assembler refusal on the PR path fails closed, no committed-monolith fallback', !!failClosed.error && !failClosed.path && /refused: fixture/.test(failClosed.error), JSON.stringify(failClosed));
    const noChain = resolveMonolith({ repo: REPO, changed: ['scripts/x.mjs'], assemble: () => { throw new Error('must not assemble'); } });
    check('Control: a diff with no chain shard reads the committed monolith', noChain.source === 'committed', JSON.stringify(noChain));

    const rootDir = mkdtempSync(join(tmpdir(), 'chain-exec-root-'));
    try {
      mkdirSync(join(rootDir, 'chaingraph'), { recursive: true });
      writeFileSync(join(rootDir, 'chaingraph', 'chaingraph.json'), fxMono('art-x'));
      process.env.DERIVED_ROOT = rootDir;
      const ov = resolveMonolith({ repo: REPO, changed: shard, assemble: () => { throw new Error('overlay must win over PR assembly'); } });
      const ovChain = ov.path && stepsOf(ov);
      check('RED: DERIVED_ROOT overlay judges the assembled tree, unregistered step fails part 3',
        ov.source === 'derived-root' && ovChain && !judgePart3(ovChain.steps.map((s) => s.tool_id), registry).ok, JSON.stringify(ov));
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  } finally {
    if (savedRoot === undefined) delete process.env.DERIVED_ROOT; else process.env.DERIVED_ROOT = savedRoot;
  }

  const liveRel = 'chaingraph/chains/2052a-classify-daily.html';
  const liveAbs = join(REPO, liveRel);
  if (!existsSync(liveAbs)) check('LIVE: specimen composer page present', false, liveRel);
  else {
    const a = await runPlanChain(liveAbs, liveRel, '2052a-classify-daily');
    const b = await runPlanChain(liveAbs, liveRel, '2052a-classify-daily');
    const v = await judgePart2(a, b);
    check(`LIVE: ${liveRel} passes part 2`, v.ok, v.problem);
  }

  console.log(failures === 0
    ? '✓ check-webmcp-chain-execute controls: PASS (part 2 RED on no plan_chain, unstable, non-reproducing and network cases; part 3 RED on an unregistered step; ratchet down-only; live specimen GREEN)'
    : `✗ check-webmcp-chain-execute controls: FAIL (${failures} control(s))`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('✗ controls exception:', e); process.exit(1); });
