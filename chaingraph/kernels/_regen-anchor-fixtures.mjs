// _regen-anchor-fixtures.mjs — one-shot generator for the §20 Anchor Binding gate fixtures
// (fixtures/anchor-binding.fixture.json). NETWORK SCRIPT — run locally when (re)building the
// fixture; the gate itself (anchor-binding.test.mjs) is 100% offline and CI never runs this.
//
//   node chaingraph/kernels/_regen-anchor-fixtures.mjs [--ots <path-to-hello-world.txt.ots>] \
//        [--ots-txt <path-to-hello-world.txt>]
//
// Produces four evidence fixtures around ONE deterministic artifact (art-04, pinned inputs):
//   rfc3161  — a REAL TimeStampToken from FreeTSA (https://freetsa.org/tsr) over the artifact's
//              execution_hash, stored as verbatim DER; the FreeTSA root CA is pinned alongside.
//   ots      — the canonical completed OpenTimestamps vector (hello-world.txt.ots, Bitcoin block
//              358391) + the pinned block merkle root, so verification is offline forever.
//   c2sp     — a c2sp.org/tlog-proof@v1 text bundle for a 4-leaf TEST log: pinned TEST log key +
//              2 test cosigners (per the v0.7 delta: not blocked on any live log — test keys only).
//   scitt    — an RFC 9942 COSE receipt (COSE_Sign1, vds=RFC9162_SHA256) under a pinned test key.
//
// Leaf rule for the two Merkle evidences (application-specific per c2sp.org/tlog-proof):
//   leaf data = the ASCII bytes of anchored_hash ("sha256:<64 hex>"); leaf hash = RFC 6962 leafHash.
import { readFileSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArtifact } from './art-04-agent-identity-attestation-checker.kernel.mjs';
import {
  sha256, derRead, derChildrenOf, derOidToString, derSeq, derOid, derNull, derOctet, derBool, derInt,
  cborEncode, CborTag, leafHash, mth, auditPath, publicKeyToRaw, signNote, cosignV1,
} from './_anchor-testutil.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'fixtures', 'anchor-binding.fixture.json');

const argOf = (flag, dflt) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : dflt; };

// ── 1. deterministic fixture artifact (same PP family as the §16 suite) ─────────────────────────
const PP = {
  credential: {
    credential_type: 'AgentCredential', agent_id: 'a1', issuer: 'did:key:zStub',
    issued_at: 1, expires_at: 4102444800, scopes: ['read:account'], signature: 'ed25519:zz',
  },
  validate_at_unix: 1750000000,
  requester_context: 'anchor-binding-gate-fixture',
};
const artifact = await buildArtifact(PP, { now: '2026-07-02T00:00:00Z' });
const anchoredHash = 'sha256:' + artifact.execution_hash;
const hashBytes = Buffer.from(artifact.execution_hash, 'hex');
console.log('fixture artifact execution_hash:', artifact.execution_hash);

// §1 v0.7 rider exercised in the same fixture: the artifact declares it supersedes a prior run.
artifact.supersedes = ['sha256:' + 'ab'.repeat(32)];

// ── 2. rfc3161 — REAL TST from FreeTSA over the execution_hash ──────────────────────────────────
// TimeStampReq: { version 1, messageImprint { sha256, hash }, certReq TRUE } (no nonce — determinism).
const SHA256_OID = '2.16.840.1.101.3.4.2.1';
const tsq = derSeq(
  derInt(1),
  derSeq(derSeq(derOid(SHA256_OID), derNull()), derOctet(hashBytes)),
  derBool(true),
);
console.log('requesting TST from FreeTSA…');
const resp = await fetch('https://freetsa.org/tsr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/timestamp-query' },
  body: tsq,
});
if (!resp.ok) throw new Error(`FreeTSA HTTP ${resp.status}`);
const tsr = Buffer.from(await resp.arrayBuffer());

// TimeStampResp = SEQ { status PKIStatusInfo, timeStampToken ContentInfo OPTIONAL }
const respSeq = derRead(tsr, 0);
const [statusInfo, tokenNode] = derChildrenOf(tsr, respSeq);
const statusVal = derChildrenOf(tsr, statusInfo)[0];
const status = statusVal.content[0];
if (status !== 0 && status !== 1) throw new Error(`TSA status ${status} (not granted)`);
if (!tokenNode) throw new Error('TSA response has no timeStampToken');
const tstDer = Buffer.from(tokenNode.raw); // ContentInfo — stored VERBATIM (§20)

