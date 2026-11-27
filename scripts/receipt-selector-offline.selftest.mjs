// receipt-selector-offline.selftest.mjs -- proven-to-reject selftest for receipt-selector-offline.mjs.
// Run: node scripts/receipt-selector-offline.selftest.mjs   (exit 0 = pass)
// Covers BOTH constant sets (RISC0-310-R4-DUAL-VERIFIER-1): CURRENT_ -> 0xe71e6620, LEGACY_ -> 0x73c457ba.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSelector, readEstateConstants, EXPECTED_SELECTOR, EXPECTED_SELECTORS, KERNEL_SRC } from './receipt-selector-offline.mjs';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'receipt-selector-offline.mjs');
const src = readFileSync(KERNEL_SRC, 'utf8');

// 1. Each estate constant set reproduces its pinned selector; the legacy alias stays the legacy pin.
assert.equal(EXPECTED_SELECTOR, EXPECTED_SELECTORS.LEGACY_);
for (const [prefix, expected] of Object.entries(EXPECTED_SELECTORS)) {
  const sel = computeSelector(readEstateConstants(src, prefix));
  assert.equal(sel, expected, `${prefix} selector 0x${sel} != 0x${expected}: estate control constants or VK derivation drifted`);
}
assert.notEqual(EXPECTED_SELECTORS.CURRENT_, EXPECTED_SELECTORS.LEGACY_);

// 2. The CLI passes on the real source and prints the intermediate digests for both sets.
const ok = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
assert.equal(ok.status, 0, ok.stderr);
assert.match(ok.stdout, /VK digest [0-9a-f]{64}/);
assert.match(ok.stdout, /selector 0xe71e6620/);
assert.match(ok.stdout, /selector 0x73c457ba/);

// 3. Perturbed scratch copies must fail (control root, bn254 id, one VK coordinate, in each set),
//    and a duplicated declaration must fail rather than silently read the first one.
const dir = mkdtempSync(join(tmpdir(), 'selector-offline-'));
const flip = (re, from, to) => {
  const out = src.replace(re, (m) => m.replace(from, to));
  assert.notEqual(out, src, `perturbation ${re} did not change the source`);
  return out;
};
const perturbed = {
  legacyControlRoot: [flip(/LEGACY_CONTROL_ROOT_HEX\s*=\s*'a5/, "'a5", "'a6"), '73c457ba'],
  legacyBn254Id: [flip(/LEGACY_BN254_CONTROL_ID_HEX\s*=\s*'c0/, "'c0", "'c1"), '73c457ba'],
  legacyVkAlpha: [flip(/alpha: \['2049119/, '2049119', '2049118'), '73c457ba'],
  currentControlRoot: [flip(/CURRENT_CONTROL_ROOT_HEX\s*=\s*'e6/, "'e6", "'e7"), 'e71e6620'],
  currentBn254Id: [flip(/CURRENT_BN254_CONTROL_ID_HEX\s*=\s*'de/, "'de", "'df"), 'e71e6620'],
  currentVkAlpha: [flip(/alpha: \['1642843/, '1642843', '1642844'), 'e71e6620'],
};
for (const [name, [text, pin]] of Object.entries(perturbed)) {
  const f = join(dir, `${name}.mjs`);
  writeFileSync(f, text);
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { ...process.env, RECEIPT_SELECTOR_KERNEL_SRC: f } });
  assert.notEqual(r.status, 0, `${name}: perturbed constants still passed`);
  assert.match(r.stderr, new RegExp(`FAIL: (CURRENT|LEGACY) selector 0x[0-9a-f]{8} != 0x${pin}`), `${name}: unclear failure message`);
}
{
  const dup = src.replace(/const CURRENT_VK = \{/, "const CURRENT_CONTROL_ROOT_HEX = '" + '0'.repeat(64) + "';\nconst CURRENT_VK = {");
  assert.notEqual(dup, src);
  assert.throws(() => readEstateConstants(dup, 'CURRENT_'), /declared 2 times/);
}
console.log(`receipt-selector-offline selftest: PASS (2 sets reproduced, ${Object.keys(perturbed).length} perturbations + 1 duplicate declaration rejected)`);
