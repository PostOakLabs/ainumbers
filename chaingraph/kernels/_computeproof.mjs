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

import { jcsStringify } from './_hash.mjs';
import { bn254, sha256 } from './_noble-bn254.bundle.mjs';

// JCS-canonical compare (same canonicalizer as §4 — no second canonicalization path).
const canon = (o) => jcsStringify((o ?? null));

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

// ── Default engagement for the kernel_digest leg (VERIFYBINDING-DIGEST-DEFAULT-1, 2026-11-12) ──
// The leg engages BY DEFAULT against the PUBLISHED kernel digests armed here, so a verifier that
// forgets to pass a list still binds a receipt to the kernel that made it. Arming is a process-
// level decision the VERIFIER owns: browser verifiers load the published digest file the site
// serves (chaingraph/kernel-digests.json, derived on main from the node shards' sha256-source
// compute_images) and arm it via setDefaultPublishedKernelDigests(). The param keeps two explicit
// escapes for offline callers:
//   publishedKernelDigests: null  -- the OPT-OUT: the leg is NOT engaged, whatever is armed
//                                   (isolated verification with no published source keeps working);
//   publishedKernelDigests: [..]  -- an explicit list WINS over the armed default (the previous
//                                   behavior for supplied lists; an EMPTY array is engaged with
//                                   nothing published, i.e. fail-closed -- use null to switch off).
// With NOTHING armed and no param passed, a bare call keeps the legacy shape (leg not engaged), so
// every existing predicate caller is unchanged until a verifier arms a list. SO #34 discipline is
// unchanged: the armed list comes from published source, never from the receipt under test.
let DEFAULT_PUBLISHED_KERNEL_DIGESTS = null;

export function setDefaultPublishedKernelDigests(list) {
  // A non-array arm is a caller bug: arm NOTHING rather than half-engage (null re-arms to unarmed).
  DEFAULT_PUBLISHED_KERNEL_DIGESTS = Array.isArray(list) ? list.map(normId) : null;
}

// Which list the leg uses for THIS call: explicit array > armed published default > not engaged.
function digestLegFor(publishedKernelDigests) {
  if (publishedKernelDigests === null) return { engaged: false, mode: 'off' };
  if (Array.isArray(publishedKernelDigests)) return { engaged: true, mode: 'explicit', digests: publishedKernelDigests.map(normId) };
  if (DEFAULT_PUBLISHED_KERNEL_DIGESTS) return { engaged: true, mode: 'published-default', digests: DEFAULT_PUBLISHED_KERNEL_DIGESTS };
  return { engaged: false, mode: 'unarmed' };
}

/**
 * §18.0/§18.1 BINDING check. Returns boolean (predicate — false on any structural/binding problem).
 * Checks: object shape (type/system/receiptFormat/imageId/seal/journal); journal binds output_payload
 * (journal.output JCS-equals artifact.output_payload); imageId published in the Graph Index
 * (node.compute_images[].image_id) when publishedImageIds is supplied; journal.kernel_digest matches the
 * node's published kernel identity (node.compute_images[].sha256_source / the Graph Index) when
 * publishedKernelDigests is supplied.
 *
 * SO #34: the digests supplied via publishedKernelDigests must be KNOWN FROM PUBLISHED SOURCE (recomputed
 * from the kernel bytes, or read from the Graph Index) — NEVER copied out of the receipt under test.
 * Param semantics (VERIFYBINDING-DIGEST-DEFAULT-1): an explicit ARRAY engages the leg with that list;
 * null is the explicit opt-out (leg not engaged, offline callers); ABSENT engages the leg against the
 * armed published default when setDefaultPublishedKernelDigests() has armed one (browser verifiers arm
 * the served digest file) and otherwise keeps the legacy bare-call shape (leg not engaged). Engaged leg +
 * missing journal.kernel_digest = FAIL (absence is not a pass, SO #34c). verifyBindingReport() says
 * which mode ran.
 *
 * @param {object} artifact the artifact under test
 * @param {object} [options]
 * @param {any[]} [options.publishedImageIds] published program identities for the node (Graph Index
 *   compute_images); empty or absent skips the imageId membership leg
 * @param {any[] | null} [options.publishedKernelDigests] published kernel digests: an array engages the
 *   digest leg with that list; null opts out; ABSENT engages the armed published default when one is
 *   armed and otherwise keeps the leg off
 * @returns {boolean} true when every engaged check passes
 *
 * Does NOT verify the cryptographic seal — use verifySeal() for that. A green binding means "this receipt
 * is well-formed and is ABOUT this artifact's output, by this published program"; the seal proves the
 * program actually produced it.
 */
