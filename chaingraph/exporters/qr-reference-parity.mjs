// qr-reference-parity.mjs - compare exporters/qr.mjs against upstream reference matrices.
//
// fixtures/qr-reference/vectors.json holds, for each test input, what Project Nayuki's own
// python/qrcodegen.py (tag v1.8.0) produces: the version, the mask it chose, and a sha256
// of the full module matrix. This module re-encodes every input with qr.mjs and reports
// any vector whose matrix digest or version differs. The vectors come from a third-party
// encoder, never from qr.mjs itself, so a transcription error in the port cannot hide by
// agreeing with its own output. How the fixture was produced: fixtures/qr-reference/gen-reference.py.
//
// Exported so export.test.mjs (already a wired gate) runs it too; qr-reference-parity.test.mjs
// is the standalone entry.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qrMatrix } from './qr.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, 'fixtures', 'qr-reference', 'vectors.json');

/** sha256 of the matrix rows joined by LF, '1' dark and '0' light, row 0 on top. */
export function matrixDigest(modules) {
  const text = modules.map((row) => row.map((dark) => (dark ? '1' : '0')).join('')).join('\n');
  return createHash('sha256').update(text, 'ascii').digest('hex');
}

/**
 * Run every reference vector.
 * @returns {{ total:number, matched:number, refused:number, versions:number[], failures:string[] }}
 */
export function runQrReferenceParity() {
  const doc = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const failures = [];
  const versions = new Set();
  let matched = 0, refused = 0;
  for (const v of doc.vectors) {
    let ours = null, threw = false;
    try { ours = qrMatrix(v.text, v.ecl); } catch { threw = true; }
    if (v.expect === 'refuse') {
      if (threw) refused++;
      else failures.push(`${v.id}: reference refuses (data too long), qr.mjs returned version ${ours.version}`);
      continue;
    }
    if (threw) { failures.push(`${v.id}: reference encodes at version ${v.version}, qr.mjs threw`); continue; }
    versions.add(v.version);
    if (ours.version !== v.version || ours.size !== v.size) {
      failures.push(`${v.id}: version/size ${ours.version}/${ours.size}, reference ${v.version}/${v.size}`);
      continue;
    }
    if (matrixDigest(ours.modules) !== v.matrix_sha256) {
      failures.push(`${v.id}: version ${v.version} matrix differs from reference (reference mask ${v.mask})`);
      continue;
    }
    matched++;
  }
  return { total: doc.vectors.length, matched, refused, versions: [...versions].sort((a, b) => a - b), failures };
}
