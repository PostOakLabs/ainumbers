import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-262-validate-ebam-acmt-flow';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// Electronic Bank Account Management (eBAM) acmt message flow validator.
// Validates acmt.007/.010/.011/.017/.019 state-machine sequences per Swift/CGI-MP eBAM guide 2023.
// State transitions: request (007/011/017) must be acknowledged (010); 019 = report (any time).
// Detects orphan requests, duplicate IDs, unexpected sequences, and missing acknowledgements.
// ZERO PII: message type codes, sequence numbers, and structural fields only.

const TABLE_VERSION = 'CGI-MP-EBAM-2023';
const TABLE_SOURCE  = 'CGI-MP eBAM Usage Guide 2023 v1.0; ISO 20022 acmt message catalogue (acmt.007.001.06 / acmt.010.001.04 / acmt.011.001.07 / acmt.017.001.05 / acmt.019.001.07); SWIFT eBAM SLA guidelines 2023';

// acmt message definitions
const ACMT_DEFS = {
  'acmt.007': { role: 'REQUEST',  label: 'AccountOpeningRequest',      expects_ack: true  },
  'acmt.010': { role: 'ACK',      label: 'AccountRequestAcknowledgement', expects_ack: false },
  'acmt.011': { role: 'REQUEST',  label: 'AccountModificationRequest', expects_ack: true  },
  'acmt.017': { role: 'REQUEST',  label: 'AccountClosureRequest',      expects_ack: true  },
  'acmt.019': { role: 'REPORT',   label: 'AccountReport',              expects_ack: false },
};

// Valid request types that require a subsequent acmt.010 acknowledgement
const REQUEST_TYPES = ['acmt.007', 'acmt.011', 'acmt.017'];
const ACK_TYPE      = 'acmt.010';
const REPORT_TYPE   = 'acmt.019';

export function compute(params) {
  const p = params || {};

  const acmt_messages = Array.isArray(p.acmt_messages) ? p.acmt_messages : [];
  const strict_order  = p.strict_order !== false;

  const validation_errors   = [];
  const validation_warnings = [];
  const message_sequence    = [];

  // Normalize and index messages
  const seen_ids       = {};
  let   request_count  = 0;
  let   ack_count      = 0;
  let   report_count   = 0;
  let   orphan_count   = 0;

  // Track requests awaiting acknowledgement (by account_id + request type)
  // simplified: track pending requests by message_id
  const pending_requests = {}; // message_id → {type, account_id, seq}
  const acked_ids        = {};

  for (let i = 0; i < acmt_messages.length; i++) {
    const msg    = acmt_messages[i] || {};
    const msg_type  = (msg.message_type || '').toLowerCase();
    const msg_id    = msg.message_id || ('msg_' + i);
    const account_id = msg.account_id || 'UNKNOWN';
    const ref_msg_id = msg.ref_message_id || null;
    const def       = ACMT_DEFS[msg_type];

    if (!def) {
      validation_errors.push({ seq: i + 1, msg_id, issue: 'UNKNOWN_MESSAGE_TYPE', detail: 'Unrecognised acmt message type: ' + msg_type });
      message_sequence.push({ seq: i + 1, msg_id, msg_type: msg_type || 'UNKNOWN', role: 'UNKNOWN', account_id, valid: false });
      continue;
    }

    // Duplicate ID check
    if (seen_ids[msg_id]) {
      validation_errors.push({ seq: i + 1, msg_id, issue: 'DUPLICATE_MESSAGE_ID', detail: 'Message ID appears more than once: ' + msg_id });
    }
    seen_ids[msg_id] = true;

    const entry = { seq: i + 1, msg_id, msg_type, role: def.role, label: def.label, account_id, valid: true };

    if (def.role === 'REQUEST') {
      request_count++;
      pending_requests[msg_id] = { type: msg_type, account_id, seq: i + 1 };
      entry.expects_ack = true;
    } else if (msg_type === ACK_TYPE) {
      ack_count++;
      entry.ref_message_id = ref_msg_id;

      if (ref_msg_id && pending_requests[ref_msg_id]) {
        // Matched: ack resolves the pending request
        acked_ids[ref_msg_id] = true;
        delete pending_requests[ref_msg_id];
        entry.resolves = ref_msg_id;
      } else if (strict_order && ref_msg_id && !pending_requests[ref_msg_id]) {
        validation_warnings.push({ seq: i + 1, msg_id, issue: 'ACK_NO_PENDING_REQUEST', detail: 'acmt.010 references message ID not found in pending requests: ' + ref_msg_id });
      }
    } else if (msg_type === REPORT_TYPE) {
      report_count++;
    }

    message_sequence.push(entry);
  }

  // Orphan requests = requests still pending (no ack received)
  const orphan_requests = [];
  for (const pending_id in pending_requests) {
    const req = pending_requests[pending_id];
    orphan_count++;
    orphan_requests.push({ msg_id: pending_id, msg_type: req.type, account_id: req.account_id, seq: req.seq });
    validation_errors.push({ seq: req.seq, msg_id: pending_id, issue: 'ORPHAN_REQUEST', detail: req.type + ' has no acmt.010 acknowledgement in the provided message set.' });
  }

  const total_messages  = acmt_messages.length;
  const error_count     = validation_errors.length;
  const warning_count   = validation_warnings.length;
  const is_valid        = error_count === 0;

  // Derive final acmt state summary
  let acmt_state = 'EMPTY';
  if (total_messages > 0) {
    if (!is_valid) {
      acmt_state = 'INVALID';
    } else if (orphan_count > 0) {
      acmt_state = 'PENDING_ACKNOWLEDGEMENT';
    } else {
      // Determine from last request type
      const last_msg = message_sequence[message_sequence.length - 1];
      if (last_msg && last_msg.role === 'REQUEST') {
        acmt_state = 'PENDING_ACKNOWLEDGEMENT';
      } else if (message_sequence.some(function(m) { return m.msg_type === 'acmt.017'; })) {
        acmt_state = 'CLOSURE_CONFIRMED';
      } else if (message_sequence.some(function(m) { return m.msg_type === 'acmt.011'; })) {
        acmt_state = 'MODIFICATION_CONFIRMED';
      } else if (message_sequence.some(function(m) { return m.msg_type === 'acmt.007'; })) {
        acmt_state = 'OPENING_CONFIRMED';
      } else {
        acmt_state = 'REPORTING_ONLY';
      }
    }
  }

  return {
    is_valid,
    acmt_state,
    total_messages,
    request_count,
    ack_count,
    report_count,
    orphan_count,
    error_count,
    warning_count,
    validation_errors,
    validation_warnings,
    orphan_requests,
    message_sequence,
    table_version:  TABLE_VERSION,
    table_source:   TABLE_SOURCE,
    regulatory_basis: 'CGI-MP eBAM Usage Guide 2023: acmt.007 AccountOpeningRequest / acmt.010 AccountRequestAcknowledgement / acmt.011 AccountModificationRequest / acmt.017 AccountClosureRequest / acmt.019 AccountReport state-machine. Each REQUEST must be followed by an ACK (acmt.010); REPORT (acmt.019) is permitted at any point. Gated chain routes on /acmt_state.',
    pii_note:       'ZERO PII: message type codes, sequence numbers, account identifiers (synthetic/structural), and state machine fields only. No account holder, signatory, or personal data enters this kernel.',
    not_legal_advice: 'Not legal or compliance advice. eBAM flow validation requires review by qualified treasury operations staff and the account servicer.',
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
