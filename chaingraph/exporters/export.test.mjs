// exporters/export.test.mjs — smoke test for chaingraph_export (Node 18+).
// Run:  node repo/chaingraph/exporters/export.test.mjs
// Builds a real artifact from a kernel, exports xlsx + csv, asserts structure,
// and writes sample files next to this script for manual open-in-Excel checks.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildArtifact } from '../kernels/art-35-tempo-payments-business-case.kernel.mjs';
import { exportArtifact, SUPPORTED_FORMATS } from './index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.error('  ✗ ' + msg); } else { console.log('  ✓ ' + msg); } };
// Writing the sample files is a convenience, not part of the test. If the file
// is locked (e.g. still open in Excel), warn rather than fail the whole run.
const safeWrite = (name, data) => {
  try { writeFileSync(join(here, name), data); }
  catch (e) { console.warn(`  ! could not write ${name} (${e.code || e.message}) — close it if open; assertions above still stand`); }
};

const artifact = await buildArtifact(
  { rail: 'swift', stablecoin: 'usdc', tx_amount_usd: 25000, monthly_volume: 800, impl_months: 3 },
  { now: '2026-06-19T00:00:00Z' },
);
console.log('artifact tool_id =', artifact.tool_id, '| hash =', artifact.execution_hash.slice(0, 16) + '…');

console.log('\nSUPPORTED_FORMATS:', SUPPORTED_FORMATS.join(', '));

// xlsx
const xlsx = exportArtifact({ artifact, format: 'xlsx' });
ok(xlsx.ok, 'xlsx export ok');
ok(xlsx.filename.endsWith('.xlsx'), 'xlsx filename ext');
const xbytes = Buffer.from(xlsx.bytes_base64, 'base64');
ok(xbytes[0] === 0x50 && xbytes[1] === 0x4b, 'xlsx is a ZIP (PK magic)');   // "PK"
ok(xlsx.metadata.execution_hash === artifact.execution_hash, 'xlsx metadata carries execution_hash');
safeWrite('sample-export.xlsx', xbytes);

// csv
const csv = exportArtifact({ artifact, format: 'csv' });
ok(csv.ok, 'csv export ok');
const ctext = Buffer.from(csv.bytes_base64, 'base64').toString('utf8');
ok(ctext.includes('execution_hash'), 'csv carries execution_hash in manifest');
ok(ctext.includes('annual_saving_usd'), 'csv carries an output_payload field');
safeWrite('sample-export.csv', ctext);

// pdf
const pdf = exportArtifact({ artifact, format: 'pdf' });
ok(pdf.ok, 'pdf export ok');
const pbytes = Buffer.from(pdf.bytes_base64, 'base64');
ok(pbytes.slice(0, 5).toString('latin1') === '%PDF-', 'pdf has %PDF- header');
ok(pbytes.slice(-5).toString('latin1') === '%%EOF', 'pdf ends with %%EOF');
ok(pdf.metadata.execution_hash === artifact.execution_hash, 'pdf metadata carries execution_hash');
safeWrite('sample-export.pdf', pbytes);

// xbrl — ocg-ext works now; eba-corep-* return a "pending, do not fabricate" error
const xbrl = exportArtifact({ artifact, format: 'xbrl', xbrl_taxonomy: 'ocg-ext' });
ok(xbrl.ok, 'xbrl(ocg-ext) export ok');
const xtext = Buffer.from(xbrl.bytes_base64, 'base64').toString('utf8');
ok(xtext.includes('<xbrli:xbrl'), 'xbrl instance has well-formed root');
ok(xtext.includes(artifact.execution_hash), 'xbrl carries source execution_hash');
ok(xtext.includes('iso4217:USD'), 'xbrl emits a monetary unit for a USD fact');
ok(xtext.includes('ocg-ext/ocg-ext-2026.xsd'), 'xbrl schemaRef points to the published ocg-ext schema');
ok(xtext.includes('<ocg:Fact>') && xtext.includes('<ocg:Key'), 'unmapped scalars emitted as valid Fact (Key/Value) tuples');
ok(!xtext.includes('name="'), 'no non-standard name="" attribute on facts (valid XBRL)');
safeWrite('sample-export.xbrl', xtext);
ok(!exportArtifact({ artifact, format: 'xbrl', xbrl_taxonomy: 'eba-corep-own-funds' }).ok, 'eba-corep pending (no fabricated EBA concepts)');

