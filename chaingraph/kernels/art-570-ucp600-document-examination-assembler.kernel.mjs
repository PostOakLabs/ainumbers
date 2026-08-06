import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-570-ucp600-document-examination-assembler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'examine_lc_document_presentation',
  mandate_type: 'compliance_control', gpu: false,
};

// UCP 600 / ISBP 745 letter-of-credit document examination assembler (art-570).
//
// WHAT IT ENFORCES. A negotiating/nominated bank's document checker works a paper checklist
// against every presentation inside the 5-banking-day examination window, and most first
// presentations under a documentary credit carry at least one discrepancy (industry-reported).
// This is the EXAMINATION side of the LC lifecycle -- the companion tool `tools/420-mt700-lc-
// field-validator.html` validates the MT700 issuance message itself; this kernel instead recomputes
// the checker's own examination arithmetic once the checker has transcribed the structured fields
// off the presented documents, turning a paper checklist into a receipted, re-derivable result.
//
// SIX CHECKS. (a) presentation timing -- within the credit's expiry date and, per Art. 14(c), no
// later than 21 calendar days after the shipment date (or the credit's own stated presentation
// period if it declares one). (b) Art. 14(b) 5-banking-day examination-window arithmetic -- if the
// caller declares the date examination actually completed, checks it against the deadline computed
// from the presentation date. (c) Art. 30 tolerances -- +/-5% on quantity and drawn amount, widened
// to +/-10% when the credit itself qualifies the figure with "about"/"approximately". (d) Art.
// 28(f)(ii) insurance floor -- insurance coverage must be at least the declared percentage (110% by
// the article's own default when the credit is silent) of the CIF/CIP value. (e) cross-document
// consistency per Art. 14(d)/(e) -- goods-description conformity is a CHECKER-DECLARED flag (this
// kernel does no OCR or text parsing of descriptions), while named ports and the insurance
// effective-vs-shipment date relationship are compared directly from the transcribed fields. (f)
// draft tenor arithmetic -- when the credit specifies a tenor requirement, each draft's declared
// tenor and basis are checked against it and a maturity date is computed.
//
// SCOPE. No OCR, no document upload, no parsing of any document image or PDF -- every field here is
// a structured value the checker has already transcribed off the physical or electronic
// presentation. Goods-description conformity is likewise a checker judgment declared as a boolean,
// never inferred from free text, because UCP 600 itself does not require identical wording across
// documents (Art. 14(d)).
//
// CITATIONS. UCP 600 and ISBP 745 are cited by article/paragraph NUMBER only -- their text is ICC
// copyright and is never reproduced here. This tool carries no claim of ICC endorsement.
//
// Deterministic arithmetic only -- no clock, no randomness, no network, no PII.

const MAX_DRAFTS = 10;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function s(v) { return String(v == null ? '' : v).trim(); }

function minorInt(v) {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isSafeInteger(n)) return n;
  }
  return null;
}

