// OpenChainGraph shared RFC 3161 TimeStampToken verifier — OCG Standard §20 (rfc3161-tst) and
// §23 (rfc3161-snapshot input attestations REUSE this SAME verifier — no second RFC 3161 impl).
// SINGLE SOURCE OF TRUTH: extracted from anchor-binding.test.mjs (the §20 gate) so the §20 gate
// and the §23 validate_input_attestations tool call the identical code path.
//
// 100% offline given a pinned root cert: CMS SignedData parse, TSTInfo messageImprint check,
// signedAttrs messageDigest binding, EKU id-kp-timeStamping (critical), chain to the pinned root.
// node:crypto only (createHash, X509Certificate, verify) — available under Workers nodejs_compat.
import { createHash, verify as cryptoVerify, X509Certificate } from 'node:crypto';
import { derRead, derChildrenOf, derOidToString, derEnc } from './_anchor-testutil.mjs';

const OID = {
  signedData: '1.2.840.113549.1.7.2',
  tstInfo: '1.2.840.113549.1.9.16.1.4',
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  sha256: '2.16.840.1.101.3.4.2.1',
  ekuExt: '2.5.29.37',
  ekuTimestamping: '1.3.6.1.5.5.7.3.8',
};
const HASH_BY_OID = {
  '1.3.14.3.2.26': 'sha1',
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512',
  '1.2.840.113549.1.1.11': 'sha256', '1.2.840.113549.1.1.12': 'sha384', '1.2.840.113549.1.1.13': 'sha512',
  '1.2.840.10045.4.3.2': 'sha256', '1.2.840.10045.4.3.3': 'sha384', '1.2.840.10045.4.3.4': 'sha512',
};
const b64 = (s) => Buffer.from(s, 'base64');

