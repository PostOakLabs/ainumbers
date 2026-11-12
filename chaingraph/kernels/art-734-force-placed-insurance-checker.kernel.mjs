import { executionHash } from './_hash.mjs';

// art-734-force-placed-insurance-checker — lender-placed (force-placed) insurance
// notice-sequence checker. Values only: the kernel checks the SEQUENCE of dates and
// benchmarks the charged premium against borrower-provided alternative-quote values.
// It never labels a premium reasonable or unreasonable — that judgement is surfaced
// as a values-only comparison, never decided (row FORCE-PLACED-CHECKER-1).
//
// DETERMINISM: compute() is a pure function of pp — no Date.now()/Math.random(), no
// network, no filesystem. All date arithmetic is integer civil-day counting
// (daysFromCivil / Rata Die), never Date objects (the guest and the golden-parity
// oracle share no engine specifics).

const TOOL_ID = 'art-734-force-placed-insurance-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_force_placed_notice',
  mandate_type: 'compliance_control', gpu: false,
};

// ------------------------------------------------- calendar-day arithmetic
// Days are integer civil days (Rata Die). No time zones, no Date objects.

function daysFromCivil(y, m, d) {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 306;
}

function civilFromDays(z) {
  z += 306;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: m <= 2 ? y + 1 : y, m, d };
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1970;
const MAX_YEAR = 2099;

function isoOf(z) {
  const c = civilFromDays(z);
  const m = String(c.m).padStart(2, '0');
  const d = String(c.d).padStart(2, '0');
  return `${c.y}-${m}-${d}`;
}

// Strict ISO calendar date, 1970-2099, real month lengths — anything else refuses.
function parseIso(s) {
  if (typeof s !== 'string') return null;
  const hit = ISO_RE.exec(s);
  if (!hit) return null;
  const y = Number(hit[1]); const m = Number(hit[2]); const d = Number(hit[3]);
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  if (m < 1 || m > 12) return null;
  const dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  if (d < 1 || d > dim) return null;
  return daysFromCivil(y, m, d);
}

// ---------------------------------------------------------------- rule constants
// Policy-provenance constants: each citation IS the rule that travels with the
// output (the KERNEL-CITATION-CLASS policy_parameters exception) — the timing
// requirements below are the paragraph text re-implemented.

const CITE = {
  charge_basis: '12 CFR 1024.37(b)',
  first_notice_45day: '12 CFR 1024.37(c)(1)(i)',
  first_notice_content: '12 CFR 1024.37(c)(2)',
  reminder_15day: '12 CFR 1024.37(d)(1)',
  reminder_30day_after_first: '12 CFR 1024.37(d)(1)',
  evidence_window: '12 CFR 1024.37(c)(1)(iii)',
  mail_class: '12 CFR 1024.37(f)',
  cancel_refund: '12 CFR 1024.37(g)',
  benchmark: '12 CFR 1024.37(h)(1)-(2)',
};

// The (c)(2) first-notice content items, keyed c2_i .. c2_xi; every one is
// required by the paragraph (applicability of (xi) is the servicer's fact
// pattern, so the checker requires it flagged as applicable or omitted
// deliberately — see element note).
const FIRST_NOTICE_CONTENT_ITEMS = [
  'c2_i', 'c2_ii', 'c2_iii', 'c2_iv', 'c2_v', 'c2_vi',
  'c2_vii', 'c2_viii', 'c2_ix', 'c2_x', 'c2_xi',
];

// Closed mail-class enum for the (f) mailing check. Anything at or above
// first-class satisfies the paragraph; 'other' does not.
const MAIL_CLASSES = ['first_class', 'certified', 'registered', 'priority_express', 'other'];

// Closed element-state enum.
const STATES = ['met', 'breached', 'not_applicable', 'outstanding', 'refused'];

const VALUES_ONLY_NOTE = 'values_only_comparison: the node reports charged vs alternative-quote values and never labels a premium reasonable or unreasonable';

// ---------------------------------------------------------------- refusals