function posNum(v) {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function isDate(v) { return typeof v === 'string' && DATE_RE.test(v); }

function nextDay(dateStr) {
  const d = new Date(Date.parse(dateStr + 'T00:00:00Z') + 86400000);
  return d.toISOString().slice(0, 10);
}

function isBankingDay(dateStr, holidaySet) {
  const dow = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return dow !== 0 && dow !== 6 && !holidaySet.has(dateStr);
}

// Walks forward from `fromDateExclusive` counting banking days (Mon-Fri, minus declared
// holidays) until `n` have elapsed; returns the date the nth banking day lands on.
function addBankingDays(fromDateExclusive, n, holidaySet) {
  let d = fromDateExclusive;
  let count = 0;
  while (count < n) {
    d = nextDay(d);
    if (isBankingDay(d, holidaySet)) count++;
  }
  return d;
}

function pctVariance(actual, stated) {
  if (stated === 0) return actual === 0 ? 0 : Infinity;
  return Math.abs((actual - stated) / stated) * 100;
}

const SCOPE_NOTE = 'Performs arithmetic only over structured fields the caller has transcribed from a presentation -- no OCR, no document upload, no parsing of any document image, PDF, or free-text description. Goods-description conformity is a caller-declared judgment, never inferred from text. Does not determine complying presentation on its own; it is a re-derivable arithmetic check the examiner and, on referral, the issuing bank evaluate.';
const CLAUSE_NOTE = 'UCP 600 (ICC Publication 600) and ISBP 745 (ICC Publication 745) are cited by article/paragraph number only; their text is ICC copyright and is not reproduced here. This tool carries no claim of ICC endorsement. Cross-reference tools/420-mt700-lc-field-validator.html for the issuance-side MT700 field validation this examination tool does not duplicate.';

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { gate_policy: 'review_required', execution_state: 'did_not_run', reason },
      verdict: 'INDETERMINATE',
      presentation_date: (extra && extra.presentation_date) || null,
      presentation_window: null,
      examination_window: null,
      tolerances: null,
      insurance_check: null,
      cross_document: null,
      drafts: [],
      findings: [],
      rejected_inputs: (extra && extra.rejected_inputs) || [],
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
    },
    compliance_flags: flags,
  };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  // -- LC terms.
  const lcIn = (pp.lc && typeof pp.lc === 'object') ? pp.lc : {};
  const lc_amount_minor = minorInt(lcIn.amount_minor);
  const lc_amount_tolerance_about = lcIn.amount_tolerance_about === true;
  const qtyIn = (lcIn.quantity && typeof lcIn.quantity === 'object') ? lcIn.quantity : {};
  const lc_qty_value = posNum(qtyIn.value);
  const lc_qty_unit = s(qtyIn.unit);
  const lc_qty_tolerance_about = qtyIn.tolerance_about === true;
  const expiry_date = isDate(lcIn.expiry_date) ? lcIn.expiry_date : null;
  const latest_shipment_date = isDate(lcIn.latest_shipment_date) ? lcIn.latest_shipment_date : null;
  const presentation_period_declared = typeof lcIn.presentation_period_days === 'number' && Number.isSafeInteger(lcIn.presentation_period_days) && lcIn.presentation_period_days > 0;
  // Art. 14(c): the credit's own stated period governs; absent a stated period, the article's
  // own default of 21 calendar days after shipment applies -- this is the rule's default, not
  // one this tool invents.
  const presentation_period_days = presentation_period_declared ? lcIn.presentation_period_days : 21;
  const namedPorts = (lcIn.named_ports && typeof lcIn.named_ports === 'object') ? lcIn.named_ports : {};
  const lc_port_of_loading = s(namedPorts.loading);
  const lc_port_of_discharge = s(namedPorts.discharge);
  const insurance_required = lcIn.insurance_required === true;
  const min_insurance_pct_declared = typeof lcIn.min_insurance_pct_of_cif === 'number' && Number.isFinite(lcIn.min_insurance_pct_of_cif) && lcIn.min_insurance_pct_of_cif > 0;
  // Art. 28(f)(ii): 110% of the CIF/CIP value is the article's own default when the credit is
  // silent -- again the rule's default, not this tool's.
  const min_insurance_pct_of_cif = min_insurance_pct_declared ? lcIn.min_insurance_pct_of_cif : 110;
  const tenorIn = (lcIn.tenor_requirement && typeof lcIn.tenor_requirement === 'object') ? lcIn.tenor_requirement : null;

  if (lc_amount_minor === null) rejected_inputs.push({ where: 'lc.amount_minor', reason: 'absent or not an integer number of minor units', supplied: null });
  if (lc_qty_value === null) rejected_inputs.push({ where: 'lc.quantity.value', reason: 'absent or not a positive number', supplied: null });
  if (!lc_qty_unit) rejected_inputs.push({ where: 'lc.quantity.unit', reason: 'absent', supplied: null });
  if (!expiry_date) rejected_inputs.push({ where: 'lc.expiry_date', reason: 'absent or not YYYY-MM-DD', supplied: lcIn.expiry_date === undefined ? null : s(lcIn.expiry_date) });
  if (!latest_shipment_date) rejected_inputs.push({ where: 'lc.latest_shipment_date', reason: 'absent or not YYYY-MM-DD', supplied: lcIn.latest_shipment_date === undefined ? null : s(lcIn.latest_shipment_date) });

  // -- Presentation date.
  const presentation_date = isDate(pp.presentation_date) ? pp.presentation_date : null;
  if (!presentation_date) rejected_inputs.push({ where: 'presentation_date', reason: 'absent or not YYYY-MM-DD', supplied: pp.presentation_date === undefined ? null : s(pp.presentation_date) });

  const examination_date = isDate(pp.examination_date) ? pp.examination_date : null;
  const holidaysIn = Array.isArray(pp.bank_holidays) ? pp.bank_holidays : [];
  const holidaySet = new Set(holidaysIn.filter(isDate));

  // -- Documents.
  const docsIn = (pp.documents && typeof pp.documents === 'object') ? pp.documents : {};

  const invIn = (docsIn.invoice && typeof docsIn.invoice === 'object') ? docsIn.invoice : {};
  const invoice_amount_minor = minorInt(invIn.amount_minor);
  const invQtyIn = (invIn.quantity && typeof invIn.quantity === 'object') ? invIn.quantity : {};
  const invoice_qty_value = posNum(invQtyIn.value);
  const invoice_goods_description = s(invIn.goods_description);
  const invoice_date = isDate(invIn.invoice_date) ? invIn.invoice_date : null;
  if (invoice_amount_minor === null) rejected_inputs.push({ where: 'documents.invoice.amount_minor', reason: 'absent or not an integer number of minor units', supplied: null });
  if (invoice_qty_value === null) rejected_inputs.push({ where: 'documents.invoice.quantity.value', reason: 'absent or not a positive number', supplied: null });

  const tdIn = (docsIn.transport_doc && typeof docsIn.transport_doc === 'object') ? docsIn.transport_doc : {};
  const shipment_date = isDate(tdIn.shipment_date) ? tdIn.shipment_date : null;
  const doc_port_of_loading = s(tdIn.port_of_loading);
  const doc_port_of_discharge = s(tdIn.port_of_discharge);
  if (!shipment_date) rejected_inputs.push({ where: 'documents.transport_doc.shipment_date', reason: 'absent or not YYYY-MM-DD', supplied: tdIn.shipment_date === undefined ? null : s(tdIn.shipment_date) });

  const requiredMissing = lc_amount_minor === null || lc_qty_value === null || !lc_qty_unit || !expiry_date
    || !latest_shipment_date || !presentation_date || invoice_amount_minor === null || invoice_qty_value === null || !shipment_date;
  if (requiredMissing) {
    return emptyResult('required_inputs_incomplete', { presentation_date, rejected_inputs }, ['UCP600_REQUIRED_INPUTS_INCOMPLETE']);
  }

  const findings = [];

  // -- (a) presentation timing: Art. 14(c) shipment-plus-window, and never later than expiry.
  const shipment_plus_window_deadline = addCalendarDays(shipment_date, presentation_period_days);
  const within_shipment_window = presentation_date <= shipment_plus_window_deadline;
  const within_expiry = presentation_date <= expiry_date;
  if (!within_shipment_window) {
    findings.push({ code: 'ART14C_PRESENTATION_AFTER_SHIPMENT_WINDOW', article: 'UCP 600 Art. 14(c)', severity: 'high', message: 'Presentation date ' + presentation_date + ' is after the ' + presentation_period_days + '-calendar-day window from shipment (' + shipment_date + '), deadline ' + shipment_plus_window_deadline + '.' });
  }
  if (!within_expiry) {
    findings.push({ code: 'ART14C_PRESENTATION_AFTER_EXPIRY', article: 'UCP 600 Art. 14(c)', severity: 'high', message: 'Presentation date ' + presentation_date + ' is after the credit expiry date ' + expiry_date + '.' });
  }
  const presentation_window = {
    shipment_date, latest_shipment_date, shipment_on_time: shipment_date <= latest_shipment_date,
    presentation_period_days, shipment_plus_window_deadline, expiry_date,
    within_shipment_window, within_expiry,
  };
  if (!presentation_window.shipment_on_time) {
    findings.push({ code: 'ART14C_SHIPMENT_AFTER_LATEST_SHIPMENT_DATE', article: 'UCP 600 Art. 14(c)', severity: 'high', message: 'Declared shipment date ' + shipment_date + ' is after the credit’s latest shipment date ' + latest_shipment_date + '.' });
  }

  // -- (b) Art. 14(b) 5-banking-day examination window.
  const examination_deadline = addBankingDays(presentation_date, 5, holidaySet);
  let examination_within_window = null;
  if (examination_date) {
    examination_within_window = examination_date <= examination_deadline;
    if (!examination_within_window) {
      findings.push({ code: 'ART14B_EXAMINATION_WINDOW_EXCEEDED', article: 'UCP 600 Art. 14(b)', severity: 'high', message: 'Declared examination date ' + examination_date + ' is after the 5-banking-day deadline ' + examination_deadline + ' computed from presentation on ' + presentation_date + '.' });
    }
  }
  const examination_window = { presentation_date, examination_deadline, examination_date, examination_within_window };

  // -- (c) Art. 30 tolerances.
  const qty_tolerance_pct = lc_qty_tolerance_about ? 10 : 5;
  const qty_variance_pct = pctVariance(invoice_qty_value, lc_qty_value);
  const qty_within_tolerance = qty_variance_pct <= qty_tolerance_pct;
  if (!qty_within_tolerance) {
    findings.push({ code: 'ART30_QUANTITY_TOLERANCE_EXCEEDED', article: 'UCP 600 Art. 30(b)', severity: 'high', message: 'Invoice quantity ' + invoice_qty_value + ' ' + lc_qty_unit + ' varies ' + qty_variance_pct.toFixed(2) + '% from the credit quantity ' + lc_qty_value + ' ' + lc_qty_unit + ', exceeding the ' + qty_tolerance_pct + '% tolerance.' });
  }

  const amount_tolerance_pct = lc_amount_tolerance_about ? 10 : 5;
  const amount_variance_pct = pctVariance(invoice_amount_minor, lc_amount_minor);
  const amount_within_tolerance = amount_variance_pct <= amount_tolerance_pct;
  if (!amount_within_tolerance) {
    findings.push({ code: 'ART30_AMOUNT_TOLERANCE_EXCEEDED', article: 'UCP 600 Art. 30(a)', severity: 'high', message: 'Invoice amount ' + invoice_amount_minor + ' minor units varies ' + amount_variance_pct.toFixed(2) + '% from the credit amount ' + lc_amount_minor + ' minor units, exceeding the ' + amount_tolerance_pct + '% tolerance.' });
  }
  // Art. 30(a): even under an "about" tolerance, drawn amount must never exceed the credit amount.
  const amount_exceeds_lc = invoice_amount_minor > lc_amount_minor * (1 + amount_tolerance_pct / 100);
  const tolerances = {
    quantity: { lc_value: lc_qty_value, unit: lc_qty_unit, invoice_value: invoice_qty_value, tolerance_pct: qty_tolerance_pct, variance_pct: qty_variance_pct, within_tolerance: qty_within_tolerance },
    amount: { lc_amount_minor, invoice_amount_minor, tolerance_pct: amount_tolerance_pct, variance_pct: amount_variance_pct, within_tolerance: amount_within_tolerance },
  };

  // -- (d) Art. 28(f)(ii) insurance floor.
  let insurance_check = null;
  const insIn = (docsIn.insurance && typeof docsIn.insurance === 'object') ? docsIn.insurance : null;
  if (insurance_required && !insIn) {
    findings.push({ code: 'ART28_INSURANCE_DOCUMENT_MISSING', article: 'UCP 600 Art. 28', severity: 'high', message: 'The credit requires an insurance document but none was declared in the presentation.' });
  } else if (insIn) {
    const insurance_amount_minor = minorInt(insIn.amount_minor);
    const cif_cip_value_minor = minorInt(insIn.cif_cip_value_minor);
    const effective_date = isDate(insIn.effective_date) ? insIn.effective_date : null;
    if (insurance_amount_minor === null) rejected_inputs.push({ where: 'documents.insurance.amount_minor', reason: 'absent or not an integer number of minor units', supplied: null });
    if (cif_cip_value_minor === null) rejected_inputs.push({ where: 'documents.insurance.cif_cip_value_minor', reason: 'absent or not an integer number of minor units', supplied: null });
    if (insurance_amount_minor !== null && cif_cip_value_minor !== null) {
      const required_minor = Math.ceil(cif_cip_value_minor * min_insurance_pct_of_cif / 100);
      const meets_floor = insurance_amount_minor >= required_minor;
      insurance_check = { insurance_amount_minor, cif_cip_value_minor, min_insurance_pct_of_cif, required_minor, meets_floor, effective_date };
      if (!meets_floor) {
        findings.push({ code: 'ART28F2_INSURANCE_BELOW_FLOOR', article: 'UCP 600 Art. 28(f)(ii)', severity: 'high', message: 'Insurance coverage ' + insurance_amount_minor + ' minor units is below the required ' + min_insurance_pct_of_cif + '% of CIF/CIP value (' + required_minor + ' minor units required).' });
      }
      if (effective_date && effective_date > shipment_date) {
        findings.push({ code: 'ART28E_INSURANCE_EFFECTIVE_AFTER_SHIPMENT', article: 'UCP 600 Art. 28(e)', severity: 'high', message: 'Insurance effective date ' + effective_date + ' is after the shipment date ' + shipment_date + '.' });
      }
    }
  }

  // -- (e) cross-document consistency: Art. 14(d)/(e).
  const conformsIn = (pp.goods_description_conforms && typeof pp.goods_description_conforms === 'object') ? pp.goods_description_conforms : {};
  const invoice_vs_transport_declared = typeof conformsIn.invoice_vs_transport === 'boolean';
  const invoice_vs_transport = invoice_vs_transport_declared ? conformsIn.invoice_vs_transport : null;
  if (!invoice_vs_transport_declared) {
    rejected_inputs.push({ where: 'goods_description_conforms.invoice_vs_transport', reason: 'absent -- the examiner must declare whether the transport document’s goods description does not conflict with the invoice, never defaulted', supplied: null });
  } else if (invoice_vs_transport === false) {
    findings.push({ code: 'ART14E_GOODS_DESCRIPTION_CONFLICT', article: 'UCP 600 Art. 14(e)', severity: 'high', message: 'Examiner declared the transport document’s goods description conflicts with the invoice.' });
  }
  let invoice_vs_insurance = null;
  if (typeof conformsIn.invoice_vs_insurance === 'boolean') {
    invoice_vs_insurance = conformsIn.invoice_vs_insurance;
    if (invoice_vs_insurance === false) {
      findings.push({ code: 'ART14E_GOODS_DESCRIPTION_CONFLICT', article: 'UCP 600 Art. 14(e)', severity: 'high', message: 'Examiner declared the insurance document’s goods description conflicts with the invoice.' });
    }
  }

  let port_of_loading_match = null, port_of_discharge_match = null;
  if (lc_port_of_loading) {
    port_of_loading_match = lc_port_of_loading === doc_port_of_loading;
    if (!port_of_loading_match) {
      findings.push({ code: 'ART14D_PORT_OF_LOADING_MISMATCH', article: 'UCP 600 Art. 14(d)', severity: 'high', message: 'Transport document port of loading "' + doc_port_of_loading + '" conflicts with the credit’s named port "' + lc_port_of_loading + '".' });
    }
  }
  if (lc_port_of_discharge) {
    port_of_discharge_match = lc_port_of_discharge === doc_port_of_discharge;
    if (!port_of_discharge_match) {
      findings.push({ code: 'ART14D_PORT_OF_DISCHARGE_MISMATCH', article: 'UCP 600 Art. 14(d)', severity: 'high', message: 'Transport document port of discharge "' + doc_port_of_discharge + '" conflicts with the credit’s named port "' + lc_port_of_discharge + '".' });
    }
  }

  const cross_document = {
    invoice_vs_transport_goods_description: invoice_vs_transport,
    invoice_vs_insurance_goods_description: invoice_vs_insurance,
    port_of_loading: { lc: lc_port_of_loading || null, document: doc_port_of_loading || null, matches: port_of_loading_match },
    port_of_discharge: { lc: lc_port_of_discharge || null, document: doc_port_of_discharge || null, matches: port_of_discharge_match },
  };

  // -- (f) draft tenor arithmetic.
  const draftsIn = Array.isArray(docsIn.drafts) ? docsIn.drafts.slice(0, MAX_DRAFTS) : [];
  const drafts = [];
  let draftAmountTotal = 0;
  for (let i = 0; i < draftsIn.length; i++) {
    const row = draftsIn[i] || {};
    const tenor_type = row.tenor_type === 'sight' || row.tenor_type === 'usance' ? row.tenor_type : null;
    const usance_days = row.tenor_type === 'usance' ? (Number.isSafeInteger(row.usance_days) && row.usance_days > 0 ? row.usance_days : null) : null;
    const usance_basis = row.tenor_type === 'usance' ? (row.usance_basis === 'shipment_date' || row.usance_basis === 'invoice_date' ? row.usance_basis : null) : null;
    const amount_minor = minorInt(row.amount_minor);
    const drawee = s(row.drawee);
    if (!tenor_type || amount_minor === null || (tenor_type === 'usance' && (!usance_days || !usance_basis))) {
      rejected_inputs.push({ where: 'documents.drafts[' + i + ']', reason: 'tenor_type must be sight/usance, usance drafts require usance_days and usance_basis, amount_minor an integer', supplied: row.tenor_type === undefined ? null : s(row.tenor_type) });
      continue;
    }
    let maturity_date = null;
    if (tenor_type === 'sight') {
      maturity_date = presentation_date;
    } else {
      const basisDate = usance_basis === 'shipment_date' ? shipment_date : invoice_date;
      if (basisDate) maturity_date = addCalendarDays(basisDate, usance_days);
    }
    let tenor_matches_lc = null;
    if (tenorIn) {
      const tenorTypeOk = tenorIn.type === tenor_type;
      const usanceOk = tenor_type === 'sight' || (tenorIn.usance_days === usance_days && tenorIn.usance_basis === usance_basis);
      tenor_matches_lc = tenorTypeOk && usanceOk;
      if (!tenor_matches_lc) {
        findings.push({ code: 'DRAFT_TENOR_MISMATCH', article: 'UCP 600 Art. 14(d)', severity: 'high', message: 'Draft[' + i + '] tenor (' + tenor_type + (usance_days ? ', ' + usance_days + 'd from ' + usance_basis : '') + ') conflicts with the credit’s stipulated tenor.' });
      }
    }
    draftAmountTotal += amount_minor;
    drafts.push({ tenor_type, usance_days, usance_basis, amount_minor, drawee, maturity_date, tenor_matches_lc });
  }
  if (draftsIn.length > MAX_DRAFTS) rejected_inputs.push({ where: 'documents.drafts', reason: 'more than ' + MAX_DRAFTS + ' drafts supplied', supplied: draftsIn.length });
  if (drafts.length > 0 && draftAmountTotal !== invoice_amount_minor) {
    findings.push({ code: 'DRAFT_AMOUNT_TOTAL_MISMATCH', article: 'UCP 600 Art. 14(d)', severity: 'high', message: 'Sum of draft amounts ' + draftAmountTotal + ' minor units does not equal the invoice amount ' + invoice_amount_minor + ' minor units.' });
  }

  const hasHigh = findings.some((f) => f.severity === 'high');
  const verdict = hasHigh ? 'DISCREPANT' : 'COMPLYING_PRESENTATION';
  const gate_policy = hasHigh ? 'review_required' : 'auto_pass';

  const compliance_flags = ['UCP600_DOCUMENT_EXAMINATION_EVALUATED'];
  if (!within_shipment_window || !within_expiry || !presentation_window.shipment_on_time) compliance_flags.push('UCP600_PRESENTATION_TIMING_BREACH');
  if (examination_within_window === false) compliance_flags.push('UCP600_EXAMINATION_WINDOW_EXCEEDED');
  if (!qty_within_tolerance || !amount_within_tolerance || amount_exceeds_lc) compliance_flags.push('UCP600_ART30_TOLERANCE_BREACH');
  if (insurance_check && !insurance_check.meets_floor) compliance_flags.push('UCP600_INSURANCE_BELOW_FLOOR');
  if (invoice_vs_transport === false || invoice_vs_insurance === false || port_of_loading_match === false || port_of_discharge_match === false) compliance_flags.push('UCP600_CROSS_DOCUMENT_CONFLICT');
  if (drafts.some((d) => d.tenor_matches_lc === false) || (drafts.length > 0 && draftAmountTotal !== invoice_amount_minor)) compliance_flags.push('UCP600_DRAFT_TENOR_MISMATCH');
  if (rejected_inputs.length > 0) compliance_flags.push('UCP600_INPUTS_REJECTED');

  return {
    output_payload: {
      decision: { gate_policy, execution_state: 'ran', reason: null },
      verdict,
      presentation_date,
      presentation_window,
      examination_window,
      tolerances,
      insurance_check,
      cross_document,
      drafts,
      findings,
      rejected_inputs,
      scope_note: SCOPE_NOTE,
      clause_note: CLAUSE_NOTE,
    },
    compliance_flags,
  };
}

// Calendar-day (not banking-day) window used for Art. 14(c) presentation timing and draft
// maturity dates -- unlike the Art. 14(b) examination window, which is in banking days.
function addCalendarDays(fromDate, calendarDays) {
  const d = new Date(Date.parse(fromDate + 'T00:00:00Z') + calendarDays * 86400000);
  return d.toISOString().slice(0, 10);
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
