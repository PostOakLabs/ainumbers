/**
 * art-54-digital-trade-rules-checker.kernel.mjs
 * Wave 12 — Digital Trade Rules Compliance Checker (eUCP / eURC / URDTT).
 * Machine-checks a digital trade presentation against ICC digital rulebooks:
 * eUCP v2.1, eURC v1.1, URDTT v1.0.
 * Pure decision kernel — no DOM, no window, no Date.now().
 * Spec: WORKFLOW-CANDIDATES-WAVE12_2026-06-19.md §2.3.
 * Citations: ICC eUCP v2.1; ICC eURC v1.1; ICC URDTT v1.0.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-54-digital-trade-rules-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_digital_trade_rules',
  mandate_type: 'scheme_rule',
  gpu:          false,
};

// ──────────────────────────────────────────────────────────────────────────────
// Rule-set check tables
// Each check fn returns null (pass) or {rule_ref, severity, detail, remediation}
// ──────────────────────────────────────────────────────────────────────────────

/**
 * eUCP v2.1 checks.
 * Key articles consulted: e3 (definitions), e6 (format specification), e7 (electronic address),
 * e8 (examination), e10 (data corruption), e11 (re-presentation), e14 (expiry date/place).
 */
function checkEUCP(pp) {
  const discrepancies = [];
  const { presentation = [], lc_terms = null, electronic_address_provided = false, format_specified = false } = pp;

  // e6: format must be specified in the credit
  if (!format_specified) {
    discrepancies.push({ rule_ref: 'eUCP v2.1 Art. e6', severity: 'major', detail: 'Electronic record format has not been specified in the credit. eUCP e6 requires the format to be specified; if not, any format will be acceptable but the presenter is at risk of rejection.', remediation: 'Specify the acceptable electronic record format (e.g., PDF, XML/EN16931) in the credit terms before presentation.' });
  }

  // e7: electronic address must be provided for delivery
  if (!electronic_address_provided) {
    discrepancies.push({ rule_ref: 'eUCP v2.1 Art. e7', severity: 'major', detail: 'No electronic address provided for delivery of electronic records. eUCP e7 requires the nominated bank or issuing bank to provide an electronic address.', remediation: 'Provide a valid electronic address (URL, email, SWIFT BIC or eBL platform address) for delivery of electronic records.' });
  }

  // Check each document in the presentation
  for (const doc of presentation) {
    const label = doc.doc_type || 'unknown document';

    // Data integrity
    if (doc.data_integrity_ok === false) {
      discrepancies.push({ rule_ref: 'eUCP v2.1 Art. e10', severity: 'major', detail: `${label}: data integrity check failed. eUCP e10 requires that if a nominated bank or issuing bank receives a corrupted electronic record it must inform the presenter and allow re-presentation.`, remediation: `Re-transmit ${label} with intact data. Verify the electronic record was not corrupted during transmission.` });
    }

    // Expiry — presented_at vs expiry
    if (doc.presented_at && doc.expiry) {
      const presentedDate = new Date(doc.presented_at);
      const expiryDate    = new Date(doc.expiry);
      if (!isNaN(presentedDate) && !isNaN(expiryDate) && presentedDate > expiryDate) {
        discrepancies.push({ rule_ref: 'eUCP v2.1 Art. e14', severity: 'critical', detail: `${label}: presented at ${doc.presented_at} after expiry ${doc.expiry}. eUCP e14 requires electronic records to be received by the bank no later than the expiry date/time.`, remediation: 'Present the electronic record before the credit expiry date. If the expiry fell on a banking-holiday, check eUCP e14 extension provisions.' });
      }
    }

    // Format check (informational if not specified)
    if (doc.format && !['electronic-record', 'data'].includes(doc.format)) {
      discrepancies.push({ rule_ref: 'eUCP v2.1 Art. e3', severity: 'minor', detail: `${label}: format "${doc.format}" is not a standard eUCP electronic-record category. eUCP e3 defines "electronic record" as data created, generated, sent, communicated, received or stored by electronic means.`, remediation: 'Confirm that the record satisfies the eUCP e3 definition of an electronic record, or substitute with a paper original under UCP 600.' });
    }
  }

  // LC terms checks
  if (lc_terms) {
    // Amount / tolerance
    const tol = lc_terms.tolerance_pct != null ? Number(lc_terms.tolerance_pct) / 100 : 0.10; // UCP 600 Art. 30c default 10%
    if (lc_terms.invoice_amount != null && lc_terms.amount != null) {
      const inv = Number(lc_terms.invoice_amount);
      const lca = Number(lc_terms.amount);
      if (inv > lca * (1 + tol)) {
        discrepancies.push({ rule_ref: 'eUCP v2.1 / UCP 600 Art. 18b', severity: 'major', detail: `Invoice amount ${inv} ${lc_terms.currency || ''} exceeds LC amount ${lca} plus tolerance ${(tol*100).toFixed(0)}%.`, remediation: 'Reduce the invoice amount to within the LC credit amount plus stated tolerance, or obtain an amendment.' });
      }
    }

    // Presentation period
    if (lc_terms.presentation_period_days != null && lc_terms.latest_shipment && presentation.length > 0) {
      const firstDoc = presentation.find(d => d.presented_at);
      if (firstDoc?.presented_at && firstDoc?.presented_at && lc_terms.latest_shipment) {
        const shipDate  = new Date(lc_terms.latest_shipment);
        const presDate  = new Date(firstDoc.presented_at);
        const periodDays = lc_terms.presentation_period_days;
        const diffDays   = (presDate - shipDate) / 86400000;
        if (!isNaN(diffDays) && diffDays > periodDays) {
          discrepancies.push({ rule_ref: 'eUCP v2.1 / UCP 600 Art. 29', severity: 'critical', detail: `Presentation ${diffDays.toFixed(0)} days after latest shipment date exceeds the required ${periodDays}-day presentation period.`, remediation: 'Re-present within the presentation period, or request a credit amendment extending the presentation deadline.' });
        }
      }
    }
  }

  return discrepancies;
}