export function verifyBinding(artifact, { publishedImageIds = [], publishedKernelDigests } = {}) {
  return verifyBindingReport(artifact, { publishedImageIds, publishedKernelDigests }).ok;
}

/**
 * The same binding check as verifyBinding, with the result SAYING WHICH MODE RAN (the boolean
 * predicate cannot carry it, and a verifier page must be able to state which check it ran —
 * VERIFYBINDING-DIGEST-DEFAULT-1). Returns { ok, digestLeg } with digestLeg:
 *   'published-default' — engaged against the armed published list;
 *   'explicit'          — engaged against the caller's own array;
 *   'off'               — explicit publishedKernelDigests: null opt-out;
 *   'unarmed'           — no param passed and no list armed (the legacy bare-call shape).
 *
 * @param {object} artifact the artifact under test
 * @param {object} [options]
 * @param {any[]} [options.publishedImageIds] published program identities for the node (Graph Index
 *   compute_images); empty or absent skips the imageId membership leg
 * @param {any[] | null} [options.publishedKernelDigests] published kernel digests: an array engages the
 *   digest leg with that list; null opts out; ABSENT engages the armed published default when one is
 *   armed and otherwise keeps the leg off
 * @returns {{ ok: boolean, digestLeg: string }} the verdict plus the mode that ran
 */