function refusalPayload(flag, because, extra) {
  const payload = {
    verdict: 'refused',
    refused_because: because,
    elements: [],
    premium_benchmark: null,
    refund_evaluation: null,
    evidence: {
      record_type: 'force_placed_insurance_notice_check', tool_id: TOOL_ID,
      tool_version: TOOL_VERSION, refused: true,
    },
    manual_review_required: true,
  };
  const keys = Object.keys(extra || {});
  for (let i = 0; i < keys.length; i++) payload[keys[i]] = extra[keys[i]];
  return payload;
}

function element(id, cite, requirement, state, extra) {
  const e = {
    element_id: id,
    cited_paragraph: cite,
    requirement,
    state,
  };
  const keys = Object.keys(extra || {});
  for (let i = 0; i < keys.length; i++) e[keys[i]] = extra[keys[i]];
  return e;
}

function round2(x) { return Math.round(x * 100) / 100; }

// Inclusive day count of the overlap of two closed day intervals, 0 if none.
function overlapDays(aStart, aEnd, bStart, bEnd) {
  const s = aStart > bStart ? aStart : bStart;
  const e = aEnd < bEnd ? aEnd : bEnd;
  if (e < s) return 0;
  return e - s + 1;
}

function numAmount(v) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  return v;
}

// ---------------------------------------------------------------- compute()

