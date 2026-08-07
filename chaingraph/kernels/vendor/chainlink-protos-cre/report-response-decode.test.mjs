// report-response-decode.test.mjs — CRE-PROTOS-1: asserts decodeReportResponse() against a hand-verified
// golden fixture (see PROVENANCE.md #Fixture derivation). Standalone unit test, not yet wired into
// preflight/CI — this row ships a decoder only, no OCG node (CRE-NODE-1 owns that). Node 18+.
// Run: node chaingraph/kernels/vendor/chainlink-protos-cre/report-response-decode.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { decodeReportResponse, hexOf, bytesFromHex } from './decoder.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const FIXTURE = JSON.parse(readFileSync(resolve(HERE, 'report-response.fixture.json'), 'utf8'));
const wireBytes = bytesFromHex(FIXTURE.wireHex);

const decoded = decodeReportResponse(wireBytes);
ok(hexOf(decoded.configDigest) === FIXTURE.expected.configDigestHex, 'configDigest matches fixture');
ok(decoded.seqNr === BigInt(FIXTURE.expected.seqNr), 'seqNr matches fixture');
ok(hexOf(decoded.reportContext) === FIXTURE.expected.reportContextHex, 'reportContext matches fixture (opaque bytes, field 3)');
ok(new TextDecoder().decode(decoded.rawReport) === FIXTURE.expected.rawReportUtf8, 'rawReport matches fixture (opaque bytes, field 4)');
ok(decoded.sigs.length === FIXTURE.expected.sigs.length, 'sigs count matches fixture');
FIXTURE.expected.sigs.forEach((expSig, i) => {
  ok(hexOf(decoded.sigs[i].signature) === expSig.signatureHex, `sigs[${i}].signature matches fixture`);
  ok(decoded.sigs[i].signerId === expSig.signerId, `sigs[${i}].signerId matches fixture`);
});

// negative — truncated buffer must throw, not silently return partial/garbage data.
let threw = false;
try { decodeReportResponse(wireBytes.subarray(0, 5)); } catch { threw = true; }
ok(threw, 'truncated buffer throws rather than silently decoding garbage');

// negative — a message missing a required field (raw_report, field 4, and everything after it) must throw.
// Boundary (78) = end of field 3 (report_context); walked and verified against this exact fixture's bytes
// (see PROVENANCE.md #Fixture derivation field-offset table), not an assumed/guessed cut point.
const noRawReport = wireBytes.subarray(0, 78);
let threwMissing = false;
try { decodeReportResponse(noRawReport); } catch { threwMissing = true; }
ok(threwMissing, 'message missing raw_report throws rather than returning null silently');

console.log(fail ? `\n✗ ${fail} FAILED` : '\n✓ all CRE-PROTOS-1 report-response decode assertions passed');
process.exit(fail ? 1 : 0);
