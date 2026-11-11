// receipt-selector-offline.mjs -- recompute the RISC Zero Groth16 verifier selector with no network.
// Run: node scripts/receipt-selector-offline.mjs   (exit 0 = selector is 0x73c457ba)
// Reads the estate constants (control root, BN254 control id, VK points) out of
// chaingraph/kernels/_computeproof.mjs and applies the risc0 v3.0.x derivation:
//   research/RISC0-GROTH16-VK-DIGEST-PIN-2026-11.md (VerifyingKey::digest, tagged_struct,
//   Groth16ReceiptVerifierParameters::digest; Solidity: RiscZeroGroth16Verifier.sol v3.0.0 lines 88-132).
// node built-in crypto only. The VK digest is recomputed, never hardcoded.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const EXPECTED_SELECTOR = '73c457ba';
export const KERNEL_SRC = resolve(HERE, '../chaingraph/kernels/_computeproof.mjs');

const sha256 = (b) => createHash('sha256').update(b).digest();
const hex = (b) => Buffer.from(b).toString('hex');
const be32 = (dec) => Buffer.from(BigInt(dec).toString(16).padStart(64, '0'), 'hex');

// tagged_struct(tag, down, data=[]) = sha256(sha256(tag) || down... || u16_le(len(down)))
export function taggedStruct(tag, down) {
  const n = Buffer.alloc(2);
  n.writeUInt16LE(down.length);
  return sha256(Buffer.concat([sha256(Buffer.from(tag, 'utf8')), ...down, n]));
}

// tagged_list: cons chain folded from the last element, seeded with 32 zero bytes.
export function taggedList(tag, items) {
  let acc = Buffer.alloc(32);
  for (let i = items.length - 1; i >= 0; i--) acc = taggedStruct(tag, [items[i], acc]);
  return acc;
}

// Pull the constants out of the kernel source text so drift in the estate is what gets tested.
export function readEstateConstants(src = readFileSync(KERNEL_SRC, 'utf8')) {
  const hex32 = (name) => {
    const m = src.match(new RegExp(`const ${name}\\s*=\\s*'([0-9a-f]{64})'`));
    if (!m) throw new Error(`constant ${name} not found in _computeproof.mjs`);
    return m[1];
  };
  const decs = (text) => [...text.matchAll(/'(\d+)'/g)].map((m) => m[1]);
  const vkBlock = src.match(/const VK = \{([\s\S]*?)\n\};/);
  if (!vkBlock) throw new Error('VK block not found in _computeproof.mjs');
  const field = (name) => {
    const m = vkBlock[1].match(new RegExp(`\\b${name}:\\s*\\[([\\s\\S]*?)\\]`));
    if (!m) throw new Error(`VK.${name} not found`);
    return decs(m[1]);
  };
  const icM = vkBlock[1].match(/IC:\s*\[([\s\S]*)\],?\s*$/);
  if (!icM) throw new Error('VK.IC not found');
  const IC = [...icM[1].matchAll(/\[([^\]]*)\]/g)].map((m) => decs(m[1]));
  return {
    controlRoot: hex32('CONTROL_ROOT_HEX'),
    bn254ControlId: hex32('BN254_CONTROL_ID_HEX'), // Rust/Digest byte order (reverse of ControlID.sol)
    vk: { alpha: field('alpha'), beta: field('beta'), gamma: field('gamma'), delta: field('delta'), IC },
  };
}

// The estate lists G2 as [x.c0, x.c1, y.c0, y.c1]; the Solidity hash input is x1, x2, y1, y2 = [x.c1, x.c0, y.c1, y.c0].
const g2 = ([x0, x1, y0, y1]) => sha256(Buffer.concat([be32(x1), be32(x0), be32(y1), be32(y0)]));
const g1 = ([x, y]) => sha256(Buffer.concat([be32(x), be32(y)]));

export function computeSelector(c, log = () => {}) {
  const P = { alpha: g1(c.vk.alpha), beta: g2(c.vk.beta), gamma: g2(c.vk.gamma), delta: g2(c.vk.delta) };
  for (const [k, v] of Object.entries(P)) log(`P(${k})  ${hex(v)}`);
  const icDigests = c.vk.IC.map(g1);
  icDigests.forEach((d, i) => log(`P(IC${i}) ${hex(d)}`));
  const ic = taggedList('risc0_groth16.VerifyingKey.IC', icDigests);
  log(`IC list  ${hex(ic)}`);
  const vk = taggedStruct('risc0_groth16.VerifyingKey', [P.alpha, P.beta, P.gamma, P.delta, ic]);
  log(`VK digest ${hex(vk)}`);
  const params = taggedStruct('risc0.Groth16ReceiptVerifierParameters', [
    Buffer.from(c.controlRoot, 'hex'),
    Buffer.from(c.bn254ControlId, 'hex'),
    vk,
  ]);
  log(`params digest ${hex(params)}`);
  return hex(params.subarray(0, 4));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  // RECEIPT_SELECTOR_KERNEL_SRC lets the selftest point at a perturbed scratch copy.
  const c = readEstateConstants(readFileSync(process.env.RECEIPT_SELECTOR_KERNEL_SRC || KERNEL_SRC, 'utf8'));
  console.log(`control_root     ${c.controlRoot}`);
  console.log(`bn254_control_id ${c.bn254ControlId}`);
  const sel = computeSelector(c, (l) => console.log(l));
  console.log(`selector 0x${sel} (expected 0x${EXPECTED_SELECTOR})`);
  if (sel !== EXPECTED_SELECTOR) {
    console.error(`FAIL: selector 0x${sel} != 0x${EXPECTED_SELECTOR}; estate control constants or VK parameters drifted`);
    process.exit(1);
  }
  console.log('OK: selector reproduced offline, no verifier call needed');
}
