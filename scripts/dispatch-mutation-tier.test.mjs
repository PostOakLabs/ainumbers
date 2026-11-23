// Self-test for scripts/dispatch-mutation-tier.mjs input validation and verdict formatting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInputs, verdictLines, KERNELS_INPUT_RE } from './dispatch-mutation-tier.mjs';

test('good ids and refs pass', () => {
  const v = validateInputs('MUTATION-TIER-DISPATCH-1', ['art-215-reg-z-appendix-j-apr', 'art-06-x']);
  assert.equal(v.ok, true);
  assert.equal(v.kernelsInput, 'art-215-reg-z-appendix-j-apr art-06-x');
  assert.equal(validateInputs('feature/a.b_c-1', ['k1']).ok, true);
});

test('injection strings are refused', () => {
  for (const bad of ['a;rm -rf /', 'a b', '$(id)', '`id`', 'a&&b', 'A', 'a\nb', 'a|b', '', '../x y', "a'b", 'a"b', 'a>b'])
    assert.equal(validateInputs('main', [bad]).ok, false, JSON.stringify(bad));
  for (const bad of ['main;id', '$(id)', '-fmain', 'a b', '', 'a\nb', 'a`b`'])
    assert.equal(validateInputs(bad, ['k']).ok, false, JSON.stringify(bad));
  assert.equal(validateInputs('main', []).ok, false);
});

test('workflow-side kernels regex refuses multi-line and metachar values', () => {
  assert.equal(KERNELS_INPUT_RE.test('a b-c d1'), true);
  for (const bad of ['a  b', ' a', 'a ', 'a\n;id', 'a;id', 'a$(id)', 'A'])
    assert.equal(KERNELS_INPUT_RE.test(bad), false, JSON.stringify(bad));
});

test('verdictLines reports measured, hard-fail and missing kernels', () => {
  const doc = { results: [
    { id: 'a', tiers: { moneyMath: { killed: 3, total: 4 }, peripheral: { killed: 1, total: 2 } } },
    { id: 'b', hardFail: 'timeout' },
  ] };
  const l = verdictLines(doc, ['a', 'b', 'c']);
  assert.equal(l[0].line, 'a: money-math 3/4  peripheral 1/2');
  assert.equal(l[0].measured, true);
  assert.match(l[1].line, /HARD-FAIL timeout/);
  assert.equal(l[2].measured, false);
});
