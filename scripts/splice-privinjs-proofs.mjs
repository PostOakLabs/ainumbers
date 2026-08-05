// PRIVIN-GUEST-EXTEND-1 — splice the art-529 / art-548 groth16 receipts (new §25 private-input JS
// guest) into their node shards. Run from the worktree root:
//   node scripts/splice-privinjs-proofs.mjs <staged-dir> [--apply]
//
// ⛔⛔ KROOT-TRAP GUARD. `prove_node_resume.sh` and friends hardcode KROOT to the SHARED kernel tree,
// so a receipt can be produced against a DIFFERENT kernel than the one being spliced — and the seal
// still verifies, because it faithfully proves the OTHER kernel. Before writing anything, this asserts
// a THREE-WAY identity per node:
//     sha256(kernel file in THIS tree) == receipt journal.kernel_digest == shard compute_images
//                                                                          sha256-source image_id
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
if (!STAGED) { console.error('usage: splice-privinjs-proofs.mjs <staged-dir> [--apply]'); process.exit(2); }

const EXPECTED_IMAGE = 'sha256:adf39b5c4e8fe19f9dbc25e2b8eb84090f0ee6c9370f14ad10d5039e8e65b0ec';
const VALID_FROM = '2026-08-04';

const TARGETS = [
  { id: 'art-529-ccp-default-waterfall-recompute', shard: 'art-529-ccp-default-waterfall-recompute.json' },
  { id: 'art-548-vop-readiness-diagnostic', shard: 'art-548-vop-readiness-diagnostic.json' },
];

const sourceDigest = (t) => 'sha256:' + createHash('sha256')
  .update(Buffer.from(String(t).replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8')).digest('hex');

let failed = 0;
for (const t of TARGETS) {
  const cpPath = resolve(STAGED, `${t.id}.computeproof.json`);
  const shardPath = resolve(NODES, t.shard);
  if (!existsSync(cpPath)) { console.log(`⛔ ${t.id}: no staged computeproof at ${cpPath}`); failed++; continue; }
  const cp = JSON.parse(readFileSync(cpPath, 'utf8'));
  const shard = JSON.parse(readFileSync(shardPath, 'utf8'));

  // --- error-journal guard -------------------------------------------------------------------
  if (cp.journal?.error !== undefined) {
    console.log(`⛔ ${t.id}: journal commits an ERROR (${JSON.stringify(cp.journal.error)}) — refusing to splice a sealed failure`);
    failed++; continue;
  }
  if (!cp.journal?.output || typeof cp.journal.output !== 'object' || Array.isArray(cp.journal.output)) {
    console.log(`⛔ ${t.id}: journal.output is not the output_payload object`); failed++; continue;
  }
  // --- §25.3: every declared commitment must be bound ----------------------------------------
  const commits = Array.isArray(cp.journal.commitments) ? cp.journal.commitments
    : (cp.journal.commitment ? [cp.journal.commitment] : []);
  if (!commits.length) { console.log(`⛔ ${t.id}: journal binds no commitment (§25.3)`); failed++; continue; }

  // --- three-way kernel identity (the KROOT trap) --------------------------------------------
  const onDisk = sourceDigest(readFileSync(resolve(KROOT, `${t.id}.kernel.mjs`), 'utf8'));
  const srcEntry = (shard.compute_images ?? []).find((i) => i.system === 'sha256-source');
  if (!srcEntry) { console.log(`⛔ ${t.id}: shard has no sha256-source compute_images entry`); failed++; continue; }
  if (onDisk !== cp.journal.kernel_digest || onDisk !== srcEntry.image_id) {
    console.log(`⛔ ${t.id}: KERNEL IDENTITY DISAGREEMENT — refusing to splice`);
    console.log(`     kernel on disk : ${onDisk}`);
    console.log(`     journal digest : ${cp.journal.kernel_digest}`);
    console.log(`     shard sha256-source: ${srcEntry.image_id}`);
    failed++; continue;
  }
  if (cp.imageId !== EXPECTED_IMAGE) {
    console.log(`⛔ ${t.id}: imageId ${cp.imageId} is not the expected privinjs guest image`); failed++; continue;
  }

  // --- splice ---------------------------------------------------------------------------------
  const images = (shard.compute_images ?? []).filter((i) => !(i.system === 'risc0' && i.image_id === EXPECTED_IMAGE));
  images.push({ system: 'risc0', image_id: EXPECTED_IMAGE, valid_from: VALID_FROM });
  shard.compute_images = images;
  shard.compute_proof = cp;
  shard.compute_proof_ready = 'ready';
  delete shard.deferred_reason;

  console.log(`✅ ${t.id}: kernel_digest ${onDisk} (3-way match), ${commits.length} commitment(s) bound, image ${EXPECTED_IMAGE}`);
  if (APPLY) {
    writeFileSync(shardPath, JSON.stringify(shard, null, 2) + '\n');
    console.log(`   wrote ${shardPath}`);
  }
}

if (failed) { console.log(`\n⛔ ${failed} node(s) failed the guards — nothing spliced for those.`); process.exit(1); }
console.log(APPLY ? '\nspliced.' : '\ndry run OK — re-run with --apply');
