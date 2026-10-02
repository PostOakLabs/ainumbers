// art-701-three-way-invoice-match.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the build spec at
// research/hackathon-builds/ART701-THREE-WAY-MATCH-BUILD-SPEC-2026-10-01.md.
// kernel_digest_at_authoring: sha256:b57f647a37e62cd55bd20c9fb5aec358e2ccf0127aa4f2261772e718808a1625
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO — every money value is an integer minor unit gated through
// Number.isInteger checks, tax and variance roundings are integer-only divisions
// (roundHalfUpDiv / roundHalfAwayDiv over integer numerators and denominators), day
// differences come from integer days-from-civil arithmetic over YYYY-MM-DD strings,
// and compute() touches no Date, no float accumulation and no Math.random.
//
// Checks: fixture-oracle gate (F1..F15); P1 permutation invariance of invoice lines
// (outcome, totals, duplicates and hold never move under a shuffle); P2 tolerance
// monotonicity (raising price_tolerance_bp never turns a match into a mismatch, and
// never moves a non-price line verdict); P3 exact duplicate number always flagged
// (same_number_normalized + likely) under random decorations of the same digits;
// P4 invalid-domain rejection (fractional qty, zero/negative qty, non-integer or
// negative money, duplicate line numbers, unknown tax_rounding, missing currency,
// bad dates — refused with the named reason, never a throw); P5 tax half-up
// conformance against an independent integer implementation; P6 within-window
// boundary exactness through the days-from-civil difference (|days| <= window is
// inside, window+1 outside, across month and year boundaries); P7 determinism;
// P8 output shape (no undefined, no NaN, no non-finite number anywhere).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-701-three-way-invoice-match.proptest.mjs

import { compute } from '../art-701-three-way-invoice-match.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-701-three-way-invoice-match';
const TRIALS = 300;

// ---------- deterministic input factory ----------

const rand = mulberry32(0x070101);
function ri(lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); } // inclusive
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

const SKUS = ['A-100', 'B-200', 'C-300', 'D-400', 'E-500'];

/** A valid invoice + matching PO + matching receipt; totals derived by the declared rules. */
function randomCase(rng) {
  const n = ri(1, 4);
  const poLines = [];
  for (let i = 1; i <= n; i++) poLines.push({ line: i, sku: SKUS[i - 1], qty: ri(1, 20), unit_price_minor: ri(1, 50000) });
  const invLines = poLines.map((pl, idx) => {
    const qty = pl.qty;
    const unit = pl.unit_price_minor;
    return { line: idx + 1, po_line: pl.line, sku: pl.sku, qty, unit_price_minor: unit, amount_minor: qty * unit };
  });
  const subtotal = invLines.reduce((s, l) => s + l.amount_minor, 0);
  const rate = pick([0, 500, 825, 2000, 10000]);
  const tax = Math.floor((subtotal * rate + 5000) / 10000); // independent half-up leg
  const tolerance = pick([0, 100, 200, 500]);
  return {
    currency: 'USD',
    invoice: { invoice_number: 'INV-' + ri(1, 9999), issue_date: '2026-09-30', vendor_id: 'V-1', po_number: 'PO-7',
      subtotal_minor: subtotal, tax_minor: tax, total_minor: subtotal + tax, lines: invLines },
    purchase_order: { po_number: 'PO-7', lines: poLines },
    goods_receipt: { receipt_id: 'GR-7', lines: poLines.map((pl) => ({ po_line: pl.line, qty_received: pl.qty })) },
    vendor_terms: { price_tolerance_bp: tolerance, tax_rate_bp: rate, tax_rounding: 'half_up' },
    prior_invoices: [],
    duplicate_window_days: 14,
  };
}

