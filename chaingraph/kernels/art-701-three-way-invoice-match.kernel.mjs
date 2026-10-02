import { executionHash } from './_hash.mjs';

// art-701-three-way-invoice-match — three-way invoice match (invoice vs purchase
// order vs goods receipt) with totals, tax and duplicate-invoice checks. All money
// is an integer count of minor units; fractional quantities and sub-minor prices
// are refused, never rounded. Line pairing is explicit (declared po_line, then
// exact sku, then a free same-number PO line); there is no fuzzy text matching.
// Day differences come from integer days-from-civil arithmetic over YYYY-MM-DD
// strings: no Date objects, no clock. Each line verdict is decided by the first
// rule that applies in a fixed order; the outcome is decided from a fixed rule
// order. A missing goods receipt turns the run into a two-way match and reports
// receipt_missing as a flag on each paired line, not as a line failure.

const TOOL_ID = 'art-701-three-way-invoice-match';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'match_invoice_three_way',
  mandate_type: 'compliance_control', gpu: false,
};

const TAX_ROUNDINGS = ['half_up'];
const SCOPE_NOTE =
  'Integer minor units only: fractional quantities and sub-minor-unit prices are refused, not rounded. ' +
  'One currency per invoice. One declared tax rate; no tax-jurisdiction logic.';

// ---------- refusal plumbing ----------

/** @type {(reason: string, text: string, invoice?: object|null, receipt?: object|null) => { output_payload: object, compliance_flags: string[] }} */
function refused(reason, text, invoice = null, receipt = null) {
  const domain_errors = [{ code: reason, text }];
  const flags = [];
  if (domain_errors.length > 0) flags.push('ART701_INPUT_REFUSED');
  return {
    output_payload: {
      outcome: 'refused',
      refusal_reason: reason,
      po_number: (invoice && invoice.po_number) || null,
      receipt_id: (receipt && receipt.receipt_id) || null,
      lines: [],
      totals: null,
      mismatches: [],
      duplicates: [],
      domain_errors,
      hold_recommended: true,
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags,
  };
}

/** @type {(v: unknown) => boolean} non-negative integer minor-unit money */
function isMoney(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0; }

// ---------- integer date arithmetic (days-from-civil, proleptic Gregorian) ----------

/** @type {(s: unknown) => { y: number, m: number, d: number } | null} */
function parseIsoDate(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** @type {(y: number, m: number, d: number) => number} integer days from a fixed epoch */
function daysFromCivil(y, m, d) {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400; // [0, 399]
  const mp = m + (m > 2 ? -3 : 9); // Mar=0 .. Feb=11
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468;
}

/** @type {(s: unknown) => number | null} */
function dayNumberOf(s) {
  const p = parseIsoDate(s);
  if (!p) return null;
  return daysFromCivil(p.y, p.m, p.d);
}

// ---------- integer rounding ----------

/** half-up for a non-negative numerator over a positive denominator */
function roundHalfUpDiv(num, den) {
  return Math.floor((num + Math.floor(den / 2)) / den);
}

/** half-away-from-zero for any numerator over a positive denominator */
function roundHalfAwayDiv(num, den) {
  if (num >= 0) return Math.floor((2 * num + den) / (2 * den));
  return -Math.floor((2 * -num + den) / (2 * den));
}

// ---------- invoice-number normalization ----------

/** lowercase, strip non-alphanumerics, strip leading letters, strip leading zeros */
function normalizeInvoiceNumber(s) {
  if (typeof s !== 'string') return '';
  let t = '';
  for (const ch of s.toLowerCase()) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) t += ch;
  }
  let i = 0;
  while (i < t.length && t[i] >= 'a' && t[i] <= 'z') i++;
  t = t.slice(i);
  let j = 0;
  while (j < t.length && t[j] === '0') j++;
  return t.slice(j);
}

// ---------- validation ----------

