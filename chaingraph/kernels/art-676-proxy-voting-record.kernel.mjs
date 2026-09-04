/**
 * art-676-proxy-voting-record.kernel.mjs
 *
 * PROXY-VOTING-BUILD-1 (PROXY-VOTING-BUILD-SPEC.md) -- deterministic proxy-voting
 * record arithmetic over caller-declared synthetic inputs. A RECORD-KEEPING
 * CALCULATOR, never a participant in any meeting: there is no registrar, no
 * network, no SSR tape, no borrow list, no cutoff feed, and no clock inside
 * compute(). The caller declares the meeting dates, the record-date positions,
 * and the voting instruction; this kernel only performs the date and quantity
 * arithmetic and returns it with a trace.
 *
 * FUNCTIONS (per the spec):
 *   - Entitlement: entitled_shares = sum of shares across the declared
 *     record-date positions. Whole shares, never fractional.
 *   - Instruction-vs-deadline: days_before_deadline = whole days from the
 *     declared instruction.received date to the declared vote_deadline, computed
 *     on UTC calendar dates. instruction_within_deadline is true when received
 *     is not after the deadline.
 *   - Execution-confirm record: overall = "VOTE_RECORDED" when the instruction
 *     is within the deadline; overall = "INSTRUCTION_LATE" when it is not (the
 *     instruction is still reported, never silently dropped: the deadline miss
 *     is the record).
 *   - Vote-record file fields: the output_payload members themselves
 *     (entitled_shares, instruction_within_deadline, days_before_deadline,
 *     overall, trace) are the record fields.
 *
 * NEVER GUESS, NEVER DEFAULT. An absent or malformed meeting date, position
 * list, or instruction resolves to the fail-closed payload -- every record
 * field null, each offending field named in domain_errors and in the trace --
 * never a silently repaired record and never a defaulted date or quantity.
 *
 * SRD II NOTE (documentary only): the record shape resembles the meeting
 * engagement disclosures named in the shareholder rights context; this kernel
 * implements settled calendar arithmetic over declared inputs and cites no
 * external standard. It does not check a live share register, does not confirm
 * entitlement against a registrar, and does not vote.
 *
 * SCOPE FENCE (advice-perimeter doctrine, PLATFORM-DOORS 4.4). This kernel
 * computes record arithmetic over caller-declared synthetic inputs. It is NOT
 * voting advice, NOT a recommendation on how to vote, NOT a proxy solicitation,
 * and NOT a transmission of any instruction to any intermediary: it never
 * sends, stages, or submits a vote anywhere. How to vote is a judgement that
 * belongs to the shareholder alone.
 *
 * Output payload shape: exactly { entitled_shares, instruction_within_deadline,
 * days_before_deadline, trace, overall } on a computable path (the canonical
 * pinned shape; extra keys would move the execution_hash), and the same four
 * value fields nulled plus a domain_errors[] array on the fail-closed path
 * (the flag-mirror member: a caveat carrier, truthy exactly when inputs were
 * refused).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute(). Runs
 * unmodified in the QuickJS-ng guest (no TextEncoder/atob/btoa/URL anywhere in
 * this file).
 *
 * Spec: PROXY-VOTING-BUILD-SPEC.md (canonical preimage, execution_hash pinned
 * at staging: bb96d0b887d1b1f0508eed97d2decf9cbf29f50eeb8705b911c4306ff32e8ccc).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-676-proxy-voting-record';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_proxy_voting_record',
  mandate_type: 'compliance_control',
  gpu: false,
};

const DIRECTIONS = ['for', 'against', 'abstain', 'withhold'];
const MS_PER_DAY = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_RECORD_DATE: 'meeting.record_date must be a valid calendar date (YYYY-MM-DD)',
  INVALID_VOTE_DEADLINE: 'meeting.vote_deadline must be a valid calendar date (YYYY-MM-DD)',
  INVALID_POSITIONS: 'positions must be a non-empty array of declared record-date positions',
  INVALID_POSITION: 'each position needs a non-empty account string and a positive whole number of shares',
  INVALID_RECEIVED_DATE: 'instruction.received must be a valid calendar date (YYYY-MM-DD)',
  INVALID_DIRECTION: 'instruction.direction must be one of for, against, abstain, withhold',
};

function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }

/** Strict calendar-date check: YYYY-MM-DD shape AND a real UTC calendar day. */
function parseDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];

  const meeting = (pp.meeting && typeof pp.meeting === 'object' && !Array.isArray(pp.meeting)) ? pp.meeting : {};
  const recordT = parseDate(meeting.record_date);
  if (recordT === null) domain_errors.push('INVALID_RECORD_DATE');
  const deadlineT = parseDate(meeting.vote_deadline);
  if (deadlineT === null) domain_errors.push('INVALID_VOTE_DEADLINE');

  const positions = pp.positions;
  let shares = 0;
  if (!Array.isArray(positions) || positions.length === 0) {
    domain_errors.push('INVALID_POSITIONS');
  } else {
    let positionsOk = true;
    for (const p of positions) {
      const pos = (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
      const accountOk = typeof pos.account === 'string' && pos.account.trim().length > 0;
      const sharesOk = isFiniteNumber(pos.shares) && Number.isSafeInteger(pos.shares) && pos.shares > 0;
      if (!accountOk || !sharesOk) { positionsOk = false; break; }
      shares += pos.shares;
    }
    if (!positionsOk) domain_errors.push('INVALID_POSITION');
  }

  const instruction = (pp.instruction && typeof pp.instruction === 'object' && !Array.isArray(pp.instruction)) ? pp.instruction : {};
  const receivedT = parseDate(instruction.received);
  if (receivedT === null) domain_errors.push('INVALID_RECEIVED_DATE');
  const direction = typeof instruction.direction === 'string' ? instruction.direction.trim().toLowerCase() : null;
  if (!DIRECTIONS.includes(direction)) domain_errors.push('INVALID_DIRECTION');

  if (domain_errors.length > 0) {
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    const compliance_flags = ['DOMAIN_ERROR'];
    for (const code of domain_errors) compliance_flags.push(`PROXYVOTE_${code}`);
    return {
      output_payload: {
        entitled_shares: null,
        instruction_within_deadline: null,
        days_before_deadline: null,
        trace: `fail-closed: ${reasons}; no vote record computed -- correct the named inputs and resubmit. Proxy voting record arithmetic over caller-declared synthetic inputs only: not voting advice, not a solicitation, and no instruction is transmitted anywhere.`,
        overall: null,
        domain_errors,
      },
      compliance_flags,
    };
  }

  const days_before_deadline = (deadlineT - receivedT) / MS_PER_DAY;
  const withinDeadline = days_before_deadline >= 0;
  const entitled_shares = shares;

  const positionNote = positions.length === 1
    ? 'entitlement = record-date position'
    : `entitlement = sum of ${positions.length} record-date positions`;
  const trace = `received ${instruction.received} is ${days_before_deadline} days before ${meeting.vote_deadline} deadline; ${positionNote}`;

  const output_payload = {
    entitled_shares,
    instruction_within_deadline: withinDeadline,
    days_before_deadline,
    trace,
    overall: withinDeadline ? 'VOTE_RECORDED' : 'INSTRUCTION_LATE',
  };

  return { output_payload, compliance_flags: [] };
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
