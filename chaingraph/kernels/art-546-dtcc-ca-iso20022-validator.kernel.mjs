import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-546-dtcc-ca-iso20022-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_dtcc_ca_iso20022_message',
  mandate_type: 'compliance_mandate', gpu: false,
};

// DTC corporate-actions ISO 20022 message-shape structural validator (message-shape half only --
// the entitlement/dividend/rights math half is a separate node, art-547-corporate-action-
// entitlement-recompute). Validates a single CA event message (notification / election /
// allocation) against the DTC ISO 20022 field set per DTCC Important Notice 23890-26 (legacy
// corporate-actions message format decommission -- a DTCC OPERATOR MANDATE, not a regulator
// deadline: DTCC is the market utility/CSD operating the migration, not a rule-making regulator).
// No external schema fetch -- the DTC message field set is versioned constants, same discipline
// as the CBPR+ structured-address lint (art-241) and camt.053 BkTxCd classification (art-258).
// ZERO PII: CUSIP, participant number, dates, and event codes only -- no beneficial-owner data.

const TABLE_VERSION = 'DTC-CA-ISO20022-FIELDSET-23890-26-V1';
const TABLE_SOURCE = 'DTCC Important Notice 23890-26 (legacy corporate-actions message format decommission -- DTCC operator mandate); ISO 20022 seev.031/seev.033/seev.035 corporate-action message family field set';

// ISO 20022 CAEV (CorporateActionEventType) external code subset relevant to DTC CA processing.
const CAEV_CODES = new Set([
  'DVCA', // Cash Dividend
  'DVSE', // Stock Dividend
  'RHDI', // Rights Distribution
  'SPLF', // Forward Split
  'SPLR', // Reverse Split
  'MRGR', // Merger
  'EXOF', // Exchange Offer
  'TEND', // Tender Offer
  'REDM', // Redemption
  'SHPR', // Shares Premium Dividend
]);

const MESSAGE_FUNCTIONS = new Set(['NOTIFICATION', 'ELECTION', 'ALLOCATION']);

// Required fields per DTC CA message-function shape (DTCC Important Notice 23890-26 field set).
const REQUIRED_FIELDS = {
  NOTIFICATION: ['event_type', 'cusip', 'record_date', 'payable_date'],
  ELECTION: ['event_type', 'cusip', 'election_option', 'election_deadline'],
  ALLOCATION: ['event_type', 'cusip', 'allocated_quantity', 'allocation_date'],
};

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function isIsoDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function finiteNum(v) { const n = Number(v); return isFinite(n) && !isNaN(n) ? n : null; }