/**
 * eURC v1.1 checks (Electronic Rules for Collections).
 * Key articles: e2 (application/definitions), e7 (electronic address for collection), e10 (data corruption).
 */
function checkEURC(pp) {
  const discrepancies = [];
  const { presentation = [], electronic_address_provided = false, format_specified = false } = pp;

  if (!electronic_address_provided) {
    discrepancies.push({ rule_ref: 'eURC v1.1 Art. e7', severity: 'major', detail: 'Electronic address for delivery of collection documents not provided. eURC e7 requires the collecting bank to provide an electronic delivery address.', remediation: 'Provide an electronic address (email/URL/platform address) for delivery of electronic collection documents.' });
  }

  if (!format_specified) {
    discrepancies.push({ rule_ref: 'eURC v1.1 Art. e6', severity: 'minor', detail: 'Electronic record format is not specified. Under eURC v1.1 the presenting bank should specify the format for electronic presentation.', remediation: 'Specify the document format in the collection instruction.' });
  }

  for (const doc of presentation) {
    const label = doc.doc_type || 'unknown document';
    if (doc.data_integrity_ok === false) {
      discrepancies.push({ rule_ref: 'eURC v1.1 Art. e10', severity: 'major', detail: `${label}: data integrity failure. eURC e10 permits re-presentation of a corrupted electronic record once notified.`, remediation: `Re-transmit ${label} intact to the collecting bank.` });
    }
    if (doc.presented_at && doc.expiry) {
      const pd = new Date(doc.presented_at), ed = new Date(doc.expiry);
      if (!isNaN(pd) && !isNaN(ed) && pd > ed) {
        discrepancies.push({ rule_ref: 'eURC v1.1 Art. e14', severity: 'critical', detail: `${label}: presented after expiry.`, remediation: 'Re-present within the agreed collection period.' });
      }
    }
  }

  return discrepancies;
}

/**
 * URDTT v1.0 checks (Uniform Rules for Digital Trade Transactions).
 * Key articles: Art. 3 (definitions — digital trade transaction), Art. 8 (data-set completeness),
 * Art. 12 (examination), Art. 14 (data corruption), Art. 16 (payment obligation).
 */