/** Deliberately break one money/qty fact so the case exercises failure branches. */
function breakSomething(pp) {
  const kind = ri(0, 3);
  if (kind === 0) { pp.invoice.lines[0].qty += 1; pp.invoice.lines[0].amount_minor = pp.invoice.lines[0].qty * pp.invoice.lines[0].unit_price_minor; }
  else if (kind === 1) { pp.invoice.lines[0].unit_price_minor += 1000; pp.invoice.lines[0].amount_minor = pp.invoice.lines[0].qty * pp.invoice.lines[0].unit_price_minor; }
  else if (kind === 2) { pp.invoice.total_minor += 1; }
  else { pp.goods_receipt.lines[0].qty_received -= 1; }
  return pp;
}

function sortedLines(payload) {
  return JSON.stringify([...payload.lines].sort((a, b) => a.line - b.line));
}
function outcomeClass(payload) {
  return { outcome: payload.outcome, hold: payload.hold_recommended, totals: payload.totals, dups: payload.duplicates };
}

// ---------- P1: permuting invoice lines never changes the outcome ----------

function checkPermutationInvariance() {
  let checked = 0;
  let violations = 0;
  for (let t = 0; t < TRIALS; t++) {
    const pp = breakSomething(randomCase());
    const a = compute(pp).output_payload;
    for (let s = 0; s < 2; s++) {
      const shuffled = { ...pp, invoice: { ...pp.invoice, lines: [...pp.invoice.lines] } };
      // Fisher-Yates off the same deterministic stream
      for (let i = shuffled.invoice.lines.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffled.invoice.lines[i], shuffled.invoice.lines[j]] = [shuffled.invoice.lines[j], shuffled.invoice.lines[i]];
      }
      const b = compute(shuffled).output_payload;
      checked++;
      const ca = outcomeClass(a);
      const cb = outcomeClass(b);
      if (JSON.stringify(ca) !== JSON.stringify(cb)) { violations++; continue; }
      if (sortedLines(a) !== sortedLines(b)) violations++;
      const ma = JSON.stringify([...a.mismatches].sort((x, y) => (x.code + ':' + (x.line ?? 0)).localeCompare(y.code + ':' + (y.line ?? 0))));
      const mb = JSON.stringify([...b.mismatches].sort((x, y) => (x.code + ':' + (x.line ?? 0)).localeCompare(y.code + ':' + (y.line ?? 0))));
      if (ma !== mb) violations++;
    }
  }
  return { name: 'P1 invoice-line permutation never changes the outcome', checked, violations };
}

// ---------- P2: raising price_tolerance_bp never turns a match into a mismatch ----------

function checkToleranceMonotonicity() {
  let checked = 0;
  let violations = 0;
  for (let t = 0; t < TRIALS; t++) {
    const pp = breakSomething(randomCase());
    const t1 = pp.vendor_terms.price_tolerance_bp;
    const t2 = t1 + ri(0, 5000);
    const raised = { ...pp, vendor_terms: { ...pp.vendor_terms, price_tolerance_bp: t2 } };
    const a = compute(pp).output_payload;
    const b = compute(raised).output_payload;
    checked++;
    if (b.outcome !== a.outcome && b.outcome !== 'match') violations++;
    for (let i = 0; i < a.lines.length; i++) {
      const va = a.lines[i].verdict;
      const vb = b.lines[i].verdict;
      if (va === 'price_over_tolerance') {
        if (vb !== 'ok' && vb !== 'price_over_tolerance') violations++;
      } else if (va !== vb) {
        violations++;
      }
    }
  }
  return { name: 'P2 raising price_tolerance_bp never turns a match into a mismatch', checked, violations };
}

// ---------- P3: an exact duplicate number is always flagged ----------

function decorationsOf(digits) {
  const lead = pick(['INV', 'inv', 'INVOICE', 'bill', '']);
  const zeros = '0'.repeat(ri(0, 3));
  const sep = pick(['-', '_', '/', ' ']);
  return lead + sep + zeros + digits;
}

