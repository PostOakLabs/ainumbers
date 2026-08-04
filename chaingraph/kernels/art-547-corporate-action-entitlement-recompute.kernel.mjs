import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-547-corporate-action-entitlement-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_corporate_action_entitlement',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Deterministic dividend/rights/split entitlement math per record date (entitlement half only --
// the message-shape validation half is a separate node, art-546-dtcc-ca-iso20022-validator, which
// chains into this node's input). entitlement = position_qty * ratio_or_rate, with rounding/
// proration rules per corporate-action type -- all caller-supplied, no security-master lookup,
// no market-data fetch. Field set versioned per DTCC Important Notice 23890-26 (legacy
// corporate-actions message format decommission -- a DTCC OPERATOR MANDATE, not a regulator
// deadline: DTCC is the market utility/CSD operating the migration, not a rule-making regulator).
// ZERO PII: position quantity, rate/ratio, event type, dates -- no beneficial-owner data.

const TABLE_VERSION = 'DTC-CA-ISO20022-FIELDSET-23890-26-V1';
const TABLE_SOURCE = 'DTCC Important Notice 23890-26 (legacy corporate-actions message format decommission -- DTCC operator mandate); ISO 20022 seev.031/seev.033/seev.035 corporate-action message family field set';

// ISO 20022 CAEV codes this entitlement kernel computes proration for. Cash-rate types pay a
// per-share cash amount; share-ratio types issue additional/adjusted shares (fractional residue
// is flagged for cash-in-lieu, never priced here -- no market data enters this kernel).
const CASH_RATE_TYPES = new Set(['DVCA']); // Cash Dividend
const SHARE_RATIO_TYPES = new Set(['DVSE', 'RHDI', 'SPLF', 'SPLR']); // Stock Div, Rights, Fwd Split, Rev Split

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function isIsoDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function finiteNum(v) { const n = Number(v); return isFinite(n) && !isNaN(n) ? n : null; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

export function compute(pp) {
  pp = pp || {};

  const corporate_action_type = safeStr(pp.corporate_action_type).toUpperCase();
  const position_qty = pp.position_qty;
  const ratio_or_rate = pp.ratio_or_rate;
  const record_date = safeStr(pp.record_date);
  const reference_id = safeStr(pp.reference_id);

  const violations = [];

  const isCashType = CASH_RATE_TYPES.has(corporate_action_type);
  const isShareType = SHARE_RATIO_TYPES.has(corporate_action_type);
  const validType = isCashType || isShareType;
  if (!validType) {
    violations.push({
      code: 'INVALID_CORPORATE_ACTION_TYPE', severity: 'ERROR', field: 'corporate_action_type',
      message: 'corporate_action_type "' + (corporate_action_type || '(empty)') + '" is not one of DVCA, DVSE, RHDI, SPLF, SPLR (' + TABLE_VERSION + ').',
    });
  }

  const qty = finiteNum(position_qty);
  if (qty === null) {
    violations.push({ code: 'MISSING_POSITION_QTY', severity: 'ERROR', field: 'position_qty', message: 'position_qty is required and must be a finite number.' });
  } else if (qty < 0) {
    violations.push({ code: 'NEGATIVE_POSITION_QTY', severity: 'ERROR', field: 'position_qty', message: 'position_qty cannot be negative.' });
  }

  const rate = finiteNum(ratio_or_rate);
  if (rate === null) {
    violations.push({ code: 'MISSING_RATIO_OR_RATE', severity: 'ERROR', field: 'ratio_or_rate', message: 'ratio_or_rate is required and must be a finite number.' });
  } else if (rate <= 0) {
    violations.push({ code: 'NON_POSITIVE_RATIO_OR_RATE', severity: 'ERROR', field: 'ratio_or_rate', message: 'ratio_or_rate must be positive.' });
  }

  if (!record_date) {
    violations.push({ code: 'MISSING_RECORD_DATE', severity: 'ERROR', field: 'record_date', message: 'record_date is required to date the entitlement computation.' });
  } else if (!isIsoDate(record_date)) {
    violations.push({ code: 'INVALID_DATE_FORMAT', severity: 'ERROR', field: 'record_date', message: 'record_date "' + record_date + '" must be an ISO 8601 date (YYYY-MM-DD).' });
  }

  const error_count = violations.filter((v) => v.severity === 'ERROR').length;
  const computable = error_count === 0;

  let entitlement_mode = null;
  let cash_entitlement = null;
  let whole_shares = null;
  let fractional_shares = null;
  let fractional_shares_present = false;

  if (computable) {
    if (isCashType) {
      entitlement_mode = 'CASH';
      cash_entitlement = round2(qty * rate);
    } else {
      entitlement_mode = 'SHARES';
      const raw_shares = qty * rate;
      whole_shares = Math.floor(raw_shares);
      fractional_shares = round2(raw_shares - whole_shares);
      fractional_shares_present = fractional_shares > 0;
    }
  }

  return {
    entitlement_computed: computable,
    corporate_action_type: validType ? corporate_action_type : 'UNKNOWN',
    entitlement_mode,
    cash_entitlement,
    whole_shares,
    fractional_shares,
    fractional_shares_present,
    error_count,
    violations,
    reference_id: reference_id || null,
    dtcc_operator_mandate_basis: 'DTCC Important Notice 23890-26 -- legacy corporate-actions message format decommission (DTCC operator mandate: PSE testing 2026-01, Test Facility 2026-03, PROD testing 2026-07, legacy decommission Q3 2027). This is a market-infrastructure migration deadline set by DTCC as CSD operator, NOT a regulatory or statutory deadline.',
    disambiguation: 'recompute_corporate_action_entitlement computes deterministic dividend/rights/split entitlement (entitlement = position_qty x ratio_or_rate, with per-type rounding/proration) for a single position at a record date. It does NOT validate DTC ISO 20022 message shape -- for structural message-shape validation use the DTC CA ISO 20022 message validator (art-546), which chains into this node\'s input. Fractional-share residue is FLAGGED, never priced -- this kernel fetches no market data and performs no security-master lookup.',
    pii_note: 'ZERO PII: position quantity, rate/ratio, corporate-action type, and record date only. No beneficial-owner name, account, or personal identifier enters this kernel -- use synthetic reference IDs.',
    not_legal_advice: 'Not legal, tax, or accounting advice. Entitlement recompute output requires review by qualified operations staff before use in production DTC CA processing.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const compliance_flags = [];
  if (!output_payload.entitlement_computed) compliance_flags.push('DTC_CA_ENTITLEMENT_NOT_COMPUTABLE');
  if (output_payload.fractional_shares_present) compliance_flags.push('DTC_CA_FRACTIONAL_SHARES_PRESENT');
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