function checkURDTT(pp) {
  const discrepancies = [];
  const { presentation = [], lc_terms = null } = pp;

  // Art. 3 / 8: open-account digital transaction — data elements must be complete
  const REQUIRED_FIELDS = ['doc_type', 'party_seller', 'party_buyer', 'goods_desc'];
  for (const doc of presentation) {
    const label = doc.doc_type || 'unknown document';
    for (const f of REQUIRED_FIELDS) {
      if (!doc[f]) {
        discrepancies.push({ rule_ref: 'URDTT v1.0 Art. 8', severity: 'major', detail: `${label}: required data element "${f}" is missing. URDTT Art. 8 requires a complete set of data elements for a valid digital trade transaction.`, remediation: `Add the "${f}" data element to the ${label} dataset.` });
      }
    }
    if (doc.data_integrity_ok === false) {
      discrepancies.push({ rule_ref: 'URDTT v1.0 Art. 14', severity: 'major', detail: `${label}: data integrity check failed. URDTT Art. 14 permits re-presentation following notification of data corruption.`, remediation: `Re-transmit ${label} with intact data elements.` });
    }
    if (doc.presented_at && doc.expiry) {
      const pd = new Date(doc.presented_at), ed = new Date(doc.expiry);
      if (!isNaN(pd) && !isNaN(ed) && pd > ed) {
        discrepancies.push({ rule_ref: 'URDTT v1.0 Art. 12', severity: 'critical', detail: `${label}: presented after expiry.`, remediation: 'Re-present within the agreed transaction period.' });
      }
    }
  }

  // Payment obligation: at least one document with amount data expected
  if (lc_terms == null && !presentation.some(d => d.total_amount || d.amount)) {
    discrepancies.push({ rule_ref: 'URDTT v1.0 Art. 16', severity: 'minor', detail: 'No payment amount data found in the presentation. URDTT Art. 16 requires the payment obligation to be clearly expressed in the digital trade transaction dataset.', remediation: 'Include total_amount or payment amount in the digital trade transaction data elements.' });
  }

  return discrepancies;
}

// ──────────────────────────────────────────────────────────────────────────────

export function compute(pp) {
  const {
    rule_set                    = 'eUCP-2.1',
    presentation                = [],
    lc_terms                    = null,
    electronic_address_provided = false,
    format_specified            = false,
  } = pp;

  let discrepancies;
  switch (rule_set) {
    case 'eURC-1.1':  discrepancies = checkEURC(pp);  break;
    case 'URDTT-1.0': discrepancies = checkURDTT(pp); break;
    default:          discrepancies = checkEUCP(pp);   // eUCP-2.1
  }

  const critical = discrepancies.filter(d => d.severity === 'critical').length;
  const major    = discrepancies.filter(d => d.severity === 'major').length;
  const verdict  = discrepancies.length === 0 ? 'compliant' : 'discrepant';

  const expiry_check = presentation.some(d => {
    if (!d.presented_at || !d.expiry) return false;
    const pd = new Date(d.presented_at), ed = new Date(d.expiry);
    return !isNaN(pd) && !isNaN(ed) && pd > ed;
  }) ? 'expired' : 'within_period';

  const amount_check = lc_terms?.invoice_amount != null && lc_terms?.amount != null
    ? (Number(lc_terms.invoice_amount) > Number(lc_terms.amount) ? 'exceeds' : 'within')
    : 'no_lc_amount';

  const presentation_summary = {
    rule_set,
    doc_count:       presentation.length,
    discrepancy_count: discrepancies.length,
    critical_count:  critical,
    major_count:     major,
  };

  const output_payload = {
    verdict,
    discrepancies,
    presentation_summary,
    expiry_check,
    amount_check,
    note: `Digital trade rules check against ${rule_set}. Citations: ICC eUCP v2.1, eURC v1.1, URDTT v1.0. This is an educational rules-check tool, not a legal determination. Verify article references against the current ICC published text.`,
  };

  const compliance_flags = [];
  if (verdict === 'discrepant')   compliance_flags.push('DISCREPANT_PRESENTATION');
  if (expiry_check === 'expired') compliance_flags.push('EXPIRED_PRESENTATION');
  if (!format_specified)          compliance_flags.push('FORMAT_NOT_SPECIFIED_eUCP_e7');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
