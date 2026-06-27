// OpenChainGraph shared compute-integrity-proof helper — OCG Standard §18 (Compute-Integrity Proof).
// SINGLE SOURCE OF TRUTH for the §18 zkVM-receipt BINDING (attach + binding check) AND the
// self-contained BN254 Groth16 reference verifier (§18.1).
//
// §18 turns the §4 hash from re-execute-to-verify into a SUCCINCT proof of correct execution — verifiable
// without re-execution and, optionally, without seeing the inputs (confidentiality, §18.3). OCG's analogue
// of the chained-verifiable-computation goal in Trusted Compute Units (arXiv:2504.15717), but SOFTWARE /
// CRYPTOGRAPHIC ONLY: no TEE, no hardware enclave, no blockchain anchor.
//
// HOME (NORMATIVE, §18.0): artifact.audit_signature.compute_proof — hash-excluded; never alters
// execution_hash or chaingraph_version (stays "0.4.0"); a v0.6 artifact still validates under the frozen
// v0.4 schema.
//
// SEAL VERIFICATION (NORMATIVE, §18.1): for receiptFormat:"groth16-bn254" OCG ships a SELF-CONTAINED
// reference verifier — a BN254 Groth16 pairing check (vendored @noble/curves, zero npm/runtime dep) that is
// chain-free and not runtime-dependent on the prover vendor (preserving "no blockchain in the verify path").
// It reconstructs the risc0 ReceiptClaim digest from (imageId, journal) exactly as the named system's verifier
// does, derives the 5 public inputs, and checks the pairing equation against the published risc0 verifying key.
// For receiptFormat:"stark" the seal verify stays DELEGATED to the vendor verifier (verifySeal throws).
//
// PROVING IS OFF-BAND (NORMATIVE, §18.2): zkVM proving needs a Rust toolchain + heavy compute; it MUST NOT
// run in the browser tool, the Worker, or CI. A compute_proof is produced offline and attached; these
// helpers only ATTACH and VERIFY. Default-off (§18.3).

import { cgCanon } from './_hash.mjs';
import { bn254, sha256 } from './_noble-bn254.bundle.mjs';

// JCS-canonical compare (same canonicalizer as §4 — no second canonicalization path).
const canon = (o) => JSON.stringify(cgCanon(o ?? null));

// §18.1 — a self-contained reference verifier is shipped for groth16-bn254; stark stays delegated.
export const SEAL_VERIFICATION = 'reference-verifier';
export const RECOMMENDED_RECEIPT_FORMAT = 'groth16-bn254';
const RECEIPT_FORMATS = new Set(['groth16-bn254', 'stark']);

// Attach a §18 compute_proof to an artifact (does NOT mutate the input; never touches the hash preimage).
export function attachComputeProof(artifact, receipt) {
  const out = structuredClone(artifact);
  out.audit_signature = { ...(out.audit_signature || {}), compute_proof: receipt };
  return out;
}

export function normId(d) {
  return typeof d === 'string' && d.startsWith('sha256:') ? d : 'sha256:' + d;
}

/**
 * §18.0/§18.1 BINDING check. Returns boolean (predicate — false on any structural/binding problem).
 * Checks: object shape (type/system/receiptFormat/imageId/seal/journal); journal binds output_payload
 * (journal.output JCS-equals artifact.output_payload); imageId published in the Graph Index
 * (node.compute_images[].image_id) when publishedImageIds is supplied.
 *
 * Does NOT verify the cryptographic seal — use verifySeal() for that. A green binding means "this receipt
 * is well-formed and is ABOUT this artifact's output, by this published program"; the seal proves the
 * program actually produced it.
 */
