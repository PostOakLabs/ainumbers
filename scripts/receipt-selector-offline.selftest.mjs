// receipt-selector-offline.selftest.mjs -- proven-to-reject selftest for receipt-selector-offline.mjs.
// Run: node scripts/receipt-selector-offline.selftest.mjs   (exit 0 = pass)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSelector, readEstateConstants, EXPECTED_SELECTOR, KERNEL_SRC } from './receipt-selector-offline.mjs';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'receipt-selector-offline.mjs');
const src = readFileSync(KERNEL_SRC, 'utf8');

// 1. Estate constants reproduce the pinned selector.
const sel = computeSelector(readEstateConstants(src));
assert.equal(sel, EXPECTED_SELECTOR, `selector 0x${sel} != 0x${EXPECTED_SELECTOR}: estate control constants or VK derivation drifted`);

// 2. The CLI passes on the real source and prints the intermediate digests.
const ok = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
assert.equal(ok.status, 0, ok.stderr);
assert.match(ok.stdout, /VK digest [0-9a-f]{64}/);
assert.match(ok.stdout, /selector 0x73c457ba/);

// 3. Perturbed scratch copies must fail (control root, bn254 id, one VK coordinate).
const dir = mkdtempSync(join(tmpdir(), 'selector-offline-'));
const flip = (re, from, to) => {
  const out = src.replace(re, (m) => m.replace(from, to));
  assert.notEqual(out, src, `perturbation ${re} did not change the source`);
  return out;
};
const perturbed = {
  controlRoot: flip(/CONTROL_ROOT_HEX\s*=\s*'a5/, 'a5', 'a6'),
  bn254Id: flip(/BN254_CONTROL_ID_HEX\s*=\s*'c0/, 'c0', 'c1'),
  vkAlpha: flip(/alpha: \['2049119/, '2049119', '2049118'),
};
for (const [name, text] of Object.entries(perturbed)) {
  const f = join(dir, `${name}.mjs`);
  writeFileSync(f, text);
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { ...process.env, RECEIPT_SELECTOR_KERNEL_SRC: f } });
  assert.notEqual(r.status, 0, `${name}: perturbed constants still passed`);
  assert.match(r.stderr, /FAIL: selector 0x[0-9a-f]{8} != 0x73c457ba/, `${name}: unclear failure message`);
}
console.log('receipt-selector-offline selftest: PASS (3 perturbations rejected)');
