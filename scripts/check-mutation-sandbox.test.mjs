// scripts/check-mutation-sandbox.test.mjs — MUTATION-TIER-SANDBOX-PREFLIGHT-1 self-test.
// Run: node scripts/check-mutation-sandbox.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkKernels, firstError } from './check-mutation-sandbox.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ID = 'art-215-reg-z-appendix-j-apr';

// 1. No npx / Stryker spawn: every process the tool runs is the proptest under the
//    current node, in both modes (env var unset, then set).
const calls = [];
const failures = checkKernels([ID], {
  run: (args, cwd, env) => {
    calls.push({ args, hasEnv: '__STRYKER_ACTIVE_MUTANT__' in env });
    return { status: 0, output: '', error: null };
  },
});
assert.deepEqual(failures, []);
assert.equal(calls.length, 2, 'proptest runs exactly twice');
assert.deepEqual(calls.map((c) => c.hasEnv), [false, true], 'unset then set');
for (const c of calls) {
  assert.equal(c.args.length, 1);
  assert.match(c.args[0], /__proptests__\/art-215-.*\.proptest\.mjs$/);
  assert.doesNotMatch(c.args.join(' '), /npx|stryker/i);
}

// 2. Source-level guard: the tool never names npx/Stryker packages in a spawn.
const src = readFileSync(path.join(HERE, 'check-mutation-sandbox.mjs'), 'utf8');
assert.doesNotMatch(src.replace(/\/\*\*[\s\S]*?\*\//, ''), /npx|--package=|@stryker-mutator/);

// 3. A failing proptest is reported with its first error (ENOENT path included).
const red = checkKernels([ID], {
  run: () => ({ status: 1, output: "at x\nError: ENOENT: no such file or directory, open '/tmp/s/page.html'\n", error: null }),
});
assert.equal(red.length, 1);
assert.equal(red[0].id, ID);
assert.match(red[0].error, /ENOENT.*page\.html/);
assert.match(firstError('', 'boom'), /boom/);

console.log('check-mutation-sandbox.test: OK');
