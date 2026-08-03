// roundtrip-verify.mjs — XLR-2 comparator (WORKBOOK-ROUNDTRIP-BUILD-SPEC.md §XLR-2).
//
// Pure function: takes a WB-2 Spreadsheet Input Manifest (expected) plus one
// pasted-back CSV/range per manifest range (observed, from an Excel round-trip),
// and returns an XLR-1 round-trip receipt object (see ROUNDTRIP-RECEIPT.md /
// roundtrip-receipt.schema.json).
//
// ZERO NEW ENGINE CODE: parsing goes through workbook.mjs's csvToWorkbook()
// (the same strict RFC 4180 parser WB-1 uses for CSV import) and digesting
// goes through workbook.mjs's rangeDigest()/csvDigest() (the same JCS+SHA-256
// path, via chaingraph/kernels/_hash.mjs, that WB-1/WB-2 already use). This
// module adds no second parser and no second hashing scheme.
//
// PURE: no DOM access, no network, no globals -- producedBy/producedAt are
// required caller-supplied inputs rather than a wall-clock/identity read, so
// the same inputs always produce the same receipt.
//
// PASTE-INTAKE IS UNTRUSTED INPUT: the finite-gate and CSV-injection rules
// apply to the observed (and expected) paste text identically to WB-1's CSV
// import. Finite-gate is inherited for free -- csvToWorkbook()/recalc() already
// turn any NaN/Infinity into the terminal `#NUM!` value and never let it
// propagate as a live number. CSV-injection is NOT inherited for free: a
// pasted cell beginning `=`, `+`, `-` or `@` is a formula-injection vector the
// moment this receipt is opened in a spreadsheet, so every raw cell value this
// module places into a `mismatches[]` entry is run through the SAME shared
// sanitizeCsvField() (chaingraph/kernels/_csv_injection.mjs) WB-1 uses on CSV
// export -- one sanitizer, reused, not re-derived.

import { WorkbookError, csvToWorkbook, fullRangeRef, rangeDigest, rangeValuesMatrix, expandRange } from './workbook.mjs';
import { isCsvInjectionRisk, sanitizeCsvField } from '../kernels/_csv_injection.mjs';

// Only strings can carry a formula-injection payload (a number/boolean value
// can never start with =/+/-/@ as text the way a spreadsheet importer reads
// it). sanitizeCsvField() always stringifies, so it's applied ONLY to a
// string that IS a risk -- every other value (numbers, booleans, safe
// strings) keeps its original type when it lands in the receipt.
function sanitizeReceiptValue(v) {
  return typeof v === 'string' && isCsvInjectionRisk(v) ? sanitizeCsvField(v) : v;
}

function requireString(name, v) {
  if (typeof v !== 'string' || v.length === 0) throw new WorkbookError('#VALUE!', `${name} must be a non-empty string`);
}

function requireManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new WorkbookError('#VALUE!', 'manifest must be an object');
  if (!manifest.source || typeof manifest.source.csv_digest !== 'string') throw new WorkbookError('#VALUE!', 'manifest.source.csv_digest is required');
  if (!Array.isArray(manifest.ranges) || manifest.ranges.length === 0) throw new WorkbookError('#VALUE!', 'manifest.ranges must be a non-empty array');
  for (const r of manifest.ranges) {
    if (!r || typeof r.ref !== 'string' || typeof r.values_digest !== 'string') {
      throw new WorkbookError('#VALUE!', 'each manifest range needs {ref, values_digest}');
    }
  }
}

// Digests + returns the value matrix for one pasted range's own CSV/TSV text,
// via workbook.mjs's own parser -- no second parser. `dimsRef` (an A1 range
// like "B2:C3") is used only to validate the pasted matrix's shape matches
// what the manifest declares for that range; the pasted text is always its
// own top-left-origin mini-sheet (an Excel paste carries no absolute refs).
async function digestPastedRange(text, dimsRef, label) {
  requireString(label, text);
  const wb = csvToWorkbook(text); // strict RFC 4180 parse + recalc -- inherits the finite-gate
  const localRange = fullRangeRef(wb);
  if (!localRange) throw new WorkbookError('#VALUE!', `${label} parsed to an empty range`);
  const matrix = rangeValuesMatrix(wb, localRange);
  const expectedShape = expandRange(dimsRef);
  if (matrix.length !== expectedShape.length || (matrix[0] || []).length !== (expectedShape[0] || []).length) {
    throw new WorkbookError('#VALUE!', `${label} shape ${matrix.length}x${(matrix[0] || []).length} does not match manifest range ${dimsRef} shape ${expectedShape.length}x${(expectedShape[0] || []).length}`);
  }
  const digest = await rangeDigest(wb, localRange);
  return { matrix, digest };
}