export function compute(pp) {
  pp = pp || {};
  const compliance_flags = [];

  const needDateOf = (raw, name) => {
    const z = parseIso(raw);
    if (z === null) {
      compliance_flags.push('MISSING_OR_INVALID_REQUIRED_DATE_REFUSED');
      return {
        refused: true,
        payload: refusalPayload('MISSING_OR_INVALID_REQUIRED_DATE_REFUSED', 'missing_or_invalid_required_date_parameter', {
          parameter: name, expected: 'strict YYYY-MM-DD calendar date within 1970-2099',
        }),
      };
    }
    return { refused: false, z, iso: raw };
  };

  // direct property reads (KERNEL-INPUT-USAGE-CHECK-1: declared inputs are read
  // as named members, never through a dynamic key)
  const first = needDateOf(pp.first_notice_date, 'first_notice_date');
  if (first.refused) return { output_payload: first.payload, compliance_flags };
  const reminder = needDateOf(pp.reminder_notice_date, 'reminder_notice_date');
  if (reminder.refused) return { output_payload: reminder.payload, compliance_flags };
  const charge = needDateOf(pp.charge_date, 'charge_date');
  if (charge.refused) return { output_payload: charge.payload, compliance_flags };

  const charged = numAmount(pp.charged_premium_amount);
  if (charged === null) {
    compliance_flags.push('INVALID_AMOUNT_REFUSED');
    return {
      output_payload: refusalPayload('INVALID_AMOUNT_REFUSED', 'invalid_charged_premium_amount', {
        parameter: 'charged_premium_amount', expected: 'non-negative finite number',
      }),
      compliance_flags,
    };
  }

  const cs = parseIso(pp.charge_coverage_start);
  const ce = parseIso(pp.charge_coverage_end);
  if (cs === null || ce === null) {
    compliance_flags.push('MISSING_OR_INVALID_REQUIRED_DATE_REFUSED');
    return {
      output_payload: refusalPayload('MISSING_OR_INVALID_REQUIRED_DATE_REFUSED', 'missing_or_invalid_required_date_parameter', {
        parameter: cs === null ? 'charge_coverage_start' : 'charge_coverage_end',
        expected: 'strict YYYY-MM-DD calendar date within 1970-2099',
      }),
      compliance_flags,
    };
  }
  if (ce < cs) {
    compliance_flags.push('INVALID_COVERAGE_PERIOD_REFUSED');
    return {
      output_payload: refusalPayload('INVALID_COVERAGE_PERIOD_REFUSED', 'charge_coverage_end_before_start', {}),
      compliance_flags,
    };
  }

  const elements = [];

  // -- Element 1: first notice at least 45 days before the charge (c)(1)(i).
  const firstGap = charge.z - first.z;
  {
    const ok = firstGap >= 45;
    if (ok) {
      compliance_flags.push('FPI_FIRST_NOTICE_45DAY_MET');
    } else {
      compliance_flags.push('FPI_FIRST_NOTICE_45DAY_BREACHED');
    }
    elements.push(element('first_notice_45_day_advance', CITE.first_notice_45day,
      'written first notice delivered or mailed at least 45 days before the premium charge is assessed',
      ok ? 'met' : 'breached',
      { days_between_first_notice_and_charge: firstGap, minimum_days: 45 }));
  }

  // -- Element 2: reminder at least 15 days before the charge (d)(1).
  const remGap = charge.z - reminder.z;
  {
    const ok = remGap >= 15;
    if (ok) {
      compliance_flags.push('FPI_REMINDER_15DAY_MET');
    } else {
      compliance_flags.push('FPI_REMINDER_15DAY_BREACHED');
    }
    elements.push(element('reminder_15_days_before_charge', CITE.reminder_15day,
      'reminder notice delivered or mailed at least 15 days before the premium charge is assessed',
      ok ? 'met' : 'breached',
      { days_between_reminder_and_charge: remGap, minimum_days: 15 }));
  }

  // -- Element 3: reminder not until at least 30 days after the first notice (d)(1).
  const remAfterFirst = reminder.z - first.z;
  {
    const ok = remAfterFirst >= 30;
    if (ok) {
      compliance_flags.push('FPI_REMINDER_30DAY_AFTER_FIRST_MET');
    } else {
      compliance_flags.push('FPI_REMINDER_30DAY_AFTER_FIRST_BREACHED');
    }
    elements.push(element('reminder_30_days_after_first_notice', CITE.reminder_30day_after_first,
      'reminder notice not delivered or mailed until at least 30 days after the first notice',
      ok ? 'met' : 'breached',
      { days_between_first_notice_and_reminder: remAfterFirst, minimum_days: 30 }));
  }

  // -- Element 4: no evidence of continuous coverage received by the end of the
  //    15-day period beginning on the reminder delivery date (the (c)(1)(iii)
  //    evidence window, cited on the element below) — the charge-permission
  //    evidence cutoff is the window end, not the charge date.
  let evidenceZ = null;
  if (pp.evidence_of_continuous_coverage_date !== undefined && pp.evidence_of_continuous_coverage_date !== null && pp.evidence_of_continuous_coverage_date !== '') {
    evidenceZ = parseIso(pp.evidence_of_continuous_coverage_date);
    if (evidenceZ === null) {
      compliance_flags.push('INVALID_OPTIONAL_DATE_REFUSED');
      return {
        output_payload: refusalPayload('INVALID_OPTIONAL_DATE_REFUSED', 'invalid_or_ambiguous_iso_date', {
          parameter: 'evidence_of_continuous_coverage_date', expected: 'strict YYYY-MM-DD calendar date within 1970-2099',
        }),
        compliance_flags,
      };
    }
  }
  {
    // The evidence cutoff for charging is the END of the 15-day period
    // beginning on the reminder delivery date (delivery date per (c)(1)(ii))
    // — not the charge date. A charge assessed while the window is
    // open is made despite received evidence (breached); a charge assessed
    // after the window closed with evidence only straggling in later remains
    // permitted (the authorization vests at window end and late-arriving
    // evidence does not retroactively invalidate it).
    let st; let extra;
    if (evidenceZ === null) {
      compliance_flags.push('FPI_NO_EVIDENCE_BEFORE_CHARGE');
      st = 'met';
      extra = { note: 'no evidence of continuous coverage reported as received' };
    } else if (evidenceZ <= reminder.z + 15) {
      compliance_flags.push('FPI_EVIDENCE_BEFORE_CHARGE_BREACHED');
      st = 'breached';
      extra = { evidence_date: pp.evidence_of_continuous_coverage_date, note: 'evidence of continuous coverage was received by the end of the 15-day period beginning on the reminder delivery date (' + isoOf(reminder.z + 15) + '), so the charge was not permitted' };
    } else {
      compliance_flags.push('FPI_NO_EVIDENCE_BEFORE_CHARGE');
      st = 'met';
      extra = { evidence_date: pp.evidence_of_continuous_coverage_date, note: 'evidence was received only after the evidence window closed on ' + isoOf(reminder.z + 15) + ', so the charge assessed before evidence arrived was permitted; the cancellation-and-refund clock is evaluated separately' };
    }
    elements.push(element('no_continuous_coverage_evidence_before_charge', CITE.evidence_window,
      'by the end of the 15-day period beginning on the reminder delivery date the servicer has not received evidence of continuous compliant coverage (a charge assessed despite such evidence is not permitted)',
      st, extra));
  }

  // -- Element 5: first-notice content set (c)(2), evaluated only when supplied.
  if (pp.first_notice_content_items !== undefined && pp.first_notice_content_items !== null) {
    const supplied = Array.isArray(pp.first_notice_content_items) ? pp.first_notice_content_items : [];
    const missing = [];
    for (let i = 0; i < FIRST_NOTICE_CONTENT_ITEMS.length; i++) {
      if (supplied.indexOf(FIRST_NOTICE_CONTENT_ITEMS[i]) === -1) missing.push(FIRST_NOTICE_CONTENT_ITEMS[i]);
    }
    const unknown = [];
    for (let i = 0; i < supplied.length; i++) {
      if (FIRST_NOTICE_CONTENT_ITEMS.indexOf(supplied[i]) === -1) unknown.push(supplied[i]);
    }
    const ok = missing.length === 0 && unknown.length === 0;
    if (ok) {
      compliance_flags.push('FPI_NOTICE_CONTENT_COMPLETE');
    } else {
      compliance_flags.push('FPI_NOTICE_CONTENT_INCOMPLETE');
    }
    elements.push(element('first_notice_content', CITE.first_notice_content,
      'the first notice sets forth the information required by the content paragraph (all eleven enumerated items)',
      ok ? 'met' : 'breached',
      { missing_items: missing, unknown_items: unknown }));
  } else {
    elements.push(element('first_notice_content', CITE.first_notice_content,
      'the first notice sets forth the information required by the content paragraph (all eleven enumerated items)',
      'not_applicable',
      { note: 'first_notice_content_items not supplied; content checklist not evaluated' }));
  }

  // -- Element 6: mailing class at or above first-class (f), evaluated only when supplied.
  if (pp.notice_mail_class !== undefined && pp.notice_mail_class !== null && pp.notice_mail_class !== '') {
    const mc = pp.notice_mail_class;
    if (MAIL_CLASSES.indexOf(mc) === -1) {
      compliance_flags.push('INVALID_MAIL_CLASS_REFUSED');
      return {
        output_payload: refusalPayload('INVALID_MAIL_CLASS_REFUSED', 'invalid_mail_class', {
          parameter: 'notice_mail_class', allowed: MAIL_CLASSES,
        }),
        compliance_flags,
      };
    }
    const ok = mc !== 'other';
    if (ok) {
      compliance_flags.push('FPI_MAIL_CLASS_MET');
    } else {
      compliance_flags.push('FPI_MAIL_CLASS_BREACHED');
    }
    elements.push(element('mail_class_at_least_first_class', CITE.mail_class,
      'mailed notices use a class of mail not less than first-class mail',
      ok ? 'met' : 'breached',
      { mail_class: mc }));
  } else {
    elements.push(element('mail_class_at_least_first_class', CITE.mail_class,
      'mailed notices use a class of mail not less than first-class mail',
      'not_applicable',
      { note: 'notice_mail_class not supplied; mailing check not evaluated' }));
  }

  // -- Refund evaluation (g): runs whenever evidence of continuous coverage is present.
  let refundEvaluation = null;
  if (evidenceZ !== null) {
    const bs = parseIso(pp.borrower_coverage_start);
    const be = parseIso(pp.borrower_coverage_end);
    if (bs === null || be === null) {
      compliance_flags.push('PRO_RATA_INPUTS_MISSING_REFUSED');
      return {
        output_payload: refusalPayload('PRO_RATA_INPUTS_MISSING_REFUSED', 'borrower_coverage_period_missing', {
          parameter: bs === null ? 'borrower_coverage_start' : 'borrower_coverage_end',
          expected: 'strict YYYY-MM-DD calendar date within 1970-2099 (required to compute the overlapping-coverage refund)',
        }),
        compliance_flags,
      };
    }
    if (be < bs) {
      compliance_flags.push('INVALID_COVERAGE_PERIOD_REFUSED');
      return {
        output_payload: refusalPayload('INVALID_COVERAGE_PERIOD_REFUSED', 'borrower_coverage_end_before_start', {}),
        compliance_flags,
      };
    }
    const totalDays = ce - cs + 1;
    const overlap = overlapDays(cs, ce, bs, be);
    const owed = round2(charged * overlap / totalDays);
    const refundDueZ = evidenceZ + 15;
    let cancelZ = null;
    if (pp.cancellation_date !== undefined && pp.cancellation_date !== null && pp.cancellation_date !== '') {
      cancelZ = parseIso(pp.cancellation_date);
      if (cancelZ === null) {
        compliance_flags.push('INVALID_OPTIONAL_DATE_REFUSED');
        return {
          output_payload: refusalPayload('INVALID_OPTIONAL_DATE_REFUSED', 'invalid_or_ambiguous_iso_date', {
            parameter: 'cancellation_date', expected: 'strict YYYY-MM-DD calendar date within 1970-2099',
          }),
          compliance_flags,
        };
      }
    }
    let refundZ = null;
    let refunded = null;
    if (pp.refund_amount !== undefined && pp.refund_amount !== null && pp.refund_amount !== '') {
      refunded = numAmount(pp.refund_amount);
      if (refunded === null) {
        compliance_flags.push('INVALID_AMOUNT_REFUSED');
        return {
          output_payload: refusalPayload('INVALID_AMOUNT_REFUSED', 'invalid_refund_amount', {
            parameter: 'refund_amount', expected: 'non-negative finite number',
          }),
          compliance_flags,
        };
      }
    }
    if (pp.refund_date !== undefined && pp.refund_date !== null && pp.refund_date !== '') {
      refundZ = parseIso(pp.refund_date);
      if (refundZ === null) {
        compliance_flags.push('INVALID_OPTIONAL_DATE_REFUSED');
        return {
          output_payload: refusalPayload('INVALID_OPTIONAL_DATE_REFUSED', 'invalid_or_ambiguous_iso_date', {
            parameter: 'refund_date', expected: 'strict YYYY-MM-DD calendar date within 1970-2099',
          }),
          compliance_flags,
        };
      }
    }
    let st;
    if (refundZ !== null && refunded !== null) {
      const onTime = refundZ <= refundDueZ;
      const sufficient = refunded >= owed - 0.01;
      if (onTime && sufficient) {
        compliance_flags.push('FPI_REFUND_MET');
        st = 'met';
      } else {
        compliance_flags.push('FPI_REFUND_BREACHED');
        st = 'breached';
      }
    } else {
      compliance_flags.push('FPI_REFUND_OUTSTANDING');
      st = 'outstanding';
    }
    refundEvaluation = {
      cited_paragraph: CITE.cancel_refund,
      requirement: 'within 15 days of receiving evidence of continuous compliant coverage: cancel the force-placed insurance and refund all premium charges and related fees for any period of overlapping insurance coverage',
      state: st,
      evidence_date: pp.evidence_of_continuous_coverage_date,
      refund_due_date: isoOf(refundDueZ),
      days_allowed: 15,
      charged_coverage_days: totalDays,
      overlapping_coverage_days: overlap,
      pro_rata_refund_owed: owed,
      cancellation_date: cancelZ === null ? null : isoOf(cancelZ),
      refund_date: refundZ === null ? null : isoOf(refundZ),
      refund_amount_reported: refunded,
      breach_reasons: [],
    };
    if (st === 'breached') {
      refundEvaluation.breach_reasons = [];
      if (refundZ !== null && refundZ > refundDueZ) refundEvaluation.breach_reasons.push('refund_after_15_day_deadline');
      if (refunded !== null && refunded < owed - 0.01) refundEvaluation.breach_reasons.push('refund_below_pro_rata_amount');
    }
  }

  // -- Benchmark element (h): values only, always emitted, never a judgement.
  let benchmark = null;
  {
    const quoteRaw = pp.alternative_quote_amount;
    if (quoteRaw === undefined || quoteRaw === null || quoteRaw === '') {
      compliance_flags.push('FPI_BENCHMARK_QUOTE_MISSING_REFUSED');
      elements.push(element('premium_benchmark', CITE.benchmark,
        'charges related to force-placed insurance must be bona fide and reasonable (the node reports the comparison values only)',
        'refused',
        { refused_because: 'alternative_quote_missing', note: VALUES_ONLY_NOTE }));
      benchmark = {
        state: 'refused',
        refused_because: 'alternative_quote_missing',
        charged_premium_amount: charged,
        comparison_table: null,
        note: VALUES_ONLY_NOTE,
      };
    } else {
      const quote = numAmount(quoteRaw);
      if (quote === null) {
        compliance_flags.push('INVALID_AMOUNT_REFUSED');
        return {
          output_payload: refusalPayload('INVALID_AMOUNT_REFUSED', 'invalid_alternative_quote_amount', {
            parameter: 'alternative_quote_amount', expected: 'non-negative finite number',
          }),
          compliance_flags,
        };
      }
      compliance_flags.push('FPI_BENCHMARK_VALUES_REPORTED');
      const diff = round2(charged - quote);
      const ratio = quote > 0 ? round2(charged / quote) : null;
      elements.push(element('premium_benchmark', CITE.benchmark,
        'charges related to force-placed insurance must be bona fide and reasonable (the node reports the comparison values only)',
        'met',
        { note: VALUES_ONLY_NOTE }));
      benchmark = {
        state: 'reported',
        charged_premium_amount: charged,
        alternative_quote_amount: quote,
        difference_charged_minus_quote: diff,
        ratio_charged_to_quote: ratio,
        comparison_table: [
          { item: 'charged_premium', value: charged },
          { item: 'borrower_alternative_quote', value: quote },
          { item: 'difference_charged_minus_quote', value: diff },
          { item: 'ratio_charged_to_quote', value: ratio },
        ],
        note: VALUES_ONLY_NOTE,
      };
    }
  }

  // -- Overall verdict. The sequence verdict covers the notice-sequence and
  // refund elements; a benchmark REFUSAL (missing quote values) is a missing
  // comparison, not a sequence breach, and never flips the verdict.
  let verdict = 'compliant';
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.element_id === 'premium_benchmark') continue;
    const st = el.state;
    if (st === 'refused') { verdict = 'non_compliant'; break; }
    if (st === 'breached') { verdict = 'non_compliant'; break; }
  }
  if (verdict === 'compliant' && refundEvaluation !== null && refundEvaluation.state === 'breached') {
    verdict = 'non_compliant';
  }
  if (verdict === 'compliant') {
    compliance_flags.push('FPI_SEQUENCE_COMPLIANT');
  } else {
    compliance_flags.push('FPI_SEQUENCE_NON_COMPLIANT');
  }

  const output_payload = {
    verdict,
    elements,
    premium_benchmark: benchmark,
    refund_evaluation: refundEvaluation,
    charge_summary: {
      charge_date: pp.charge_date,
      charged_premium_amount: charged,
      charge_coverage_start: pp.charge_coverage_start,
      charge_coverage_end: pp.charge_coverage_end,
    },
    evidence: {
      record_type: 'force_placed_insurance_notice_check', tool_id: TOOL_ID,
      tool_version: TOOL_VERSION, refused: false,
    },
    manual_review_required: verdict !== 'compliant',
  };
  return { output_payload, compliance_flags };
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
