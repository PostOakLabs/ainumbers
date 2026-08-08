// DERIV-PROVE-1 — splice the art-560 / art-561 groth16 receipts into their node shards.
// Run from the worktree root:
//   node scripts/splice-deriv-proofs.mjs <staged-dir> [--apply]
//
// ⛔⛔ KROOT-TRAP GUARD. `prove_node_resume.sh` and friends hardcode KROOT to the SHARED kernel tree,
// so a receipt can be produced against a DIFFERENT kernel than the one being spliced — and the seal
// still verifies, because it faithfully proves the OTHER kernel. Before writing anything, this asserts
// a FOUR-WAY identity per node:
//     pre-prove pin == sha256(kernel file in THIS tree) == receipt journal.kernel_digest
//                   == shard compute_images sha256-source image_id
// Any disagreement aborts with no write.
//
// ⛔ It also refuses to splice a receipt whose journal commits an error rather than a result — the
// failure mode CCPCORE-PROVE-1 measured, where a valid seal sat over {"error":"ocg_run","code":-3}.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const KROOT = resolve(ROOT, 'chaingraph/kernels');
const NODES = resolve(ROOT, 'chaingraph/graph/nodes');

const STAGED = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!STAGED) { console.error('usage: splice-deriv-proofs.mjs <staged-dir> [--apply]'); process.exit(2); }

const EXPECTED_IMAGE = 'sha256:a1a0bc89b5b1febaeda3519f6dbade0fa5ac16beeb143c4e1b01689573567bc6';
const VALID_FROM = '2026-08-08';

// Digests pinned from the worktree BEFORE the GPU session started.
const TARGETS = [
  { id: 'art-560-oracle-price-aggregation', pin: 'sha256:ba126694afd24428319b321cbc06447608573deb30aaa75f5905a25146b3b91f' },
  { id: 'art-561-currency-basket-index', pin: 'sha256:84f9b197e0b2e11acc54f7bb0ac50a30db1e80f22e33238395093d9ac9887921' },
];

const sourceDigest = (t) => 'sha256:' + createHash('sha256')
  .update(Buffer.from(String(t).replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8')).digest('hex');

let failed = 0;
let ok = 0;
for (const t of TARGETS) {
  const cpPath = resolve(STAGED, `${t.id}.computeproof.json`);
  const shardPath = resolve(NODES, `${t.id}.json`);
  if (!existsSync(cpPath)) { console.log(`⛔ ${t.id}: no staged computeproof at ${cpPath}`); failed++; continue; }
  const cp = JSON.parse(readFileSync(cpPath, 'utf8'));
  const shard = JSON.parse(readFileSync(shardPath, 'utf8'));

  // --- error-journal guard -------------------------------------------------------------------
  if (cp.journal?.error !== undefined) {
    console.log(`⛔ ${t.id}: journal commits an ERROR (${JSON.stringify(cp.journal.error)}) — refusing to splice a sealed failure`);
    failed++; continue;
  }
  if (cp.journal?.ocg_run !== undefined) {
    console.log(`⛔ ${t.id}: journal carries an ocg_run status rather than a result`); failed++; continue;
  }
  const out = cp.journal?.output;
  if (!out || typeof out !== 'object' || Array.isArray(out)) {
    console.log(`⛔ ${t.id}: journal.output is not the output_payload object`); failed++; continue;
  }
  if (out.error !== undefined) {
    console.log(`⛔ ${t.id}: journal.output carries an error key`); failed++; continue;
  }
  if (Object.keys(out).length < 2) {
    console.log(`⛔ ${t.id}: journal.output has ${Object.keys(out).length} key(s) — implausible for a real result`);
    failed++; continue;
  }
  if (typeof cp.seal !== 'string' || cp.seal.length < 300) {
    console.log(`⛔ ${t.id}: seal is ${cp.seal?.length ?? 0} chars — too short to be a groth16 seal`); failed++; continue;
  }
  if (cp.type !== 'ZkVmReceipt' || cp.receiptFormat !== 'groth16-bn254' || cp.system !== 'risc0') {
    console.log(`⛔ ${t.id}: receipt envelope is not a risc0 groth16-bn254 ZkVmReceipt`); failed++; continue;
  }

  // --- four-way kernel identity (the KROOT trap) ---------------------------------------------
  const onDisk = sourceDigest(readFileSync(resolve(KROOT, `${t.id}.kernel.mjs`), 'utf8'));
  const srcEntry = (shard.compute_images ?? []).find((i) => i.system === 'sha256-source');
  if (!srcEntry) { console.log(`⛔ ${t.id}: shard has no sha256-source compute_images entry`); failed++; continue; }
  if (onDisk !== cp.journal.kernel_digest || onDisk !== srcEntry.image_id || onDisk !== t.pin) {
    console.log(`⛔ ${t.id}: KERNEL IDENTITY DISAGREEMENT — refusing to splice`);
    console.log(`     pre-prove pin  : ${t.pin}`);
    console.log(`     kernel on disk : ${onDisk}`);
    console.log(`     journal digest : ${cp.journal.kernel_digest}`);
    console.log(`     shard sha256-source: ${srcEntry.image_id}`);
    failed++; continue;
  }
  if (cp.imageId !== EXPECTED_IMAGE) {
    console.log(`⛔ ${t.id}: imageId ${cp.imageId} is not the expected universal guest image`); failed++; continue;
  }

  // --- splice ---------------------------------------------------------------------------------
  const images = (shard.compute_images ?? []).filter((i) => !(i.system === 'risc0' && i.image_id === EXPECTED_IMAGE));
  images.push({ system: 'risc0', image_id: EXPECTED_IMAGE, valid_from: VALID_FROM });
  shard.compute_images = images;
  shard.compute_proof = cp;
  shard.compute_proof_ready = 'ready';
  // deferral_reason RETAINED in place — matches the shipped art-533/538/547/566/588/589 convention.

  console.log(`✅ ${t.id}: kernel_digest ${onDisk} (4-way match incl. pre-prove pin), ${Object.keys(out).length} output keys, seal ${cp.seal.length}b, image ${EXPECTED_IMAGE}`);
  ok++;
  if (APPLY) {
    writeFileSync(shardPath, JSON.stringify(shard, null, 2) + '\n');
    console.log(`   wrote ${shardPath}`);
  }
}

console.log(`\nok=${ok} refused=${failed}`);
if (failed) { console.log(`⛔ ${failed} node(s) failed the guards — nothing spliced for those.`); process.exit(1); }
console.log(APPLY ? 'spliced.' : 'dry run OK — re-run with --apply');
