import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-244-gpi-tracker-lifecycle-simulator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'simulate_gpi_tracker_lifecycle',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Simulates SWIFT GPI tracker status lifecycle and validates state machine transitions.
// Models pacs.002 status codes per SWIFT GPI Universal Confirmation rules:
//   PDNG -> ACSP -> ACSP/ACWC -> ACCC | RJCT
// Checks Universal Confirmation SLA (24 hours from ACSP to ACCC).
// table_version: "SWIFT-GPI-STATUS-LIFECYCLE-V1"
// Source: SWIFT GPI Tracker specification (swift.com/our-solutions/global-financial-messaging/swift-gpi);
//         ISO 20022 pacs.002 ExternalPaymentTransactionStatus1Code.

const TABLE_VERSION = 'SWIFT-GPI-STATUS-LIFECYCLE-V1';
const TABLE_SOURCE = 'SWIFT GPI Tracker specification (swift.com/our-solutions/global-financial-messaging/swift-gpi); SWIFT Innotribe GPI Universal Confirmation SLA rules; ISO 20022 pacs.002 ExternalPaymentTransactionStatus1Code';

const GPI_SLA_HOURS = 24; // Universal Confirmation SLA: ACCC within 24h of ACSP

// Valid GPI status codes
const VALID_STATUSES = ['PDNG', 'ACSP', 'ACSP/ACWC', 'ACCC', 'RJCT'];
const TERMINAL_STATUSES = ['ACCC', 'RJCT'];

// Valid state machine transitions
const VALID_TRANSITIONS = {
  'PDNG':    ['ACSP', 'RJCT'],
  'ACSP':    ['ACSP', 'ACSP/ACWC', 'ACCC', 'RJCT'],
  'ACSP/ACWC': ['ACSP', 'ACCC', 'RJCT'],
  'ACCC':    [],
  'RJCT':    [],
};

const STATUS_DESCRIPTIONS = {
  'PDNG':     'Payment is pending -- instruction received and awaiting processing by correspondent.',
  'ACSP':     'Accepted and in settlement process -- correspondent acknowledged the payment, settlement underway.',
  'ACSP/ACWC': 'Accepted and in settlement process, additional information awaited -- hold applied pending compliance or documentation.',
  'ACCC':     'Accepted and credit completed -- funds credited to beneficiary account. Terminal state.',
  'RJCT':     'Rejected -- payment could not be processed. Terminal state. Rejection reason (TxSts/StsRsnInf) required.',
};

function safeStr(v) { return typeof v === 'string' ? v.trim().toUpperCase() : ''; }
function safeNum(v) { const n = Number(v); return isFinite(n) ? n : 0; }