export function verifyBinding(artifact, { publishedImageIds = [] } = {}) {
  const cp = artifact?.audit_signature?.compute_proof;
  if (!cp || typeof cp !== 'object') return false;
  if (cp.type !== 'ZkVmReceipt') return false;
  if (typeof cp.system !== 'string' || !cp.system) return false;
  if (!RECEIPT_FORMATS.has(cp.receiptFormat)) return false;
  if (typeof cp.imageId !== 'string' || !cp.imageId) return false;
  if (typeof cp.seal !== 'string' || !cp.seal) return false;
  if (!cp.journal || typeof cp.journal !== 'object') return false;
  // §18.0: the journal's committed output MUST equal the artifact output_payload.
  if (!('output' in cp.journal)) return false;
  if (canon(cp.journal.output) !== canon(artifact.output_payload)) return false;
  // §18.1: imageId must be a published program identity for this node.
  if (publishedImageIds.length && !publishedImageIds.map(normId).includes(normId(cp.imageId))) return false;
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────
// §18.1 — self-contained BN254 Groth16 reference verifier for receiptFormat:"groth16-bn254".
//
// Verifies a risc0 Groth16 receipt: reconstructs the ReceiptClaim digest from (imageId, journal) via risc0's
// tagged-struct hashing, derives the 5 Groth16 public inputs (split control_root + claim_digest, bn254 control
// id), and checks e(A,B)·e(-α,β)·e(-vk_x,γ)·e(-C,δ) == 1 against the published risc0 verifying key.
//
// Constants are risc0 v3.0.x verifier parameters:
//   VK  — risc0-groth16 verifier.rs (Groth16Verifier.sol ceremony output)
//   CONTROL_ROOT / BN254_CONTROL_ID — risc0-circuit-recursion control_id (Groth16ReceiptVerifierParameters::default)
// Cross-validated: this verifier ACCEPTS a real RISC0_DEV_MODE=0 receipt and REJECTS a tampered seal / wrong
// journal (kernels/fixtures/compute-proof/*.receipt.json + compute-proof.test.mjs).
// ───────────────────────────────────────────────────────────────────────────────────────────────────────

const { G1, G2, fields, pairingBatch } = bn254;
const Fp12 = fields.Fp12;

// risc0 default verifier parameters (v3.0.x), as 32-byte digests (Digest::as_bytes order).
const CONTROL_ROOT_HEX   = 'a54dc85ac99f851c92d7c96d7318af41dbe7c0194edfcc37eb4d422a998c1f56';
const BN254_CONTROL_ID_HEX = 'c07a65145c3cb48b6101962ea607a4dd93c753bb26975cb47feb00d3666e4404';

// risc0 Groth16 verifying key (decimal field coordinates).
const VK = {
  alpha: ['20491192805390485299153009773594534940189261866228447918068658471970481763042',
          '9383485363053290200918347156157836566562967994039712273449902621266178545958'],
  // beta/gamma/delta G2: [x.c0, x.c1, y.c0, y.c1] in noble Fp2 {c0,c1} convention.
  beta:  ['6375614351688725206403948262868962793625744043794305715222011528459656738731',
          '4252822878758300859123897981450591353533073413197771768651442665752259397132',
          '10505242626370262277552901082094356697409835680220590971873171140371331206856',
          '21847035105528745403288232691147584728191162732299865338377159692350059136679'],
  gamma: ['10857046999023057135944570762232829481370756359578518086990519993285655852781',
          '11559732032986387107991004021392285783925812861821192530917403151452391805634',
          '8495653923123431417604973247489272438418190587263600148770280649306958101930',
          '4082367875863433681332203403145435568316851327593401208105741076214120093531'],
  delta: ['12043754404802191763554326994664886008979042643626290185762540825416902247219',
          '1668323501672964604911431804142266013250380587483576094566949227275849579036',
          '13740680757317479711909903993315946540841369848973133181051452051592786724563',
          '7710631539206257456743780535472368339139328733484942210876916214502466455394'],
  IC: [
    ['8446592859352799428420270221449902464741693648963397251242447530457567083492','1064796367193003797175961162477173481551615790032213185848276823815288302804'],
    ['3179835575189816632597428042194253779818690147323192973511715175294048485951','20895841676865356752879376687052266198216014795822152491318012491767775979074'],
    ['5332723250224941161709478398807683311971555792614491788690328996478511465287','21199491073419440416471372042641226693637837098357067793586556692319371762571'],
    ['12457994489566736295787256452575216703923664299075106359829199968023158780583','19706766271952591897761291684837117091856807401404423804318744964752784280790'],
    ['19617808913178163826953378459323299110911217259216006187355745713323154132237','21663537384585072695701846972542344484111393047775983928357046779215877070466'],
    ['6834578911681792552110317589222010969491336870276623105249474534788043166867','15060583660288623605191393599883223885678013570733629274538391874953353488393'],
  ],
};

const enc = (s) => new TextEncoder().encode(s);
const hexToBytes = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const intBE = (b) => b.reduce((a, x) => (a << 8n) + BigInt(x), 0n);
const intLE = (b) => intBE(Uint8Array.from(b).reverse());
const u32le = (n) => Uint8Array.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
const u16le = (n) => Uint8Array.from([n & 0xff, (n >> 8) & 0xff]);
const concat = (arrs) => { const t = []; for (const a of arrs) for (const b of a) t.push(b); return Uint8Array.from(t); };
const ZERO32 = new Uint8Array(32);

// risc0 tagged_struct: sha256( sha256(tag) || down... || data(LE u32)... || u16le(down.len) ).
function taggedStruct(tag, down, data) {
  return sha256(concat([sha256(enc(tag)), ...down, ...data.map(u32le), u16le(down.length)]));
}

// risc0 ReceiptClaim::ok(image_id, journal).digest() — the claim a halted-0, no-assumptions receipt commits.
function claimDigestOk(imageIdBytes, journalBytes) {
  const post = taggedStruct('risc0.SystemState', [ZERO32], [0]);                 // {pc:0, merkle_root:ZERO}
  const output = taggedStruct('risc0.Output', [sha256(journalBytes), ZERO32], []); // assumptions Pruned(ZERO)
  return taggedStruct('risc0.ReceiptClaim', [ZERO32, imageIdBytes, post, output], [0, 0]); // input ZERO, exit (0,0)
}

// split_digest(d) -> [Fr(low 16B), Fr(high 16B)] (big-endian interpretation).
function splitDigest(bytes32) {
  const be = Uint8Array.from(bytes32).reverse();
  return [intBE(be.slice(16, 32)), intBE(be.slice(0, 16))];
}

const g1 = ([x, y]) => G1.Point.fromAffine({ x: BigInt(x), y: BigInt(y) });
const g2 = ([x0, x1, y0, y1]) => G2.Point.fromAffine({ x: { c0: BigInt(x0), c1: BigInt(x1) }, y: { c0: BigInt(y0), c1: BigInt(y1) } });

/**
 * §18.1 — verify a risc0 Groth16-BN254 receipt's cryptographic seal, self-contained and chain-free.
 *
 * receipt: the §18 compute_proof object { receiptFormat:'groth16-bn254', imageId:'sha256:..',
 *          seal:<base64 256B>, journal:{ chaingraph_version, kernel_digest, output } }.
 * Returns true iff the Groth16 proof verifies for the ReceiptClaim derived from (imageId, canonical journal).
 * Throws (delegated) for receiptFormat:'stark'. Returns false on any structural problem or invalid proof.
 */
export function verifySeal(receipt) {
  const cp = receipt;
  if (!cp || typeof cp !== 'object') return false;
  if (cp.receiptFormat === 'stark') {
    throw new Error('§18.1: stark seal verification is DELEGATED to the vendor verifier (e.g. risc0-verifier); ' +
      'OCG ships only the self-contained BN254 Groth16 reference verifier for receiptFormat:"groth16-bn254".');
  }
  if (cp.receiptFormat !== 'groth16-bn254') return false;
  if (typeof cp.imageId !== 'string' || typeof cp.seal !== 'string') return false;
  if (!cp.journal || typeof cp.journal !== 'object') return false;

  // 1. canonical journal bytes the guest committed = utf8(JCS(journal object)).
  const journalBytes = enc(JSON.stringify(cgCanon(cp.journal)));
  // 2. image id digest bytes.
  const imageIdBytes = hexToBytes(normId(cp.imageId).slice('sha256:'.length));
  if (imageIdBytes.length !== 32) return false;
  // 3. risc0 ReceiptClaim digest + 5 public inputs.
  const claimDigest = claimDigestOk(imageIdBytes, journalBytes);
  const [a0, a1] = splitDigest(hexToBytes(CONTROL_ROOT_HEX));
  const [c0, c1] = splitDigest(claimDigest);
  const idBn254 = intLE(hexToBytes(BN254_CONTROL_ID_HEX));
  const pub = [a0, a1, c0, c1, idBn254];

  // 4. parse the 256-byte seal -> A (G1), B (G2), C (G1). Each 32-byte element is big-endian.
  let seal;
  try { seal = Uint8Array.from(atob(cp.seal), (ch) => ch.charCodeAt(0)); } catch { return false; }
  if (seal.length !== 256) return false;
  let A, B, C, vkx;
  try {
    A = G1.Point.fromAffine({ x: intBE(seal.slice(0, 32)), y: intBE(seal.slice(32, 64)) });
    B = G2.Point.fromAffine({
      x: { c0: intBE(seal.slice(96, 128)), c1: intBE(seal.slice(64, 96)) },
      y: { c0: intBE(seal.slice(160, 192)), c1: intBE(seal.slice(128, 160)) },
    });
    C = G1.Point.fromAffine({ x: intBE(seal.slice(192, 224)), y: intBE(seal.slice(224, 256)) });
    A.assertValidity(); B.assertValidity(); C.assertValidity();
    // 5. vk_x = IC0 + Σ pub_i·IC[i+1].
    const IC = VK.IC.map(g1);
    vkx = IC[0];
    for (let i = 0; i < pub.length; i++) vkx = vkx.add(IC[i + 1].multiply(pub[i]));
  } catch { return false; }

  // 6. pairing equation.
  try {
    const gt = pairingBatch([
      { g1: A, g2: B },
      { g1: g1(VK.alpha).negate(), g2: g2(VK.beta) },
      { g1: vkx.negate(), g2: g2(VK.gamma) },
      { g1: C.negate(), g2: g2(VK.delta) },
    ]);
    return Fp12.eql(gt, Fp12.ONE);
  } catch { return false; }
}