// Walk into SignedData for TSTInfo members + embedded certs (certReq TRUE).
function parseTst(der) {
  const ci = derRead(der, 0);
  const [oidNode, explicit0] = derChildrenOf(der, ci);
  if (derOidToString(oidNode.content) !== '1.2.840.113549.1.7.2') throw new Error('not CMS SignedData');
  const signedData = derChildrenOf(der, explicit0)[0];
  const kids = derChildrenOf(der, signedData);
  // version, digestAlgorithms, encapContentInfo, [0] certs (optional), [1] crls (optional), signerInfos
  const encap = kids[2];
  const encapKids = derChildrenOf(der, encap);
  if (derOidToString(encapKids[0].content) !== '1.2.840.113549.1.9.16.1.4') throw new Error('eContentType is not id-ct-TSTInfo');
  const tstInfoOctets = derRead(der, encapKids[1].start); // the OCTET STRING inside [0] EXPLICIT
  const tstInfoDer = tstInfoOctets.content;
  const tstInfo = derRead(tstInfoDer, 0);
  const t = derChildrenOf(tstInfoDer, tstInfo);
  // TSTInfo: version, policy OID, messageImprint, serialNumber, genTime, …
  const policyOid = derOidToString(t[1].content);
  const imprint = derChildrenOf(tstInfoDer, t[2]);
  const hashed = imprint[1].content;
  const serial = BigInt('0x' + Buffer.from(t[3].content).toString('hex')).toString(10);
  const genTime = t[4].content.toString('ascii');
  const certs = [];
  for (const k of kids) {
    if (k.tag === 0xa0) for (const c of derChildrenOf(der, k)) certs.push(Buffer.from(c.raw).toString('base64'));
  }
  return { policyOid, hashed, serial, genTime, certs };
}
const tst = parseTst(tstDer);
if (!Buffer.from(tst.hashed).equals(hashBytes)) throw new Error('TSA messageImprint != execution_hash');
console.log(`TST granted: policy=${tst.policyOid} serial=${tst.serial} genTime=${tst.genTime} certs=${tst.certs.length}`);

const freetsaRootPem = readFileSync(argOf('--freetsa-root', join(HERE, '..', '..', '..', '..', 'freetsa-cacert.pem')), 'utf8');

const rfc3161Binding = {
  type: 'rfc3161-tst',
  anchored_hash: anchoredHash,
  log_origin: 'https://freetsa.org/tsr',
  proof: tstDer.toString('base64'),
  policy_oid: tst.policyOid,
  serial: tst.serial,
  gen_time: tst.genTime,
  signer_cert_chain_b64: tst.certs,
};

// ── 3. OTS — canonical completed vector (hello-world.txt.ots, Bitcoin block 358391) ─────────────
const otsPath = argOf('--ots', null);
if (!otsPath) throw new Error('pass --ots <path-to-hello-world.txt.ots>');
const otsBytes = readFileSync(otsPath);
const otsTxt = readFileSync(argOf('--ots-txt', join(dirname(otsPath), 'hello-world.txt')));
const otsVector = {
  note: 'Canonical completed OpenTimestamps vector (opentimestamps/javascript-opentimestamps examples/hello-world.txt.ots). Complete proofs verify against Bitcoin block headers alone (§20). The op-chain result is the block merkle root in internal byte order.',
  ots_b64: otsBytes.toString('base64'),
  file_sha256: sha256(otsTxt).toString('hex'),
  bitcoin_height: 358391,
  // Pinned trust anchor: block 358391 merkle root (display order, blockstream.info, fetched + pinned 2026-07-02).
  merkle_root_display: '8a1b66ecb7cbd07d8139a7e7d7f2c41aab1f5009b8364aaf61d03ad245e47e00',
  binding: {
    type: 'opentimestamps',
    anchored_hash: 'sha256:03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340',
    log_origin: 'bitcoin:358391 (via OpenTimestamps calendars)',
    proof: otsBytes.toString('base64'),
  },
};
if (otsVector.file_sha256 !== '03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340') {
  throw new Error('hello-world.txt sha256 mismatch — wrong vector file');
}

// ── 4. c2sp tlog-proof@v1 — pinned TEST log key + 2 test cosigners ───────────────────────────────
const LOG_NAME = 'ainumbers.co/ocg-test-log';
const W1 = 'witness-1.ocg.test';
const W2 = 'witness-2.ocg.test';
const COSIG_TIME = 1751414400; // 2026-07-02T00:00:00Z, pinned
const logKp = generateKeyPairSync('ed25519');
const w1Kp = generateKeyPairSync('ed25519');
const w2Kp = generateKeyPairSync('ed25519');