export function verifyBindingReport(artifact, { publishedImageIds = [], publishedKernelDigests } = {}) {
  const leg = digestLegFor(publishedKernelDigests);
  const cp = artifact?.audit_signature?.compute_proof;
  if (!cp || typeof cp !== 'object') return { ok: false, digestLeg: leg.mode };
  if (cp.type !== 'ZkVmReceipt') return { ok: false, digestLeg: leg.mode };
  if (typeof cp.system !== 'string' || !cp.system) return { ok: false, digestLeg: leg.mode };
  if (!RECEIPT_FORMATS.has(cp.receiptFormat)) return { ok: false, digestLeg: leg.mode };
  if (typeof cp.imageId !== 'string' || !cp.imageId) return { ok: false, digestLeg: leg.mode };
  if (typeof cp.seal !== 'string' || !cp.seal) return { ok: false, digestLeg: leg.mode };
  if (!cp.journal || typeof cp.journal !== 'object') return { ok: false, digestLeg: leg.mode };
  // §18.0: the journal's committed output MUST equal the artifact output_payload.
  if (!('output' in cp.journal)) return { ok: false, digestLeg: leg.mode };
  if (canon(cp.journal.output) !== canon(artifact.output_payload)) return { ok: false, digestLeg: leg.mode };
  // §18.1: imageId must be a published program identity for this node.
  if (publishedImageIds.length && !publishedImageIds.map(normId).includes(normId(cp.imageId))) return { ok: false, digestLeg: leg.mode };
  // §17/§18: when the digest leg is ENGAGED (explicit list, or the armed published default), the
  // receipt's kernel_digest must match the node's published kernel identity (the CI gate's
  // cross-check, mirrored; most receipts share one universal guest imageId, so imageId alone does
  // not bind a receipt to one tool's kernel).
  if (leg.engaged) {
    if (typeof cp.journal.kernel_digest !== 'string' || !cp.journal.kernel_digest) return { ok: false, digestLeg: leg.mode };
    if (!leg.digests.includes(normId(cp.journal.kernel_digest))) return { ok: false, digestLeg: leg.mode };
  }
  return { ok: true, digestLeg: leg.mode };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────────
// §18.1 — self-contained BN254 Groth16 reference verifier for receiptFormat:"groth16-bn254".
//
// Verifies a risc0 Groth16 receipt: reconstructs the ReceiptClaim digest from (imageId, journal) via risc0's
// tagged-struct hashing, derives the 5 Groth16 public inputs (split control_root + claim_digest, bn254 control
// id), and checks e(A,B)·e(-α,β)·e(-vk_x,γ)·e(-C,δ) == 1 against the published risc0 verifying key.
//
// TWO parameter sets (RISC0-310-R4-DUAL-VERIFIER-1), chosen by the receipt's imageId from two CLOSED
// allowlists; an imageId in neither list is 'invalid' before any pairing runs:
//   CURRENT — risc0 v3.1.0 verifier parameters (receipts sealed by the 3.1.0 guests).
//   LEGACY  — risc0 v3.0.x verifier parameters (receipts sealed before the 3.1.0 re-seal).
// Each set: VK — risc0-groth16 verifier.rs (Groth16Verifier.sol ceremony output); CONTROL_ROOT /
// BN254_CONTROL_ID — risc0-circuit-recursion control_id (Groth16ReceiptVerifierParameters::default).
// A LEGACY verdict means "not yet re-sealed" and is never evidence on its own: gates that need evidence
// accept only 'current' (verifySealReport). verifySeal() keeps its boolean contract and returns true for
// a pairing that holds under the set the imageId selects.
// Cross-validated: this verifier ACCEPTS real RISC0_DEV_MODE=0 receipts under each set and REJECTS a
// tampered seal / wrong journal / crossed set (kernels/fixtures/compute-proof/*.receipt.json,
// kernels/fixtures/compute-proof-310/, compute-proof.test.mjs, scripts/dual-verifier.test.mjs).
// ───────────────────────────────────────────────────────────────────────────────────────────────────────

const { G1, G2, fields, pairingBatch } = bn254;
const Fp12 = fields.Fp12;

// Closed allowlists ('sha256:' + 64 lowercase hex). LEGACY = every risc0 guest image the 3.0.x estate
// published (universal, privin, privinjs, art-04 slice, art-201, composed chain receipt, art-649).
export const LEGACY_IMAGE_IDS = Object.freeze([
  'sha256:a1a0bc89b5b1febaeda3519f6dbade0fa5ac16beeb143c4e1b01689573567bc6',
  'sha256:6e5e88398691bb947308966a4df0019cfa1fc5894578c02f270320f1327ea8ac',
  'sha256:adf39b5c4e8fe19f9dbc25e2b8eb84090f0ee6c9370f14ad10d5039e8e65b0ec',
  'sha256:93c746e79afcf4b27f6d2a6da6cd142a4dd0da31f33d942f92b97344188526c5',
  'sha256:33ac2853cd94704e42ceeab58625f396f74ef3286fa96d1a744d82c1167b7ca5',
  'sha256:7908d47bb4367f3c11a4b906405113bad0a071ccfe5c5587455ad3132738911f',
  'sha256:6548edabfc00736df6b3fa5954a8ac8a68df0855fbb5078f10c5916db9d5ac14',
]);
// CURRENT = the risc0 3.1.0 guest images (universal, privin, privinjs, art-04 slice, art-201, art-371,
// art-124, art-699).
export const CURRENT_IMAGE_IDS = Object.freeze([
  'sha256:bc07da19c899768781e91e439961b7c4da40bb103fcedba161f93fb5ccaa6d68',
  'sha256:ac3a298fcd811bc61e673fe5cfc04389cc1a17e15c6fe1c64881f2d25125d6f0',
  'sha256:64e63b2e26119983ca729084d2997533a25e2b6c31058d9a069687a8f1e3e1e5',
  'sha256:90e562f44b674ec74e47f33ce510052559db7b4fd40c93cd697db4f6b932888d',
  'sha256:e9ce36038e28758b5a6d9e9ee8b3242808d0e8411ba09b4d5bde2d330d6c14ef',
  'sha256:f34f846d804810d19822593f58bff32aef290708a513bea42e76b89cfcfc60ef',
  'sha256:541eb5581930c48777c5e39ac215b66d3ebc61ea8ede5da56d06be18fd7cf3a8',
  'sha256:884b4f9546ad533db8b24fedd60de5901b5960ef2ac48d1c9a81ec9ac0c77222',
]);

/** Which parameter set an imageId selects: 'current', 'legacy', or null (in neither allowlist). */
export function sealParameterSet(imageId) {
  if (typeof imageId !== 'string' || !imageId) return null;
  const id = normId(imageId);
  if (CURRENT_IMAGE_IDS.includes(id)) return 'current';
  if (LEGACY_IMAGE_IDS.includes(id)) return 'legacy';
  return null;
}

// risc0 v3.1.0 default verifier parameters, as 32-byte digests (Digest::as_bytes order).
const CURRENT_CONTROL_ROOT_HEX   = 'e6feef13db7aed4a731c7b0852de1f5c89b137726073f625d05333184d3a551d';
const CURRENT_BN254_CONTROL_ID_HEX = 'de81d091ba14062acb5023b3b36deee95624e3fd47475cb7ff64aed5f9eac20a';

// risc0 v3.1.0 Groth16 verifying key (decimal field coordinates).
const CURRENT_VK = {
  alpha: ['16428432848801857252194528405604668803277877773566238944394625302971855135431',
          '16846502678714586896801519656441059708016666274385668027902869494772365009666'],
  // beta/gamma/delta G2: [x.c0, x.c1, y.c0, y.c1] in noble Fp2 {c0,c1} convention.
  beta:  ['16348171800823588416173124589066524623406261996681292662100840445103873053252',
          '3182164110458002340215786955198810119980427837186618912744689678939861918171',
          '19687132236965066906216944365591810874384658708175106803089633851114028275753',
          '4920802715848186258981584729175884379674325733638798907835771393452862684714'],
  gamma: ['10857046999023057135944570762232829481370756359578518086990519993285655852781',
          '11559732032986387107991004021392285783925812861821192530917403151452391805634',
          '8495653923123431417604973247489272438418190587263600148770280649306958101930',
          '4082367875863433681332203403145435568316851327593401208105741076214120093531'],
  delta: ['15776672394616990683767400715354533957990327248900631669473166016258279232588',
          '15616655295497688016920922285786248029410410634174255119755032442279507261612',
          '6666730711543397578682474175129345128534747409410156889826997147291122518312',
          '15603769682755083227316504195454390494226357053638046843688553601570183264395'],
  IC: [
    ['18663918579753010382002747204100316475180663666125247285366810668134508578264','17189072794432247265173990289507014998311702955803346313941168113828133843434'],
    ['10995657406716404592042449088731908804822551193011116024160605390904112699922','16840054500543522560166231854936072122401577171365452702445604851845250658027'],
    ['17223746139751910493708334502747005647365937123243899090309734281916083451762','4092210736358501801028887881307062309243791997444282548134854129284894411044'],
    ['3765213192101990618643617040373059738050185238026301923348610794767426428033','12210223264334159465299028585581460715942724522871187397965100355295734194591'],
    ['10211980968769599651826920300372241897389214017084266564307091587192484525770','6627619408770540710319105693121261544533216204749218194792386277379533604252'],
    ['13454640350766589059799184485082639692652215534373479852236969801352010275184','8731676129773990833613417922371950977268622282768299686490610454524284784606'],
  ],
};

// risc0 v3.0.x default verifier parameters (LEGACY), as 32-byte digests (Digest::as_bytes order).
const LEGACY_CONTROL_ROOT_HEX   = 'a54dc85ac99f851c92d7c96d7318af41dbe7c0194edfcc37eb4d422a998c1f56';
const LEGACY_BN254_CONTROL_ID_HEX = 'c07a65145c3cb48b6101962ea607a4dd93c753bb26975cb47feb00d3666e4404';

// risc0 v3.0.x Groth16 verifying key (LEGACY; decimal field coordinates).
const LEGACY_VK = {
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

const SEAL_PARAMS = {
  current: { controlRootHex: CURRENT_CONTROL_ROOT_HEX, bn254ControlIdHex: CURRENT_BN254_CONTROL_ID_HEX, vk: CURRENT_VK },
  legacy:  { controlRootHex: LEGACY_CONTROL_ROOT_HEX,  bn254ControlIdHex: LEGACY_BN254_CONTROL_ID_HEX,  vk: LEGACY_VK },
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
 * Returns true iff the Groth16 proof verifies for the ReceiptClaim derived from (imageId, canonical journal)
 * under the parameter set the imageId selects (CURRENT or LEGACY). Throws (delegated) for
 * receiptFormat:'stark'. Returns false on any structural problem, an imageId in neither allowlist, or an
 * invalid proof. Use verifySealReport() to learn WHICH set verified it.
 */
export function verifySeal(receipt) {
  return verifySealReport(receipt) !== 'invalid';
}

/**
 * Three-way seal verdict: 'current' (pairing holds under the risc0 3.1.0 set, imageId in CURRENT_IMAGE_IDS),
 * 'legacy' (pairing holds under the risc0 3.0.x set, imageId in LEGACY_IMAGE_IDS; NOT evidence, "not yet
 * re-sealed"), or 'invalid' (anything else, including an imageId in neither list, decided before pairing).
 * Throws (delegated) for receiptFormat:'stark', like verifySeal().
 *
 * @param {object} receipt the §18 compute_proof object
 * @returns {'current' | 'legacy' | 'invalid'}
 */
export function verifySealReport(receipt) {
  const cp = receipt;
  if (!cp || typeof cp !== 'object') return 'invalid';
  if (cp.receiptFormat === 'stark') {
    throw new Error('§18.1: stark seal verification is DELEGATED to the vendor verifier (e.g. risc0-verifier); ' +
      'OCG ships only the self-contained BN254 Groth16 reference verifier for receiptFormat:"groth16-bn254".');
  }
  if (cp.receiptFormat !== 'groth16-bn254') return 'invalid';
  if (typeof cp.imageId !== 'string' || typeof cp.seal !== 'string') return 'invalid';
  if (!cp.journal || typeof cp.journal !== 'object') return 'invalid';
  // 0. closed allowlist: the imageId picks the parameter set, or the receipt is invalid before any pairing.
  const set = sealParameterSet(cp.imageId);
  if (!set) return 'invalid';
  return sealPairingHolds(cp, SEAL_PARAMS[set]) ? set : 'invalid';
}

function sealPairingHolds(cp, P) {
  // 1. canonical journal bytes the guest committed = utf8(JCS(journal object)).
  const journalBytes = enc(jcsStringify((cp.journal)));
  // 2. image id digest bytes.
  const imageIdBytes = hexToBytes(normId(cp.imageId).slice('sha256:'.length));
  if (imageIdBytes.length !== 32) return false;
  // 3. risc0 ReceiptClaim digest + 5 public inputs.
  const claimDigest = claimDigestOk(imageIdBytes, journalBytes);
  const [a0, a1] = splitDigest(hexToBytes(P.controlRootHex));
  const [c0, c1] = splitDigest(claimDigest);
  const idBn254 = intLE(hexToBytes(P.bn254ControlIdHex));
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
    const IC = P.vk.IC.map(g1);
    vkx = IC[0];
    for (let i = 0; i < pub.length; i++) vkx = vkx.add(IC[i + 1].multiply(pub[i]));
  } catch { return false; }

  // 6. pairing equation.
  try {
    const gt = pairingBatch([
      { g1: A, g2: B },
      { g1: g1(P.vk.alpha).negate(), g2: g2(P.vk.beta) },
      { g1: vkx.negate(), g2: g2(P.vk.gamma) },
      { g1: C.negate(), g2: g2(P.vk.delta) },
    ]);
    return Fp12.eql(gt, Fp12.ONE);
  } catch { return false; }
}