// vc — W3C Verifiable Credentials 2.0 profile (OCG §13.11). View-only: no new hash/proof.
const vc = exportArtifact({ artifact, format: 'vc' });
ok(vc.ok, 'vc export ok');
ok(vc.filename.endsWith('.vc.json'), 'vc filename ext');
ok(vc.media_type === 'application/vc+json', 'vc media type');
const vcobj = JSON.parse(Buffer.from(vc.bytes_base64, 'base64').toString('utf8'));
ok(vcobj['@context'][0] === 'https://www.w3.org/ns/credentials/v2', 'vc @context[0] is W3C VC 2.0');
ok(vcobj.type.includes('VerifiableCredential'), 'vc type includes VerifiableCredential');
ok(vcobj.credentialSubject.output_payload && 'annual_saving_usd' in vcobj.credentialSubject.output_payload, 'vc credentialSubject carries output_payload');
ok(vcobj['ocg:hashAnchor'].executionHash === artifact.execution_hash, 'vc hashAnchor re-states the canonical execution_hash');
ok(vcobj.execution_hash === undefined && vcobj.proof === undefined, 'vc mints NO new execution_hash and NO proof (§13 view-only)');
// agent-receipts (Obsigna) §13.11.1 extension — partial credentialSubject mapping.
ok(vcobj['@context'].includes('https://agentreceipts.ai/context/v1'), 'vc @context includes agent-receipts context');
ok(vcobj.credentialSubject.action.type === `x-ocg.${artifact.tool_id}`, 'vc action.type falls through x-ocg.* (no taxonomy match yet)');
ok(vcobj.credentialSubject.outcome.status === (artifact.compliance_flags?.length ? 'failure' : 'success'), 'vc outcome.status derived from compliance_flags');
ok(vcobj.credentialSubject.chain.sequence === (artifact.chain?.chain_depth ?? 0) + 1, 'vc chain.sequence = chain_depth + 1');
ok(vcobj.credentialSubject.chain.chain_id === `x-ocg:tool:${artifact.tool_id}`, 'vc chain.chain_id falls back to x-ocg:tool: for a single-node artifact');
ok(vcobj.credentialSubject.principal === undefined, 'vc principal absent (no §22 mandate governed this run)');
ok(vcobj.credentialSubject.action.id === undefined && vcobj.credentialSubject.action.risk_level === undefined, 'vc action stays a PARTIAL mapping (no invented id/risk_level)');
// Determinism — same artifact must render byte-identical bytes.
const vc2 = exportArtifact({ artifact, format: 'vc' });
ok(vc2.bytes_base64 === vc.bytes_base64, 'vc is deterministic (byte-identical on re-run)');
// Base profile — available even when a per-node gate denies everything.
const vcGated = exportArtifact({ artifact, format: 'vc', isFormatAllowed: () => false });
ok(vcGated.ok, 'vc is a base profile (bypasses export_capability gate)');
const xlsxGated = exportArtifact({ artifact, format: 'xlsx', isFormatAllowed: () => false });
ok(!xlsxGated.ok, 'non-base format still honors the export_capability gate');
safeWrite('sample-export.vc.json', Buffer.from(vc.bytes_base64, 'base64'));