/** @type {(pp: object) => { output_payload: object, compliance_flags: string[] } | null} */
function validate(pp) {
  if (typeof pp.currency !== 'string' || pp.currency.length === 0) {
    return refused('REFUSED_CURRENCY_MISSING', 'currency is required: one currency per invoice', pp.invoice, pp.goods_receipt);
  }
  if (!TAX_ROUNDINGS.includes(pp.vendor_terms?.tax_rounding)) {
    return refused('REFUSED_UNKNOWN_TAX_ROUNDING', 'vendor_terms.tax_rounding must be half_up', pp.invoice, pp.goods_receipt);
  }
  if (!isMoney(pp.vendor_terms?.tax_rate_bp) || !isMoney(pp.vendor_terms?.price_tolerance_bp)) {
    return refused('REFUSED_NON_INTEGER_MONEY', 'vendor_terms rates must be non-negative integers', pp.invoice, pp.goods_receipt);
  }
  const inv = pp.invoice;
  if (!inv || typeof inv !== 'object') {
    return refused('REFUSED_INVOICE_MISSING', 'invoice is required', null, pp.goods_receipt);
  }
  const moneyFields = [
    ['invoice.subtotal_minor', inv.subtotal_minor],
    ['invoice.tax_minor', inv.tax_minor],
    ['invoice.total_minor', inv.total_minor],
  ];
  const lines = Array.isArray(inv.lines) ? inv.lines : [];
  const seenLines = new Set();
  for (const ln of lines) {
    if (!ln || typeof ln !== 'object') {
      return refused('REFUSED_LINE_MALFORMED', 'every invoice line must be an object', inv, pp.goods_receipt);
    }
    const num = ln.line;
    if (typeof num !== 'number' || !Number.isInteger(num)) {
      return refused('REFUSED_LINE_NUMBER_NOT_INTEGER', 'every invoice line needs an integer line number', inv, pp.goods_receipt);
    }
    if (seenLines.has(num)) {
      return refused('REFUSED_DUPLICATE_LINE_NUMBER', 'invoice line ' + num + ' appears more than once', inv, pp.goods_receipt);
    }
    seenLines.add(num);
    const qty = ln.qty;
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) {
      const reason = (typeof qty === 'number' && !Number.isInteger(qty)) ? 'REFUSED_FRACTIONAL_QTY' : 'REFUSED_QTY_NOT_POSITIVE';
      return refused(reason, 'invoice line ' + num + ' quantity must be an integer greater than zero', inv, pp.goods_receipt);
    }
    moneyFields.push(['invoice line ' + num + ' amount_minor', ln.amount_minor]);
    moneyFields.push(['invoice line ' + num + ' unit_price_minor', ln.unit_price_minor]);
  }
  for (const [name, v] of moneyFields) {
    if (typeof v === 'number' && !Number.isInteger(v)) {
      return refused('REFUSED_NON_INTEGER_MONEY', name + ' must be an integer count of minor units', inv, pp.goods_receipt);
    }
    if (!isMoney(v)) {
      return refused('REFUSED_NEGATIVE_MONEY', name + ' must not be negative', inv, pp.goods_receipt);
    }
  }
  const po = pp.purchase_order;
  if (po && typeof po === 'object') {
    const poLines = Array.isArray(po.lines) ? po.lines : [];
    const seenPo = new Set();
    for (const pl of poLines) {
      const num = pl && pl.line;
      if (typeof num !== 'number' || !Number.isInteger(num) || seenPo.has(num)) {
        return refused('REFUSED_DUPLICATE_LINE_NUMBER', 'purchase order line numbers must be unique integers', inv, pp.goods_receipt);
      }
      seenPo.add(num);
      if (!isMoney(pl && pl.unit_price_minor)) {
        return refused('REFUSED_NON_INTEGER_MONEY', 'purchase order unit_price_minor must be a non-negative integer', inv, pp.goods_receipt);
      }
      const qty = pl && pl.qty;
      if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) {
        return refused('REFUSED_QTY_NOT_POSITIVE', 'purchase order quantities must be integers greater than zero', inv, pp.goods_receipt);
      }
    }
  }
  const gr = pp.goods_receipt;
  if (gr && typeof gr === 'object') {
    const grLines = Array.isArray(gr.lines) ? gr.lines : [];
    const seenGr = new Set();
    for (const gl of grLines) {
      const num = gl && gl.po_line;
      if (typeof num !== 'number' || !Number.isInteger(num) || seenGr.has(num)) {
        return refused('REFUSED_DUPLICATE_LINE_NUMBER', 'goods receipt po_line entries must be unique integers', inv, pp.goods_receipt);
      }
      seenGr.add(num);
      const q = gl && gl.qty_received;
      if (typeof q !== 'number' || !Number.isInteger(q) || q < 0) {
        return refused('REFUSED_QTY_NOT_POSITIVE', 'qty_received must be a non-negative integer', inv, pp.goods_receipt);
      }
    }
  }
  if (dayNumberOf(inv.issue_date) === null) {
    return refused('REFUSED_BAD_DATE', 'invoice.issue_date must be a YYYY-MM-DD calendar date', inv, pp.goods_receipt);
  }
  const priors = Array.isArray(pp.prior_invoices) ? pp.prior_invoices : [];
  for (const p of priors) {
    if (!p || typeof p !== 'object') continue;
    if (!isMoney(p.total_minor)) {
      return refused('REFUSED_NON_INTEGER_MONEY', 'prior invoice totals must be non-negative integers', inv, pp.goods_receipt);
    }
    if (dayNumberOf(p.issue_date) === null) {
      return refused('REFUSED_BAD_DATE', 'prior invoice issue_date must be a YYYY-MM-DD calendar date', inv, pp.goods_receipt);
    }
  }
  if (typeof pp.duplicate_window_days !== 'number' || !Number.isInteger(pp.duplicate_window_days) || pp.duplicate_window_days < 0) {
    return refused('REFUSED_BAD_DUPLICATE_WINDOW', 'duplicate_window_days must be a non-negative integer', inv, pp.goods_receipt);
  }
  return null;
}

