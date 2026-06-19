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

// guards
ok(!exportArtifact({ artifact, format: 'pdf' }).ok, 'pdf correctly reports not-yet-implemented');
ok(!exportArtifact({ artifact, format: 'xbrl' }).ok, 'xbrl without taxonomy rejected');
ok(!exportArtifact({ format: 'xlsx' }).ok, 'missing artifact rejected');
ok(!exportArtifact({ artifact, format: 'json' }).ok, 'unknown format rejected');

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASSED — wrote sample-export.xlsx / sample-export.csv');
process.exit(failures ? 1 : 0);