// qr (structural only — SCAN sample-export.pdf to confirm it decodes to the verify URL)
const { qrMatrix } = await import('./qr.mjs');
const qr = qrMatrix('https://ainumbers.co/chaingraph/verify?hash=' + 'a'.repeat(64));
ok(qr.size >= 21 && qr.size % 4 === 1, `qr size is a valid module count (${qr.size})`);
const finderOK = (r, c) => qr.modules[r][c] && qr.modules[r + 6][c] && qr.modules[r][c + 6] && !qr.modules[r + 1][c + 1];
ok(finderOK(0, 0) && finderOK(0, qr.size - 7) && finderOK(qr.size - 7, 0), 'qr has 3 finder patterns at the corners');
// qr reference parity: every matrix must equal what upstream's own encoder produces
// (fixtures/qr-reference/vectors.json). Runs here because this file is already a wired gate.
const { runQrReferenceParity } = await import('./qr-reference-parity.mjs');
const qrParity = runQrReferenceParity();
for (const f of qrParity.failures.slice(0, 10)) console.error('    ' + f);
ok(qrParity.failures.length === 0, `qr matches the upstream reference encoder (${qrParity.matched} matrices, ${qrParity.refused} refusals, ${qrParity.failures.length} failures)`);
ok(qrParity.versions.length === 40, `qr reference vectors cover all 40 versions (${qrParity.versions.length})`);

// pdf page-1 QR draw — structural checks, all measured from the emitted stream:
// the symbol's rectangles are present, the quiet zone is 4 modules clear on
// every side (white underlay vs symbol bbox), and no page-1 text operator
// starts inside the reserved box.
const ptext = pbytes.toString('latin1');
const streams = [...ptext.matchAll(/stream\n([\s\S]*?)endstream/g)].map((m) => m[1]);
ok(streams.length >= 1, 'pdf has at least one content stream');
const page1 = streams[0];   // objects write in numeric order; obj 5 is page 1's content
const white = page1.match(/1 1 1 rg\n([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re f\n0 0 0 rg/);
ok(!!white, 'page 1 paints a white quiet-zone underlay');
const blackSeg = white ? page1.slice(page1.indexOf('0 0 0 rg')) : '';
const rects = [...blackSeg.matchAll(/^([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re$/gm)]
  .map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
ok(rects.length > 0, `symbol drawn as module rectangles (${rects.length} in stream)`);
const verifyOp = page1.match(/\(verify: ([^)]+)\)/);
ok(!!verifyOp, 'page 1 prints the verify URL as text');
if (white && verifyOp && rects.length) {
  const box = { x0: +white[1], y0: +white[2], x1: +white[1] + +white[3], y1: +white[2] + +white[4] };
  const mat = qrMatrix(verifyOp[1]);
  let dark = 0;
  for (const row of mat.modules) for (const v of row) if (v) dark++;
  ok(rects.length === dark, `one rectangle per dark module (${dark} expected, ${rects.length} drawn)`);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  const ms = (maxX - minX) / mat.size;              // module size, measured from the stream
  const clear = Math.min(minX - box.x0, box.x1 - maxX, minY - box.y0, box.y1 - maxY);
  ok(box.x0 <= minX && box.y0 <= minY && box.x1 >= maxX && box.y1 >= maxY, 'underlay covers the symbol bbox');
  ok(clear >= 4 * ms - 0.05 && clear <= 4 * ms + 0.05, `quiet zone is 4 modules clear on every side (measured ${clear.toFixed(2)} pt vs ${(4 * ms).toFixed(2)})`);
  const textOps = [...page1.matchAll(/^BT \/F\d [\d.]+ Tf 1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/gm)]
    .map((m) => ({ x: +m[1], y: +m[2] }));
  ok(textOps.length > 0, `page-1 text operators parsed (${textOps.length})`);
  const inBox = textOps.filter((t) => t.x >= box.x0 && t.x <= box.x1 && t.y >= box.y0 && t.y <= box.y1);
  ok(inBox.length === 0, 'no page-1 text operator starts inside the reserved box');
}

// guards
ok(!exportArtifact({ artifact, format: 'xbrl' }).ok, 'xbrl without taxonomy rejected');
ok(!exportArtifact({ format: 'xlsx' }).ok, 'missing artifact rejected');
ok(!exportArtifact({ artifact, format: 'json' }).ok, 'unknown format rejected');

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASSED — wrote sample-export.xlsx / sample-export.csv');
process.exit(failures ? 1 : 0);