export function compute(pp) {
  pp = pp || {};

  const message_function = safeStr(pp.message_function).toUpperCase();
  const event_type = safeStr(pp.event_type).toUpperCase();
  const cusip = safeStr(pp.cusip).toUpperCase();
  const dtc_participant_number = safeStr(pp.dtc_participant_number);
  const record_date = safeStr(pp.record_date);
  const payable_date = safeStr(pp.payable_date);
  const election_option = safeStr(pp.election_option);
  const election_deadline = safeStr(pp.election_deadline);
  const allocation_date = safeStr(pp.allocation_date);
  const allocated_quantity = pp.allocated_quantity;
  const reference_id = safeStr(pp.reference_id);

  const violations = [];

  const validFunction = MESSAGE_FUNCTIONS.has(message_function);
  if (!validFunction) {
    violations.push({
      code: 'INVALID_MESSAGE_FUNCTION', severity: 'ERROR', field: 'message_function',
      message: 'message_function "' + (message_function || '(empty)') + '" is not one of NOTIFICATION, ELECTION, ALLOCATION.',
    });
  }

  if (!event_type) {
    violations.push({ code: 'MISSING_EVENT_TYPE', severity: 'ERROR', field: 'event_type', message: 'event_type (ISO 20022 CAEV code) is required.' });
  } else if (!CAEV_CODES.has(event_type)) {
    violations.push({ code: 'UNKNOWN_CAEV_CODE', severity: 'ERROR', field: 'event_type', message: 'event_type "' + event_type + '" is not a recognized ISO 20022 CAEV code in the DTC CA field set (' + TABLE_VERSION + ').' });
  }

  if (!cusip) {
    violations.push({ code: 'MISSING_CUSIP', severity: 'ERROR', field: 'cusip', message: 'cusip is required to identify the security under corporate action.' });
  } else if (!/^[A-Z0-9]{9}$/.test(cusip)) {
    violations.push({ code: 'INVALID_CUSIP_FORMAT', severity: 'ERROR', field: 'cusip', message: 'cusip "' + cusip + '" is not 9 alphanumeric characters.' });
  }

  if (!dtc_participant_number) {
    violations.push({ code: 'MISSING_DTC_PARTICIPANT_NUMBER', severity: 'ERROR', field: 'dtc_participant_number', message: 'dtc_participant_number is required for DTC CA message routing.' });
  } else if (!/^\d{4,8}$/.test(dtc_participant_number)) {
    violations.push({ code: 'INVALID_DTC_PARTICIPANT_NUMBER', severity: 'ERROR', field: 'dtc_participant_number', message: 'dtc_participant_number "' + dtc_participant_number + '" must be 4-8 digits per DTC participant numbering.' });
  }

  // Message-function-specific required-field checks (DTCC Important Notice 23890-26 shape).
  const requiredForFunction = validFunction ? REQUIRED_FIELDS[message_function] : [];
  const fieldValues = {
    event_type, cusip, record_date, payable_date,
    election_option, election_deadline, allocated_quantity, allocation_date,
  };
  for (const f of requiredForFunction) {
    const v = fieldValues[f];
    const present = f === 'allocated_quantity' ? finiteNum(v) !== null : !!safeStr(v);
    if (!present) {
      violations.push({
        code: 'MISSING_REQUIRED_FIELD', severity: 'ERROR', field: f,
        message: f + ' is required for a ' + message_function + ' message per the DTC CA ISO 20022 field set (' + TABLE_VERSION + ').',
      });
    }
  }

  if (record_date && !isIsoDate(record_date)) {
    violations.push({ code: 'INVALID_DATE_FORMAT', severity: 'ERROR', field: 'record_date', message: 'record_date "' + record_date + '" must be an ISO 8601 date (YYYY-MM-DD).' });
  }
  if (payable_date && !isIsoDate(payable_date)) {
    violations.push({ code: 'INVALID_DATE_FORMAT', severity: 'ERROR', field: 'payable_date', message: 'payable_date "' + payable_date + '" must be an ISO 8601 date (YYYY-MM-DD).' });
  }
  if (election_deadline && !isIsoDate(election_deadline)) {
    violations.push({ code: 'INVALID_DATE_FORMAT', severity: 'ERROR', field: 'election_deadline', message: 'election_deadline "' + election_deadline + '" must be an ISO 8601 date (YYYY-MM-DD).' });
  }
  if (allocation_date && !isIsoDate(allocation_date)) {
    violations.push({ code: 'INVALID_DATE_FORMAT', severity: 'ERROR', field: 'allocation_date', message: 'allocation_date "' + allocation_date + '" must be an ISO 8601 date (YYYY-MM-DD).' });
  }

  if (message_function === 'ALLOCATION' && allocated_quantity !== undefined && allocated_quantity !== '') {
    const q = finiteNum(allocated_quantity);
    if (q === null) {
      violations.push({ code: 'NON_FINITE_QUANTITY', severity: 'ERROR', field: 'allocated_quantity', message: 'allocated_quantity must be a finite number.' });
    } else if (q < 0) {
      violations.push({ code: 'NEGATIVE_QUANTITY', severity: 'ERROR', field: 'allocated_quantity', message: 'allocated_quantity cannot be negative.' });
    }
  }

  const error_count = violations.filter((v) => v.severity === 'ERROR').length;
  const structure_valid = error_count === 0;
  const readiness_pct = structure_valid ? 100 : Math.max(0, 100 - error_count * 15);

  return {
    structure_valid,
    message_function: validFunction ? message_function : 'UNKNOWN',
    event_type: event_type || null,
    error_count,
    violations,
    readiness_pct,
    reference_id: reference_id || null,
    dtcc_operator_mandate_basis: 'DTCC Important Notice 23890-26 -- legacy corporate-actions message format decommission (DTCC operator mandate: PSE testing 2026-01, Test Facility 2026-03, PROD testing 2026-07, legacy decommission Q3 2027). This is a market-infrastructure migration deadline set by DTCC as CSD operator, NOT a regulatory or statutory deadline.',
    disambiguation: 'validate_dtcc_ca_iso20022_message checks structural message-shape validity (required fields, CAEV code, CUSIP/date formats) of a single DTC corporate-action event message (notification / election / allocation). It does NOT compute entitlement, dividend, rights, or split amounts -- for deterministic entitlement math per record date use corporate-action entitlement recompute (art-547), which chains from this node\'s output.',
    pii_note: 'ZERO PII: CUSIP, DTC participant number, event codes, and dates only. No beneficial-owner name, account, or personal identifier enters this kernel -- use synthetic reference IDs.',
    not_legal_advice: 'Not legal, tax, or accounting advice. Message-shape validation output requires review by qualified operations staff before use in production DTC CA processing.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const compliance_flags = [];
  if (!output_payload.structure_valid) compliance_flags.push('DTC_CA_MESSAGE_SHAPE_INVALID');
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