const leaves = [
  leafHash(Buffer.from('ocg-test-leaf-0', 'utf8')),
  leafHash(Buffer.from('ocg-test-leaf-1', 'utf8')),
  leafHash(Buffer.from(anchoredHash, 'utf8')),      // index 2 — the leaf committing anchored_hash
  leafHash(Buffer.from('ocg-test-leaf-3', 'utf8')),
];
const LEAF_INDEX = 2;
const root = mth(leaves);
const path = auditPath(LEAF_INDEX, leaves);

const checkpointBody = `${LOG_NAME}\n${leaves.length}\n${root.toString('base64')}\n`;
const logSigLine = signNote(checkpointBody, LOG_NAME, logKp.privateKey, publicKeyToRaw(logKp.publicKey));
const w1Line = cosignV1(checkpointBody, W1, w1Kp.privateKey, publicKeyToRaw(w1Kp.publicKey), COSIG_TIME);
const w2Line = cosignV1(checkpointBody, W2, w2Kp.privateKey, publicKeyToRaw(w2Kp.publicKey), COSIG_TIME);
const checkpoint = checkpointBody + '\n' + logSigLine + '\n' + w1Line + '\n' + w2Line + '\n';

// c2sp.org/tlog-proof@v1 bundle: header, index line, proof hashes (one base64 per line,
// leaf sibling upward), blank line, checkpoint verbatim.
const tlogProof = [
  'c2sp.org/tlog-proof@v1',
  `index ${LEAF_INDEX}`,
  ...path.map((h) => h.toString('base64')),
  '',
  checkpoint,
].join('\n');

const c2spBinding = {
  type: 'c2sp-tlog-proof-v1',
  anchored_hash: anchoredHash,
  log_origin: LOG_NAME,
  proof: tlogProof,
};

// ── 5. scitt-receipt-rfc9942 — COSE_Sign1 receipt (vds = RFC9162_SHA256) under a test key ────────
const scittKp = generateKeyPairSync('ed25519');
const SCITT_TREE_SIZE = leaves.length;
// protected: { alg(1): EdDSA(-8), vds(395): 1 (RFC9162_SHA256) }
const protectedHeader = cborEncode(new Map([[1, -8], [395, 1]]));
// unprotected: { vdp(396): { inclusion-proof(-1): [ bstr .cbor [size, index, [path…]] ] } }
const inclusionProof = cborEncode([SCITT_TREE_SIZE, LEAF_INDEX, path.map((h) => Buffer.from(h))]);
// payload detached (nil); to-be-signed payload = the reconstructed tree root.
const sigStructure = cborEncode(['Signature1', protectedHeader, Buffer.alloc(0), Buffer.from(root)]);
const { ed25519Sign } = await import('./_anchor-testutil.mjs');
const scittSig = ed25519Sign(sigStructure, scittKp.privateKey);
const coseSign1 = cborEncode(new CborTag(18, [
  protectedHeader,
  new Map([[396, new Map([[-1, [inclusionProof]]])]]),
  null,
  scittSig,
]));
const scittBinding = {
  type: 'scitt-receipt-rfc9942',
  anchored_hash: anchoredHash,
  log_origin: 'urn:ocg:test:scitt-transparency-service',
  proof: coseSign1.toString('base64'),
};

// ── 6. assemble + write ──────────────────────────────────────────────────────────────────────────
artifact.anchor_bindings = [rfc3161Binding, c2spBinding, scittBinding];

const fixture = {
  generated: '2026-07-02',
  generator: '_regen-anchor-fixtures.mjs (network one-shot; the gate is offline)',
  artifact,
  pinned: {
    freetsa_root_pem: freetsaRootPem,
    c2sp: {
      origin: LOG_NAME,
      log_pubkey_b64: publicKeyToRaw(logKp.publicKey).toString('base64'),
      cosigners: [
        { name: W1, pubkey_b64: publicKeyToRaw(w1Kp.publicKey).toString('base64') },
        { name: W2, pubkey_b64: publicKeyToRaw(w2Kp.publicKey).toString('base64') },
      ],
      cosigner_policy: 'all', // verifier trust policy for the gate: both cosigners must verify
      leaf_rule: 'RFC6962 leafHash over the ASCII bytes of anchored_hash ("sha256:<hex>")',
    },
    scitt: { issuer_pubkey_b64: publicKeyToRaw(scittKp.publicKey).toString('base64') },
  },
  ots_vector: otsVector,
};
writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n');
console.log('wrote', OUT, `(${JSON.stringify(fixture).length} bytes; run id ${randomUUID().slice(0, 8)})`);
