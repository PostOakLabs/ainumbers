// receipt-selector-offline.mjs -- recompute the RISC Zero Groth16 verifier selectors with no network.
// Run: node scripts/receipt-selector-offline.mjs   (exit 0 = both pinned selectors reproduce)
// Reads BOTH estate constant sets (control root, BN254 control id, VK points; RISC0-310-R4-DUAL-VERIFIER-1)
// out of chaingraph/kernels/_computeproof.mjs and applies the risc0 derivation to each:
//   research/RISC0-GROTH16-VK-DIGEST-PIN-2026-11.md (VerifyingKey::digest, tagged_struct,
//   Groth16ReceiptVerifierParameters::digest; Solidity: RiscZeroGroth16Verifier.sol v3.0.0 lines 88-132).
//   CURRENT_ (risc0 v3.1.0) -> 0xe71e6620; LEGACY_ (risc0 v3.0.x) -> 0x73c457ba.
// node built-in crypto only. The VK digests are recomputed, never hardcoded.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// One pin per constant set, keyed by the declaration prefix used in _computeproof.mjs.
export const EXPECTED_SELECTORS = Object.freeze({ CURRENT_: 'e71e6620', LEGACY_: '73c457ba' });
// Kept for callers that read the single legacy pin.
export const EXPECTED_SELECTOR = EXPECTED_SELECTORS.LEGACY_;
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

// Pull one constant set out of the kernel source text so drift in the estate is what gets tested.
// prefix selects the set: 'CURRENT_' or 'LEGACY_' (declarations `const <prefix>CONTROL_ROOT_HEX`,
// `const <prefix>BN254_CONTROL_ID_HEX`, `const <prefix>VK = {`). Each must appear exactly once.
export function readEstateConstants(src = readFileSync(KERNEL_SRC, 'utf8'), prefix = 'LEGACY_') {
  const once = (re, what) => {
    const all = [...src.matchAll(new RegExp(re.source, 'g'))];
    if (all.length === 0) throw new Error(`${what} not found in _computeproof.mjs`);
    if (all.length > 1) throw new Error(`${what} declared ${all.length} times in _computeproof.mjs (want exactly one)`);
    return all[0];
  };
  const hex32 = (name) => once(new RegExp(`const ${prefix}${name}\\s*=\\s*'([0-9a-f]{64})'`), `constant ${prefix}${name}`)[1];
  const decs = (text) => [...text.matchAll(/'(\d+)'/g)].map((m) => m[1]);
  const vkBlock = once(new RegExp(`const ${prefix}VK = \\{([\\s\\S]*?)\\n\\};`), `${prefix}VK block`);
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
  const src = readFileSync(process.env.RECEIPT_SELECTOR_KERNEL_SRC || KERNEL_SRC, 'utf8');
  let failed = 0;
  for (const [prefix, expected] of Object.entries(EXPECTED_SELECTORS)) {
    const c = readEstateConstants(src, prefix);
    console.log(`[${prefix.slice(0, -1)}]`);
    console.log(`control_root     ${c.controlRoot}`);
    console.log(`bn254_control_id ${c.bn254ControlId}`);
    const sel = computeSelector(c, (l) => console.log(l));
    console.log(`selector 0x${sel} (expected 0x${expected})`);
    if (sel !== expected) {
      console.error(`FAIL: ${prefix.slice(0, -1)} selector 0x${sel} != 0x${expected}; estate control constants or VK parameters drifted`);
      failed++;
    }
  }
  if (failed) process.exit(1);
  console.log('OK: both selectors reproduced offline, no verifier call needed');
}
