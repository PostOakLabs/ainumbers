// Self-test for local-mutation-tier.mjs pure helpers (no WSL needed).
import assert from 'node:assert/strict';
import { validateIds, winPathToWsl, mapVerdict, shadowLines } from './local-mutation-tier.mjs';

assert.deepEqual(validateIds(['art-215', 'art-808']), ['art-215', 'art-808']);
for (const bad of ['Art-1', 'a b', 'a;rm', '$(x)', '', '../x']) assert.throws(() => validateIds([bad]), /invalid kernel id/);
assert.throws(() => validateIds([]), /no kernel id/);

assert.equal(winPathToWsl('C:\\dev\\x y\\z'), '/mnt/c/dev/x y/z');
assert.throws(() => winPathToWsl('\\\\host\\share\\x'), /cannot map/);

assert.equal(mapVerdict(null, 1), 'HARD-FAIL');
assert.equal(mapVerdict({ results: [{ id: 'a', hardFail: 'ENOENT' }] }, 1), 'HARD-FAIL');
assert.equal(mapVerdict({ results: [{ id: 'a' }] }, 1), 'FLOOR-FAIL');
assert.equal(mapVerdict({ results: [{ id: 'a' }] }, 0), 'PASS');

const lines = shadowLines('R', ['a', 'b'], 'PASS', 7, 'T').trim().split('\n').map((l) => JSON.parse(l));
assert.equal(lines.length, 2);
assert.deepEqual(lines[0], { ts: 'T', row: 'R', kernel: 'a', verdict: 'PASS', wall_s: 7, ci_verdict: null });

console.log('local-mutation-tier self-test: OK');