// The pinned FreeTSA root used by both the §20 gate fixture and this runtime verifier — same
// real-world root, not a test-only substitute.
export const FREETSA_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIIH/zCCBeegAwIBAgIJAMHphhYNqOmAMA0GCSqGSIb3DQEBDQUAMIGVMREwDwYD
VQQKEwhGcmVlIFRTQTEQMA4GA1UECxMHUm9vdCBDQTEYMBYGA1UEAxMPd3d3LmZy
ZWV0c2Eub3JnMSIwIAYJKoZIhvcNAQkBFhNidXNpbGV6YXNAZ21haWwuY29tMRIw
EAYDVQQHEwlXdWVyemJ1cmcxDzANBgNVBAgTBkJheWVybjELMAkGA1UEBhMCREUw
HhcNMTYwMzEzMDE1MjEzWhcNNDEwMzA3MDE1MjEzWjCBlTERMA8GA1UEChMIRnJl
ZSBUU0ExEDAOBgNVBAsTB1Jvb3QgQ0ExGDAWBgNVBAMTD3d3dy5mcmVldHNhLm9y
ZzEiMCAGCSqGSIb3DQEJARYTYnVzaWxlemFzQGdtYWlsLmNvbTESMBAGA1UEBxMJ
V3VlcnpidXJnMQ8wDQYDVQQIEwZCYXllcm4xCzAJBgNVBAYTAkRFMIICIjANBgkq
hkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAtgKODjAy8REQ2WTNqUudAnjhlCrpE6ql
mQfNppeTmVvZrH4zutn+NwTaHAGpjSGv4/WRpZ1wZ3BRZ5mPUBZyLgq0YrIfQ5Fx
0s/MRZPzc1r3lKWrMR9sAQx4mN4z11xFEO529L0dFJjPF9MD8Gpd2feWzGyptlel
b+PqT+++fOa2oY0+NaMM7l/xcNHPOaMz0/2olk0i22hbKeVhvokPCqhFhzsuhKsm
q4Of/o+t6dI7sx5h0nPMm4gGSRhfq+z6BTRgCrqQG2FOLoVFgt6iIm/BnNffUr7V
DYd3zZmIwFOj/H3DKHoGik/xK3E82YA2ZulVOFRW/zj4ApjPa5OFbpIkd0pmzxzd
EcL479hSA9dFiyVmSxPtY5ze1P+BE9bMU1PScpRzw8MHFXxyKqW13Qv7LWw4sbk3
SciB7GACbQiVGzgkvXG6y85HOuvWNvC5GLSiyP9GlPB0V68tbxz4JVTRdw/Xn/XT
FNzRBM3cq8lBOAVt/PAX5+uFcv1S9wFE8YjaBfWCP1jdBil+c4e+0tdywT2oJmYB
BF/kEt1wmGwMmHunNEuQNzh1FtJY54hbUfiWi38mASE7xMtMhfj/C4SvapiDN837
gYaPfs8x3KZxbX7C3YAsFnJinlwAUss1fdKar8Q/YVs7H/nU4c4Ixxxz4f67fcVq
M2ITKentbCMCAwEAAaOCAk4wggJKMAwGA1UdEwQFMAMBAf8wDgYDVR0PAQH/BAQD
AgHGMB0GA1UdDgQWBBT6VQ2MNGZRQ0z357OnbJWveuaklzCBygYDVR0jBIHCMIG/
gBT6VQ2MNGZRQ0z357OnbJWveuaklzCBm6SBmDCBlTERMA8GA1UEChMIRnJlZSBU
U0ExEDAOBgNVBAsTB1Jvb3QgQ0ExGDAWBgNVBAMTD3d3dy5mcmVldHNhLm9yZzEi
MCAGCSqGSIb3DQEJARYTYnVzaWxlemFzQGdtYWlsLmNvbTESMBAGA1UEBxMJV3Vl
cnpidXJnMQ8wDQYDVQQIEwZCYXllcm4xCzAJBgNVBAYTAkRFggkAwemGFg2o6YAw
MwYDVR0fBCwwKjAooCagJIYiaHR0cDovL3d3dy5mcmVldHNhLm9yZy9yb290X2Nh
LmNybDCBzwYDVR0gBIHHMIHEMIHBBgorBgEEAYHyJAEBMIGyMDMGCCsGAQUFBwIB
FidodHRwOi8vd3d3LmZyZWV0c2Eub3JnL2ZyZWV0c2FfY3BzLmh0bWwwMgYIKwYB
BQUHAgEWJmh0dHA6Ly93d3cuZnJlZXRzYS5vcmcvZnJlZXRzYV9jcHMucGRmMEcG
CCsGAQUFBwICMDsaOUZyZWVUU0EgdHJ1c3RlZCB0aW1lc3RhbXBpbmcgU29mdHdh
cmUgYXMgYSBTZXJ2aWNlIChTYWFTKTA3BggrBgEFBQcBAQQrMCkwJwYIKwYBBQUH
MAGGG2h0dHA6Ly93d3cuZnJlZXRzYS5vcmc6MjU2MDANBgkqhkiG9w0BAQ0FAAOC
AgEAaK9+v5OFYu9M6ztYC+L69sw1omdyli89lZAfpWMMh9CRmJhM6KBqM/ipwoLt
nxyxGsbCPhcQjuTvzm+ylN6VwTMmIlVyVSLKYZcdSjt/eCUN+41K7sD7GVmxZBAF
ILnBDmTGJmLkrU0KuuIpj8lI/E6Z6NnmuP2+RAQSHsfBQi6sssnXMo4HOW5gtPO7
gDrUpVXID++1P4XndkoKn7Svw5n0zS9fv1hxBcYIHPPQUze2u30bAQt0n0iIyRLz
aWuhtpAtd7ffwEbASgzB7E+NGF4tpV37e8KiA2xiGSRqT5ndu28fgpOY87gD3ArZ
DctZvvTCfHdAS5kEO3gnGGeZEVLDmfEsv8TGJa3AljVa5E40IQDsUXpQLi8G+UC4
1DWZu8EVT4rnYaCw1VX7ShOR1PNCCvjb8S8tfdudd9zhU3gEB0rxdeTy1tVbNLXW
99y90xcwr1ZIDUwM/xQ/noO8FRhm0LoPC73Ef+J4ZBdrvWwauF3zJe33d4ibxEcb
8/pz5WzFkeixYM2nsHhqHsBKw7JPouKNXRnl5IAE1eFmqDyC7G/VT7OF669xM6hb
Ut5G21JE4cNK6NNucS+fzg1JPX0+3VhsYZjj7D5uljRvQXrJ8iHgr/M6j2oLHvTA
I2MLdq2qjZFDOCXsxBxJpbmLGBx9ow6ZerlUxzws2AWv2pk=
-----END CERTIFICATE-----
`;

// EKU presence/criticality/oids straight from the cert DER (node exposes no criticality API).
function ekuFromCert(x509) {
  const der = x509.raw;
  const tbs = derChildrenOf(der, derRead(der, 0))[0];
  for (const el of derChildrenOf(der, tbs)) {
    if (el.tag !== 0xa3) continue; // [3] extensions
    for (const ext of derChildrenOf(der, derChildrenOf(der, el)[0])) {
      const ek = derChildrenOf(der, ext);
      if (derOidToString(ek[0].content) !== OID.ekuExt) continue;
      const critical = ek[1].tag === 0x01 && ek[1].content[0] === 0xff;
      const value = ek[ek.length - 1]; // OCTET STRING wrapping SEQUENCE OF OID
      const inner = derRead(Buffer.from(value.content), 0);
      const oids = derChildrenOf(Buffer.from(value.content), inner).map((o) => derOidToString(o.content));
      return { present: true, critical, oids };
    }
  }
  return { present: false, critical: false, oids: [] };
}

// Locates the CMS/TSTInfo structure and returns { tstInfoDer, hashedMessage, policyOid, serial,
// genTime, kids } WITHOUT any crypto/chain checks — the structural half of verification (used to
// answer "does the messageImprint bind to this input's digest" independently of the crypto verdict).
export function parseRfc3161Token(proofB64) {
  const der = b64(proofB64);
  const ci = derRead(der, 0);
  const [oidNode, explicit0] = derChildrenOf(der, ci);
  if (derOidToString(oidNode.content) !== OID.signedData) throw new Error('not CMS SignedData');
  const signedData = derChildrenOf(der, explicit0)[0];
  const kids = derChildrenOf(der, signedData);
  const encapKids = derChildrenOf(der, kids[2]);
  if (derOidToString(encapKids[0].content) !== OID.tstInfo) throw new Error('eContentType != id-ct-TSTInfo');
  const tstInfoDer = Buffer.from(derRead(der, encapKids[1].start).content); // OCTET STRING in [0]

  const t = derChildrenOf(tstInfoDer, derRead(tstInfoDer, 0));
  const policyOid = derOidToString(t[1].content);
  const imprintKids = derChildrenOf(tstInfoDer, t[2]);
  const imprintAlg = derOidToString(derChildrenOf(tstInfoDer, imprintKids[0])[0].content);
  const hashedMessage = Buffer.from(imprintKids[1].content);
  const serial = BigInt('0x' + Buffer.from(t[3].content).toString('hex')).toString(10);
  const genTime = t[4].content.toString('ascii');
  if (imprintAlg !== OID.sha256) throw new Error('messageImprint alg is not SHA-256');
  return { der, kids, tstInfoDer, hashedMessage, policyOid, serial, genTime };
}

// Bare-hex messageImprint extracted from a base64 TimeStampToken — structural-only, no crypto.
export function extractMessageImprintHex(proofB64) {
  return parseRfc3161Token(proofB64).hashedMessage.toString('hex');
}

/**
 * verifyRfc3161(binding, { rootPem, expectHashHex }) — full verification: CMS/TSTInfo parse,
 * messageImprint == expectHashHex, signedAttrs messageDigest binding, chain to rootPem, critical
 * EKU id-kp-timeStamping. Throws (does not return false) on any structural or crypto failure —
 * callers wrap in try/catch. Returns { policyOid, serial, genTime } on success.
 */
export function verifyRfc3161(binding, { rootPem, expectHashHex }) {
  const { der, kids, tstInfoDer, hashedMessage, policyOid, serial, genTime } = parseRfc3161Token(binding.proof);
  if (!hashedMessage.equals(Buffer.from(expectHashHex, 'hex'))) throw new Error('messageImprint != anchored_hash');
  if (binding.policy_oid !== undefined && (policyOid !== binding.policy_oid || serial !== binding.serial || genTime !== binding.gen_time)) {
    throw new Error('TSTInfo members disagree with the binding’s verbatim rfc3161 members');
  }
  // genTime sane: YYYYMMDDHHMMSSZ, within [2016-01-01, now + 1 day]
  const gm = genTime.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/);
  if (!gm) throw new Error('genTime not GeneralizedTime Zulu');
  const gt = Date.UTC(+gm[1], +gm[2] - 1, +gm[3], +gm[4], +gm[5], +gm[6]);
  if (!(gt > Date.UTC(2016, 0, 1) && gt < Date.now() + 86_400_000)) throw new Error('genTime not sane');

  const certs = [];
  for (const k of kids) if (k.tag === 0xa0) for (const c of derChildrenOf(der, k)) certs.push(new X509Certificate(Buffer.from(c.raw)));
  if (!certs.length) throw new Error('no certificates in SignedData');
  const signerInfo = derChildrenOf(der, kids[kids.length - 1])[0];
  const si = derChildrenOf(der, signerInfo);
  const digestAlg = HASH_BY_OID[derOidToString(derChildrenOf(der, si[2])[0].content)];
  const signedAttrsNode = si[3];
  if (signedAttrsNode.tag !== 0xa0) throw new Error('no signedAttrs');
  const sigAlgOid = derOidToString(derChildrenOf(der, si[4])[0].content);
  const sigHash = HASH_BY_OID[sigAlgOid] ?? digestAlg;
  const signature = Buffer.from(si[5].content);

  let ctOk = false, mdOk = false;
  for (const attr of derChildrenOf(der, signedAttrsNode)) {
    const [aOid, aSet] = derChildrenOf(der, attr);
    const aVal = derChildrenOf(der, aSet)[0];
    const which = derOidToString(aOid.content);
    if (which === OID.contentType) ctOk = derOidToString(aVal.content) === OID.tstInfo;
    if (which === OID.messageDigest) mdOk = Buffer.from(aVal.content).equals(createHash(digestAlg).update(tstInfoDer).digest());
  }
  if (!ctOk) throw new Error('signedAttrs contentType != id-ct-TSTInfo');
  if (!mdOk) throw new Error('signedAttrs messageDigest != hash(TSTInfo) — token/content mismatch');

  const tbs = derEnc(0x31, Buffer.from(der.subarray(signedAttrsNode.start, signedAttrsNode.end)));

  const root = new X509Certificate(rootPem);
  let signer = null;
  for (const c of certs) {
    try { if (cryptoVerify(sigHash, tbs, c.publicKey, signature)) { signer = c; break; } } catch { /* next */ }
  }
  if (!signer) throw new Error('no embedded certificate verifies the CMS signature');
  const eku = ekuFromCert(signer);
  if (!eku.present || !eku.oids.includes(OID.ekuTimestamping)) throw new Error('signer cert lacks EKU id-kp-timeStamping');
  if (!eku.critical) throw new Error('signer EKU extension is not critical (RFC 3161 §2.3)');

  let cur = signer;
  const pool = certs.filter((c) => c !== signer);
  for (let hop = 0; hop < 4; hop++) {
    if (cur.verify(root.publicKey)) { cur = root; break; }
    const issuer = pool.find((c) => { try { return cur.verify(c.publicKey); } catch { return false; } });
    if (!issuer) throw new Error('signer does not chain to the pinned TSA root');
    cur = issuer;
  }
  if (cur !== root) throw new Error('chain did not terminate at the pinned TSA root');
  return { policyOid, serial, genTime };
}
