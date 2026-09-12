import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-99-mica-transitional-deadline-router';
const TOOL_VERSION = '1.1.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'route_mica_transitional_deadline',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// PRIMARY SUPPORT for the single retained date constant (ART99-MICA-DEADLINE-FIX-1).
// Source: Article 143(3) of Regulation (EU) 2023/1114 (MiCA), CELEX 32023R1114, retrieved
// from EUR-Lex 2026-09-11. Operative sentence, verbatim:
//   "Crypto-asset service providers that provided their services in accordance with applicable
//    law before 30 December 2024, may continue to do so until 1 July 2026 or until they are
//    granted or refused an authorisation pursuant to Article 63, whichever is sooner."
// The Article sets ONE EU-wide transitional end date. Its second subparagraph lets Member
// States decide not to apply the transitional regime or to reduce its duration; ESMA's
// published grandfathering list (Art 143 periods decided by Member States) records national
// expectations and states expressly that some "may not have been incorporated into national
// law yet". Neither primary supports a cliff/extended distinction, so the former
// CLIFF_DEADLINE ('2026-06-30'), EXTENDED_DEADLINE ('2026-12-30') and DEFAULT_DEADLINE
// ('2026-12-30') constants and the 16-state / 4-state Sets are DELETED (constants sweep:
// 4 MISMATCH rows on 2026-09-11 @ b42ecdaa and 2026-09-12 @ 7ba5b066). The router collapses
// to the single primary-supported deadline below.
const TRANSITIONAL_END = '2026-07-01'; // Art 143(3): grandfathering continues "until 1 July 2026"

// Estate NO-CLOCK convention: the evaluation date is a REQUIRED caller input (ISO 8601
// calendar date, UTC). The kernel never reads the wall clock (determinism hard ban on
// no-arg Date()); a caller that wants "execution date" semantics passes it explicitly.
// Shape regex AND a parse round-trip: '2026-13-01' matches the shape but is not a real
// calendar date, and an Invalid Date would leak NaN into window_months.
function isoDateOrNull(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return Number.isFinite(Date.parse(v)) ? v : null;
}

export function compute(pp) {
  const {
    existing_registration = 'no',
    as_of,
  } = pp.inputs ?? pp;
  const asOf = isoDateOrNull(as_of);

  let window_months = null;
  let decision;
  const compliance_flags = [];

  if (asOf === null) {
    // No evaluation date supplied: no window and no file/wind-down verdict can be computed.
    decision = 'unresolved';
    compliance_flags.push('AS_OF_REQUIRED');
  } else {
    const diffMs = new Date(TRANSITIONAL_END) - new Date(asOf);
    window_months = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));

    if (existing_registration === 'no' && window_months < 1) {
      decision = 'wind-down';
    } else {
      decision = 'file';
    }

    if (window_months < 1 && window_months > -12) compliance_flags.push('DEADLINE_IMMINENT');
    if (decision === 'wind-down') compliance_flags.push('WIND_DOWN_PATH');
  }

  const output_payload = {
    as_of: asOf,
    transitional_end_date: TRANSITIONAL_END,
    window_months,
    file_by_preconditions: [
      'Submit authorization application to NCA before transitional end',
      'Ensure Art 62 application pack complete',
    ],
    decision,
    state_specific_notes: 'Art 143(3) MiCA Reg. (EU) 2023/1114: providers lawfully serving before 30 December 2024 may continue until 1 July 2026 or until their Article 63 authorisation is granted or refused, whichever is sooner. Member States may disapply or shorten the regime (Art 143(3) second subparagraph); the ESMA grandfathering list records national expectations, some of which may not yet be in national law.',
    reference_version: '2026-09',
    note: 'DECISION-SUPPORT DRAFT. Verify current ESMA grandfathering list and national implementation against official sources.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode: 'server',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    audit_signature: {
      payloadType: 'application/vnd.openchain.graph+json;version=0.4',
      payload: '',
      signatures: [],
    },
  };
}
