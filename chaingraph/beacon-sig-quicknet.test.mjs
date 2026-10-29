// BEACON-SIG-V2-1 gate: extracts the marked BEACON-SIG-VERIFY script block from the
// art-774 page and runs it against pinned vectors.
// Run: node chaingraph/beacon-sig-quicknet.test.mjs   (exit 0 = all vectors pass)
// Real vector pinned at build time (2026-10-22) from
// https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/33296876
// (round 33296876; drand publishes no offline quicknet signature test-vector file, so the
// fetched live round is the positive vector; quote in the row report).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'chaingraph', 'art-774-beacon-seeded-fair-sampling-v2.html'), 'utf8');
const m = html.match(/BEACON-SIG-VERIFY:BEGIN[\s\S]*?<script>([\s\S]*?)<\/script>[\s\S]*?BEACON-SIG-VERIFY:END/);
if (!m) {
  console.error('FAIL: BEACON-SIG-VERIFY block not found in page');
  process.exit(1);
}
(0, eval)(m[1]);
const V = globalThis.BeaconSigVerify;
if (!V) {
  console.error('FAIL: BeaconSigVerify not defined by the block');
  process.exit(1);
}

const REAL = {
  round: '33296876',
  signature: 'a16115eba283b5167b9ff85871b4f3ea2d26d0b4a793ae781101f7257489325e462965af2929918cdbd750363f6ebc21',
  randomness: '6a4bf76d53df69f3ef42e84f3fec10356a054c26cec613bc63aa7ed8bbc53ed9'
};

const results = [];
function check(name, cond, detail) {
  results.push({ name, result: cond ? 'PASS' : 'FAIL', detail: detail || '' });
  return cond;
}

const t1 = await V.verifyPulse({
  round: REAL.round,
  signature_hex: REAL.signature,
  beacon_round: REAL.round,
  beacon_randomness: REAL.randomness
});
check('real pinned round verifies and matches declared fields', t1.verdict === 'VERIFIED' && t1.randomness === REAL.randomness, t1.verdict + ' ' + (t1.randomness || ''));
check('round wall-clock time rendered', t1.verdict === 'VERIFIED' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t1.round_time_utc || ''), String(t1.round_time_utc));

const flip = (sigHex) => {
  const b = sigHex.split('');
  b[10] = b[10] === '0' ? '1' : '0';
  return b.join('');
};
const t2 = await V.verifyPulse({ round: REAL.round, signature_hex: flip(REAL.signature) });
check('flipped-byte signature refused as INVALID SIGNATURE', t2.verdict === 'INVALID SIGNATURE', t2.verdict);

const t3 = await V.verifyPulse({ round: String(Number(REAL.round) + 1), signature_hex: REAL.signature });
check('right signature with wrong round is INVALID SIGNATURE', t3.verdict === 'INVALID SIGNATURE', t3.verdict);

const t4 = await V.verifyPulse({
  round: REAL.round,
  signature_hex: REAL.signature,
  beacon_randomness: 'ff'.repeat(32)
});
check('right signature with different declared randomness is MISMATCH on beacon_randomness', t4.verdict === 'MISMATCH' && t4.field === 'beacon_randomness', t4.verdict + ' field=' + (t4.field || ''));

const t5 = await V.verifyPulse({
  round: REAL.round,
  signature_hex: '',
  beacon_randomness: REAL.randomness
});
check('pasted randomness with no signature is REFUSED', t5.verdict === 'REFUSED', t5.verdict + ' ' + (t5.reason || ''));

const t6 = await V.verifyPulse({
  round: REAL.round,
  signature_hex: REAL.signature,
  beacon_round: '999'
});
check('declared round differing from signed round is MISMATCH on beacon_round', t6.verdict === 'MISMATCH' && t6.field === 'beacon_round', t6.verdict + ' field=' + (t6.field || ''));

// Quicknet parameters pinned in the page must match the row premise.
check('pinned chain hash matches premise', V.QUICKNET.chain_hash === '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971');
check('pinned scheme is bls-unchained-g1-rfc9380', V.QUICKNET.scheme === 'bls-unchained-g1-rfc9380');
check('pinned genesis/period match premise', V.QUICKNET.genesis_time === 1692803367 && V.QUICKNET.period_seconds === 3);
check('pinned DST is the RFC 9380 G1 DST', V.QUICKNET.dst === 'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_');

console.table(results.map(r => ({ vector: r.name, result: r.result, detail: r.detail })));
const failed = results.filter(r => r.result === 'FAIL');
if (failed.length > 0) {
  console.error('FAIL: ' + failed.length + ' vector(s) failed');
  process.exit(1);
}
console.log('ALL PASS: ' + results.length + '/' + results.length + ' vectors');