function checkDuplicateNumberAlwaysFlagged() {
  let checked = 0;
  let violations = 0;
  for (let t = 0; t < TRIALS; t++) {
    const pp = randomCase();
    const digits = String(ri(1, 999999));
    pp.prior_invoices = [{
      id: 'prior-' + t,
      vendor_id: pp.invoice.vendor_id,
      invoice_number: decorationsOf(digits),
      issue_date: '2026-03-01', // far outside any window: only the number can flag
      total_minor: 1, // deliberately different
      po_number: 'PO-OTHER',
    }];
    const normalizedSelf = digits; // strip-leading-zeros of the raw digits
    pp.invoice.invoice_number = normalizedSelf;
    const out = compute(pp).output_payload;
    checked++;
    const dup = out.duplicates.find((d) => d.id === 'prior-' + t);
    if (!dup) { violations++; continue; }
    if (!dup.reasons.includes('same_number_normalized') || dup.likely !== true) violations++;
    if (out.hold_recommended !== true) violations++;
  }
  return { name: 'P3 an exact duplicate number is always flagged likely', checked, violations };
}

// ---------- P4: invalid-domain rejection names its reason, never throws ----------

function checkRefusals() {
  let checked = 0;
  let violations = 0;
  const cases = [
    { mutate: (pp) => { delete pp.currency; }, reason: 'REFUSED_CURRENCY_MISSING' },
    { mutate: (pp) => { pp.vendor_terms.tax_rounding = 'bankers'; }, reason: 'REFUSED_UNKNOWN_TAX_ROUNDING' },
    { mutate: (pp) => { pp.invoice.lines[0].qty = 2.5; }, reason: 'REFUSED_FRACTIONAL_QTY' },
    { mutate: (pp) => { pp.invoice.lines[0].qty = 0; }, reason: 'REFUSED_QTY_NOT_POSITIVE' },
    { mutate: (pp) => { pp.invoice.lines[0].qty = -3; }, reason: 'REFUSED_QTY_NOT_POSITIVE' },
    { mutate: (pp) => { pp.invoice.lines[0].amount_minor = 12.34; }, reason: 'REFUSED_NON_INTEGER_MONEY' },
    { mutate: (pp) => { pp.invoice.subtotal_minor = 1000.5; }, reason: 'REFUSED_NON_INTEGER_MONEY' },
    { mutate: (pp) => { pp.invoice.tax_minor = -1; }, reason: 'REFUSED_NEGATIVE_MONEY' },
    { mutate: (pp) => { pp.invoice.lines.push({ ...pp.invoice.lines[0] }); }, reason: 'REFUSED_DUPLICATE_LINE_NUMBER' },
    { mutate: (pp) => { pp.invoice.issue_date = '30-09-2026'; }, reason: 'REFUSED_BAD_DATE' },
    { mutate: (pp) => { delete pp.invoice; }, reason: 'REFUSED_INVOICE_MISSING' },
  ];
  for (const cs of cases) {
    for (let t = 0; t < 20; t++) {
      const pp = randomCase();
      cs.mutate(pp);
      checked++;
      let out;
      try {
        out = compute(pp).output_payload;
      } catch (e) {
        violations++;
        continue;
      }
      if (out.outcome !== 'refused' || out.refusal_reason !== cs.reason) violations++;
      if (!Array.isArray(out.domain_errors) || out.domain_errors.length === 0) violations++;
    }
  }
  return { name: 'P4 invalid-domain inputs refused with named reasons, never a throw', checked, violations };
}

// ---------- P5: tax half-up conformance vs an independent implementation ----------

function checkTaxRounding() {
  let checked = 0;
  let violations = 0;
  for (let t = 0; t < TRIALS; t++) {
    const subtotal = ri(0, 5000000);
    const rate = ri(0, 10000);
    const pp = randomCase();
    pp.invoice.lines = [{ line: 1, po_line: 1, sku: 'A-100', qty: 1, unit_price_minor: subtotal, amount_minor: subtotal }];
    pp.purchase_order.lines = [{ line: 1, sku: 'A-100', qty: 1, unit_price_minor: subtotal }];
    pp.goods_receipt.lines = [{ po_line: 1, qty_received: 1 }];
    pp.invoice.subtotal_minor = subtotal;
    pp.vendor_terms.tax_rate_bp = rate;
    const expected = Math.floor((subtotal * rate + 5000) / 10000);
    pp.invoice.tax_minor = expected;
    pp.invoice.total_minor = subtotal + expected;
    const out = compute(pp).output_payload;
    checked++;
    if (out.totals.tax_expected_minor !== expected) violations++;
    if (!out.totals.tax_ok || !out.totals.total_ok) violations++;
  }
  return { name: 'P5 tax_expected conforms to independent integer half-up', checked, violations };
}