// Walks a manifest range and its paired expected/observed local matrices
// cell-by-cell, mapping each local (row, col) position back to its absolute
// A1 ref (e.g. B2, B3, C2, C3 for range B2:C3), and emits one mismatches[]
// entry per diverging cell. Raw values are sanitized against CSV-injection
// before being placed in the receipt, since the receipt itself may later be
// rendered as CSV/opened in a spreadsheet.
function diffCells(rangeRef, expectedMatrix, observedMatrix) {
  const abs = expandRange(rangeRef);
  const out = [];
  for (let r = 0; r < abs.length; r++) {
    for (let c = 0; c < abs[r].length; c++) {
      const e = expectedMatrix[r][c];
      const o = observedMatrix[r][c];
      const same = e === o || (e === null && (o === null || o === undefined)) || (o === null && e === undefined);
      if (!same) {
        out.push({
          ref: abs[r][c],
          expected_value: sanitizeReceiptValue(e),
          observed_value: sanitizeReceiptValue(o),
        });
      }
    }
  }
  return out;
}

/**
 * verifyRoundtrip — build an XLR-1 receipt comparing a WB-2 manifest
 * (expected) against pasted-back observed text, one entry per manifest range.
 *
 * @param {object} manifest - WB-2 Spreadsheet Input Manifest (input-manifest.schema.json).
 * @param {object} observedByRef - map of manifest range ref -> pasted CSV/TSV text for that range (e.g. { "B2:C3": "10,widget\r\n20,gadget\r\n" }). One entry required per manifest.ranges[].ref.
 * @param {object} [opts]
 * @param {object} [opts.expectedByRef] - OPTIONAL map of manifest range ref -> the actual expected CSV/TSV text (e.g. the pq-export the manifest was built from). When supplied for a range, a digest mismatch on that range is resolved to per-cell mismatches[] entries. When omitted for a range, expectedSource defaults to "manifest" and a digest mismatch on that range yields a single range-level mismatches[] entry (both sides are the range's digests, since no raw expected values are available).
 * @param {string} opts.producedBy - required, no default (pure: no identity read).
 * @param {string} opts.producedAt - required ISO-8601 timestamp, no default (pure: no wall-clock read).
 * @returns {Promise<object>} an XLR-1 receipt object (roundtrip-receipt.schema.json shape).
 */
export async function verifyRoundtrip(manifest, observedByRef, opts = {}) {
  requireManifest(manifest);
  if (!observedByRef || typeof observedByRef !== 'object') throw new WorkbookError('#VALUE!', 'observedByRef must be an object');
  const { expectedByRef = {}, producedBy, producedAt } = opts;
  requireString('producedBy', producedBy);
  requireString('producedAt', producedAt);

  const expectedRangesOut = [];
  const observedRangesOut = [];
  const mismatches = [];
  let usedPqExport = false;

  for (const r of manifest.ranges) {
    const observedText = observedByRef[r.ref];
    if (typeof observedText !== 'string') throw new WorkbookError('#VALUE!', `observedByRef is missing pasted text for range ${r.ref}`);

    const { matrix: observedMatrix, digest: observedDigest } = await digestPastedRange(observedText, r.ref, `observed[${r.ref}]`);

    expectedRangesOut.push({ ref: r.ref, values_digest: r.values_digest });
    observedRangesOut.push({ ref: r.ref, values_digest: observedDigest });

    if (observedDigest === r.values_digest) continue; // this range matches; no mismatch entries

    const expectedText = expectedByRef[r.ref];
    if (typeof expectedText === 'string') {
      usedPqExport = true;
      const { matrix: expectedMatrix } = await digestPastedRange(expectedText, r.ref, `expected[${r.ref}]`);
      const cellDiffs = diffCells(r.ref, expectedMatrix, observedMatrix);
      // A digest mismatch with zero cell-level diffs would mean the supplied
      // expectedText itself doesn't match the manifest's recorded digest --
      // an evidence-integrity problem, not a round-trip mismatch. Surface it
      // as a range-level entry rather than silently reporting "match".
      mismatches.push(...(cellDiffs.length ? cellDiffs : [{
        ref: r.ref,
        expected_value: sanitizeReceiptValue(r.values_digest),
        observed_value: sanitizeReceiptValue(observedDigest),
      }]));
    } else {
      // No raw expected values available -- digest-only comparison, so the
      // best we can name is the whole range and both sides' digests.
      mismatches.push({
        ref: r.ref,
        expected_value: sanitizeReceiptValue(r.values_digest),
        observed_value: sanitizeReceiptValue(observedDigest),
      });
    }
  }

  return {
    receipt_type: 'workbook-roundtrip-receipt',
    manifest_ref: manifest.source.csv_digest,
    expected: { source: usedPqExport ? 'pq-export' : 'manifest', ranges: expectedRangesOut },
    observed: { source: 'excel-paste', ranges: observedRangesOut },
    result: mismatches.length ? 'mismatch' : 'match',
    mismatches,
    produced_by: producedBy,
    produced_at: producedAt,
  };
}