// ---------- pairing ----------

/**
 * Pair an invoice line to an unused PO line: the declared po_line first, then an
 * exact sku match, then the same-numbered PO line when it is still free. No fuzzy
 * text matching anywhere. Returns the paired PO line or null.
 */
// eslint-disable-next-line no-unused-vars
function pairLine(ln, poLines, usedPo) {
  const wants = [];
  if (typeof ln.po_line === 'number' && Number.isInteger(ln.po_line)) wants.push((pl) => pl.line === ln.po_line);
  if (typeof ln.sku === 'string' && ln.sku.length > 0) wants.push((pl) => pl.sku === ln.sku);
  wants.push((pl) => pl.line === ln.line);
  for (const want of wants) {
    for (const pl of poLines) {
      if (!usedPo.has(pl.line) && want(pl)) {
        usedPo.add(pl.line);
        return pl;
      }
    }
  }
  return null;
}

// ---------- compute ----------

/**
 * compute(pp) — pure decision kernel over the declared three-way-match domain.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const bad = validate(pp);
  if (bad) return bad;

  const inv = pp.invoice;
  const po = (pp.purchase_order && typeof pp.purchase_order === 'object') ? pp.purchase_order : null;
  const gr = (pp.goods_receipt && typeof pp.goods_receipt === 'object') ? pp.goods_receipt : null;
  const terms = pp.vendor_terms || {};
  const flags = [];
  const mismatches = [];

  const invLines = Array.isArray(inv.lines) ? inv.lines : [];
  const poLines = (po && Array.isArray(po.lines)) ? po.lines : [];
  const grLines = (gr && Array.isArray(gr.lines)) ? gr.lines : [];
  const grByPoLine = new Map();
  for (const gl of grLines) grByPoLine.set(gl.po_line, gl);
  const amountByLine = new Map();
  for (const ln of invLines) amountByLine.set(ln.line, ln.amount_minor);

  const hasPo = typeof inv.po_number === 'string' && inv.po_number.length > 0 && po !== null;

  // Line amounts, pairing, and the fixed per-line verdict order.
  const usedPo = new Set();
  const outLines = [];
  let anyLineFailure = false;
  let anyAmountFailure = false;
  let receiptMissingSeen = false;
  let lineSum = 0;
  for (const ln of invLines) {
    lineSum += ln.amount_minor;
    const amountOk = ln.qty * ln.unit_price_minor === ln.amount_minor;
    if (!amountOk) anyAmountFailure = true;
    const paired = hasPo ? pairLine(ln, poLines, usedPo) : null;
    let verdict = 'line_not_on_po';
    let qtyOrdered = null;
    let qtyReceived = null;
    let poUnit = null;
    let varianceBp = null;
    if (paired !== null) {
      qtyOrdered = paired.qty;
      poUnit = paired.unit_price_minor;
      verdict = 'ok';
      const gl = grByPoLine.get(paired.line);
      if (gr === null) {
        verdict = 'receipt_missing'; // two-way match: a flag on the line, not a failure
        receiptMissingSeen = true;
      } else if (gl) {
        qtyReceived = gl.qty_received;
        if (ln.qty > gl.qty_received) verdict = 'qty_over_received';
      }
      if (verdict === 'ok' && ln.qty > paired.qty) verdict = 'qty_over_ordered';
      if (verdict === 'ok') {
        if (poUnit === 0) {
          if (ln.unit_price_minor !== 0) verdict = 'price_over_tolerance';
          else varianceBp = 0;
        } else {
          varianceBp = roundHalfAwayDiv((ln.unit_price_minor - poUnit) * 10000, poUnit);
          if (Math.abs(varianceBp) > terms.price_tolerance_bp) verdict = 'price_over_tolerance';
        }
      }
    }
    if (verdict !== 'ok' && verdict !== 'receipt_missing') anyLineFailure = true;
    outLines.push({
      line: ln.line,
      paired_po_line: paired ? paired.line : null,
      qty: ln.qty,
      qty_ordered: qtyOrdered,
      qty_received: qtyReceived,
      unit_price_minor: ln.unit_price_minor,
      po_unit_price_minor: poUnit,
      variance_bp: varianceBp,
      amount_ok: amountOk,
      verdict,
    });
  }

  // Per-line mismatch sentences in input line order, each line's codes fixed.
  for (const ol of outLines) {
    if (!ol.amount_ok) mismatches.push({ code: 'LINE_AMOUNT_MISMATCH', line: ol.line, text: 'Line ' + ol.line + ': qty times unit price ' + (ol.qty * ol.unit_price_minor) + ' does not equal invoiced amount ' + amountByLine.get(ol.line) });
    if (ol.verdict === 'line_not_on_po' && hasPo) mismatches.push({ code: 'LINE_NOT_ON_PO', line: ol.line, text: 'Line ' + ol.line + ': not on purchase order ' + inv.po_number });
    if (ol.verdict === 'qty_over_received') mismatches.push({ code: 'LINE_QTY_OVER_RECEIVED', line: ol.line, text: 'Line ' + ol.line + ': invoiced ' + ol.qty + ', received ' + ol.qty_received });
    if (ol.verdict === 'qty_over_ordered') mismatches.push({ code: 'LINE_QTY_OVER_ORDERED', line: ol.line, text: 'Line ' + ol.line + ': invoiced ' + ol.qty + ', ordered ' + ol.qty_ordered });
    if (ol.verdict === 'price_over_tolerance') mismatches.push({ code: 'LINE_PRICE_OVER_TOLERANCE', line: ol.line, text: ol.variance_bp === null
      ? 'Line ' + ol.line + ': purchase order unit price is zero and the invoiced unit price ' + ol.unit_price_minor + ' is not'
      : 'Line ' + ol.line + ': price variance ' + ol.variance_bp + ' bp exceeds tolerance ' + terms.price_tolerance_bp + ' bp' });
  }

  // Totals: line sum, tax under the single declared rate and rounding, total.
  const subtotalOk = lineSum === inv.subtotal_minor;
  const taxExpected = roundHalfUpDiv(inv.subtotal_minor * terms.tax_rate_bp, 10000);
  const taxOk = inv.tax_minor === taxExpected;
  const totalExpected = inv.subtotal_minor + taxExpected;
  const totalOk = inv.total_minor === totalExpected;
  if (!subtotalOk) mismatches.push({ code: 'SUBTOTAL_MISMATCH', text: 'Invoice subtotal ' + inv.subtotal_minor + ' does not equal the line sum ' + lineSum });
  if (!taxOk) mismatches.push({ code: 'TAX_MISMATCH', text: 'Invoice tax ' + inv.tax_minor + ' does not equal expected tax ' + taxExpected });
  if (!totalOk) mismatches.push({ code: 'TOTAL_MISMATCH', text: 'Invoice total ' + inv.total_minor + ' does not equal expected total ' + totalExpected });

  // Duplicates: same vendor, never the invoice itself, fixed reason order.
  const window = pp.duplicate_window_days;
  const thisDay = dayNumberOf(inv.issue_date);
  const normThis = normalizeInvoiceNumber(inv.invoice_number);
  const duplicates = [];
  let anyLikely = false;
  const priors = Array.isArray(pp.prior_invoices) ? pp.prior_invoices : [];
  for (const p of priors) {
    if (!p || typeof p !== 'object') continue;
    if (p.id === inv.invoice_number) continue; // the invoice itself, if listed
    if (p.vendor_id !== inv.vendor_id) continue;
    const reasons = [];
    if (p.total_minor === inv.total_minor) reasons.push('same_total');
    const priorDay = dayNumberOf(p.issue_date);
    if (priorDay !== null && Math.abs(thisDay - priorDay) <= window) reasons.push('within_window');
    const normPrior = normalizeInvoiceNumber(p.invoice_number);
    if (normThis.length > 0 && normPrior.length > 0 && normThis === normPrior) reasons.push('same_number_normalized');
    if (typeof p.po_number === 'string' && p.po_number.length > 0 && p.po_number === inv.po_number) reasons.push('same_po');
    if (reasons.length === 0) continue;
    const likely = (reasons.includes('same_total') && reasons.includes('within_window')) || reasons.includes('same_number_normalized');
    if (likely) anyLikely = true;
    duplicates.push({ id: p.id, reasons, likely });
  }

  // Outcome: no purchase order wins; otherwise a match needs no line failures,
  // no total failures and no line-amount failures.
  const outcome = !hasPo ? 'no_po'
    : (!anyLineFailure && !anyAmountFailure && subtotalOk && taxOk && totalOk) ? 'match'
      : 'mismatch';
  const holdRecommended = outcome !== 'match' || anyLikely;

  if (outcome === 'no_po') flags.push('ART701_NO_PURCHASE_ORDER');
  if (receiptMissingSeen) flags.push('ART701_GOODS_RECEIPT_MISSING');
  if (anyLikely) flags.push('ART701_DUPLICATE_INVOICE_SUSPECTED');
  if (holdRecommended) flags.push('ART701_HOLD_RECOMMENDED');

  return {
    output_payload: {
      outcome,
      po_number: inv.po_number ?? null,
      receipt_id: (gr && gr.receipt_id) || null,
      lines: outLines,
      totals: {
        line_sum_minor: lineSum,
        subtotal_ok: subtotalOk,
        tax_expected_minor: taxExpected,
        tax_ok: taxOk,
        total_expected_minor: totalExpected,
        total_ok: totalOk,
      },
      mismatches,
      duplicates,
      domain_errors: [],
      hold_recommended: holdRecommended,
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