// ---------- P6: within-window boundary exactness through days-from-civil ----------

function dayNumberOf(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const yy = y - (mo <= 2 ? 1 : 0);
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = mo + (mo > 2 ? -3 : 9);
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function checkWindowBoundary() {
  let checked = 0;
  let violations = 0;
  const anchors = ['2026-09-30', '2026-12-31', '2027-01-01', '2028-02-28', '2024-02-29', '2100-03-01'];
  for (const anchor of anchors) {
    for (const offset of [-16, -15, -14, -1, 0, 1, 14, 15, 16]) {
      const pp = randomCase();
      const priorDay = dayNumberOf(anchor) + offset;
      // invert days-from-civil (Hinnant) to a YYYY-MM-DD string, integer-only
      let z = priorDay + 719468;
      const era = Math.floor(z / 146097);
      const doe = z - era * 146097;
      const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
      const y = yoe + era * 400;
      const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
      const mp = Math.floor((5 * doy + 2) / 153);
      const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
      const mo = mp + (mp < 10 ? 3 : -9);
      const yFull = y + (mo <= 2 ? 1 : 0);
      const iso = String(yFull).padStart(4, '0') + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      pp.invoice.issue_date = anchor;
      pp.prior_invoices = [{ id: 'P', vendor_id: pp.invoice.vendor_id, invoice_number: 'UNRELATED-' + ri(1, 999999), issue_date: iso, total_minor: pp.invoice.total_minor, po_number: 'PO-OTHER' }];
      const out = compute(pp).output_payload;
      checked++;
      const dup = out.duplicates.find((x) => x.id === 'P');
      const inside = Math.abs(offset) <= 14;
      if (inside) {
        if (!dup || !dup.reasons.includes('within_window')) violations++;
        if (!dup || dup.likely !== true) violations++; // same_total holds by construction
      } else {
        if (!dup || dup.reasons.includes('within_window')) violations++;
        if (!dup || dup.likely !== false) violations++;
      }
    }
  }
  return { name: 'P6 within_window is |days| <= duplicate_window_days, boundary exact', checked, violations };
}

// ---------- P7: determinism ----------

function checkDeterminism() {
  let checked = 0;
  let violations = 0;
  for (let t = 0; t < 100; t++) {
    const pp = (t % 2 === 0) ? randomCase() : breakSomething(randomCase());
    const a = compute(pp);
    const b = compute(pp);
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P7 compute() is deterministic: two runs agree byte-for-byte', checked, violations };
}

// ---------- P8: output shape (no undefined / NaN / non-finite) ----------

function checkShape() {
  let checked = 0;
  let violations = 0;
  const seen = [];
  for (let t = 0; t < TRIALS; t++) {
    const pp = (t % 3 === 0) ? randomCase() : (t % 3 === 1) ? breakSomething(randomCase()) : (() => { const q = randomCase(); delete q.purchase_order; return q; })();
    const out = compute(pp).output_payload;
    seen.push(out);
    checked++;
    violations += findShapeViolations(out).length;
  }
  const refused = compute({}).output_payload;
  seen.push(refused);
  checked++;
  violations += findShapeViolations(refused).length;
  return { name: 'P8 output shape: no undefined/NaN/non-finite anywhere', checked, violations };
}

// ---------- run ----------

let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkPermutationInvariance(),
  checkToleranceMonotonicity(),
  checkDuplicateNumberAlwaysFlagged(),
  checkRefusals(),
  checkTaxRounding(),
  checkWindowBoundary(),
  checkDeterminism(),
  checkShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — F1..F15 fixture oracle + P1..P8.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