export function compute(pp) {
  pp = pp || {};

  const current_status  = safeStr(pp.current_status);
  const next_status     = safeStr(pp.next_status);
  const hours_elapsed   = safeNum(pp.hours_elapsed);
  const amount_usd      = safeNum(pp.amount_usd);

  const issues = [];

  const current_valid = VALID_STATUSES.indexOf(current_status) !== -1;
  const next_valid = next_status.length === 0 || VALID_STATUSES.indexOf(next_status) !== -1;

  if (current_status.length === 0) {
    issues.push({ code: 'CURRENT_STATUS_ABSENT', severity: 'ERROR', field: 'current_status', message: 'current_status is required. Valid GPI status codes: ' + VALID_STATUSES.join(', ') + '.' });
  } else if (!current_valid) {
    issues.push({ code: 'CURRENT_STATUS_INVALID', severity: 'ERROR', field: 'current_status', message: '"' + current_status + '" is not a recognised GPI status code. Valid: ' + VALID_STATUSES.join(', ') + '.' });
  }

  if (!next_valid) {
    issues.push({ code: 'NEXT_STATUS_INVALID', severity: 'ERROR', field: 'next_status', message: '"' + next_status + '" is not a recognised GPI status code.' });
  }

  let transition_valid = null;
  let transition_reason = '';
  if (current_valid && next_status.length > 0) {
    const allowed = VALID_TRANSITIONS[current_status] || [];
    if (TERMINAL_STATUSES.indexOf(current_status) !== -1) {
      transition_valid = false;
      transition_reason = current_status + ' is a terminal state. No further status transitions are allowed.';
      issues.push({ code: 'INVALID_TRANSITION_FROM_TERMINAL', severity: 'ERROR', field: 'next_status', message: transition_reason });
    } else if (allowed.indexOf(next_status) === -1) {
      transition_valid = false;
      transition_reason = current_status + ' -> ' + next_status + ' is not a valid GPI lifecycle transition. Allowed from ' + current_status + ': ' + (allowed.length > 0 ? allowed.join(', ') : 'none') + '.';
      issues.push({ code: 'INVALID_TRANSITION', severity: 'ERROR', field: 'next_status', message: transition_reason });
    } else {
      transition_valid = true;
      transition_reason = current_status + ' -> ' + next_status + ' is a valid GPI lifecycle transition.';
    }
  }

  // SLA check: Universal Confirmation SLA = ACCC within 24h of ACSP
  let sla_breached = false;
  let sla_note = '';
  if (current_status === 'ACSP' && next_status === 'ACCC' && hours_elapsed > 0) {
    sla_breached = hours_elapsed > GPI_SLA_HOURS;
    sla_note = sla_breached
      ? 'Universal Confirmation SLA breached: ' + hours_elapsed.toFixed(1) + 'h elapsed; ACCC must be sent within ' + GPI_SLA_HOURS + 'h of ACSP under SWIFT GPI Universal Confirmation rules.'
      : 'Universal Confirmation SLA met: ACCC sent ' + hours_elapsed.toFixed(1) + 'h after ACSP (limit ' + GPI_SLA_HOURS + 'h).';
    if (sla_breached) {
      issues.push({ code: 'SLA_BREACH_UNIVERSAL_CONFIRMATION', severity: 'ERROR', field: 'hours_elapsed', message: sla_note });
    }
  } else if (current_status === 'ACSP' && hours_elapsed > GPI_SLA_HOURS) {
    sla_note = 'Warning: ' + hours_elapsed.toFixed(1) + 'h elapsed in ACSP state without ACCC. Universal Confirmation SLA (' + GPI_SLA_HOURS + 'h) may be at risk.';
    issues.push({ code: 'SLA_AT_RISK', severity: 'WARNING', field: 'hours_elapsed', message: sla_note });
  }

  const stage_description = current_valid ? STATUS_DESCRIPTIONS[current_status] : 'Unknown status.';
  const is_terminal = TERMINAL_STATUSES.indexOf(current_status) !== -1;
  const is_settled = current_status === 'ACCC';
  const is_rejected = current_status === 'RJCT';
  const allowed_next = current_valid ? VALID_TRANSITIONS[current_status] : [];

  const output_payload = {
    current_status: current_status || null,
    next_status: next_status || null,
    stage_description,
    is_terminal,
    is_settled,
    is_rejected,
    transition_valid,
    transition_reason,
    sla_breached,
    sla_hours_limit: GPI_SLA_HOURS,
    sla_note,
    allowed_next_statuses: allowed_next,
    hours_elapsed: hours_elapsed > 0 ? hours_elapsed : null,
    amount_usd: amount_usd > 0 ? amount_usd : null,
    issues,
    lifecycle_states: VALID_STATUSES,
    pii_note: 'Payment amount used only for context. No party PII processed. Use synthetic amounts and UETR values for testing.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'SWIFT GPI Universal Confirmation rules; ISO 20022 pacs.002 ExternalPaymentTransactionStatus1Code; SWIFT GPI Tracker service description',
  };

  const compliance_flags = [];
  if (sla_breached) compliance_flags.push('GPI_SLA_BREACH');
  if (transition_valid === false) compliance_flags.push('INVALID_GPI_TRANSITION');

  return { output_payload, compliance_flags };
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
