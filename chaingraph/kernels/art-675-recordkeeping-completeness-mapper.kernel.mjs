import { executionHash } from './_hash.mjs';

// art-675-recordkeeping-completeness-mapper (RECORDKEEPING-MAPPER-BUILD-1, RECORDKEEPING-MAPPER-BUILD-SPEC.md)
//
// Channel inventory roll-up for recordkeeping completeness. The caller declares the set of
// books-and-records channels (email, chat, messaging, voice, ...) with a captured flag and a
// retrieval-test result per channel; this kernel performs only the arithmetic of those declared
// inputs: total channels, captured count, completeness percentage, the uncaptured listing, the
// retrieval-pass count, and an overall verdict (GAPS_FOUND / COMPLETE).
//
// NOT-PROVEN DISCIPLINE (spec constraint): this kernel computes arithmetic over caller-declared
// synthetic inputs. It does NOT check live SSR tapes, borrow lists, cutoff feeds, registers, or
// any books-and-records system of record. "captured" and "pass" are the caller's declarations, never
// observations this kernel made. A COMPLETE verdict means the caller declared full capture and
// full retrieval success -- it is not an attestation that any regulator-facing recordkeeping
// obligation is satisfied.
//
// DECLARED RULES (the only judgements this kernel makes, both mechanical):
//   - completeness_pct = round_half_up(100 * captured / total) -- a whole number.
//   - overall = "COMPLETE" iff every declared channel is captured AND every declared channel
//     reports retrieval_test "pass"; otherwise "GAPS_FOUND". An untested channel (not_run) is a
//     gap, never an assumed pass.
//
// NEVER GUESS, NEVER DEFAULT. An absent or malformed channel list, name, captured flag, or
// retrieval_test resolves to the fail-closed payload -- every summary field nulled, each
// offending input named in domain_errors -- never a silently repaired inventory.
//
// Zero network, zero randomness, zero wall-clock reads inside compute(). No
// TextEncoder/atob/btoa/URL anywhere in this file (QuickJS-ng guest safe).

const TOOL_ID = 'art-675-recordkeeping-completeness-mapper';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_recordkeeping_completeness_mapper',
  mandate_type: 'analytics_mandate', gpu: false,
};

const RETRIEVAL_RESULTS = ['pass', 'fail', 'not_run'];
const MAX_CHANNELS = 4096;

const ERROR_PHRASES = {
  INVALID_CHANNELS: 'channels must be a non-empty array of channel objects, at most 4096 entries',
  INVALID_CHANNEL_NAME: 'each channel.name must be a non-empty string and channel names must be unique',
  INVALID_CAPTURED: 'each channel.captured must be a boolean',
  INVALID_RETRIEVAL_TEST: 'each channel.retrieval_test must be one of pass, fail, not_run',
};

/** Half-up rounding to a whole number, sign-symmetric, deterministic. */
function roundHalfUp(x) {
  return x < 0 ? -Math.floor(-x + 0.5) : Math.floor(x + 0.5);
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];

  const channels = pp.channels;
  const shapeOk = Array.isArray(channels) && channels.length > 0 && channels.length <= MAX_CHANNELS;
  if (!shapeOk) {
    domain_errors.push('INVALID_CHANNELS');
  } else {
    const seen = new Set();
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i] || {};
      const name = ch.name;
      if (typeof name !== 'string' || name.length === 0 || seen.has(name)) { domain_errors.push('INVALID_CHANNEL_NAME'); break; }
      seen.add(name);
      if (typeof ch.captured !== 'boolean') { domain_errors.push('INVALID_CAPTURED'); break; }
      if (!RETRIEVAL_RESULTS.includes(ch.retrieval_test)) { domain_errors.push('INVALID_RETRIEVAL_TEST'); break; }
    }
  }

  const compliance_flags = [];

  if (domain_errors.length > 0) {
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`RKCMP_${code}`);
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    return {
      output_payload: {
        total: null,
        captured: null,
        completeness_pct: null,
        uncaptured: [],
        retrieval_passes: null,
        overall: null,
        trace: `fail-closed: ${reasons}; no completeness roll-up computed -- correct the named inputs and resubmit. Arithmetic of caller-declared channel declarations only: no live records, tapes, feeds, or registers are checked.`,
        domain_errors,
      },
      compliance_flags,
    };
  }

  const total = channels.length;
  let captured = 0;
  let retrieval_passes = 0;
  const uncaptured = [];
  for (const ch of channels) {
    if (ch.captured) captured += 1;
    else uncaptured.push(ch.name);
    if (ch.retrieval_test === 'pass') retrieval_passes += 1;
  }
  const completeness_pct = roundHalfUp((100 * captured) / total);
  const overall = (captured === total && retrieval_passes === total) ? 'COMPLETE' : 'GAPS_FOUND';

  const output_payload = {
    total,
    captured,
    completeness_pct,
    uncaptured,
    retrieval_passes,
    overall,
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
