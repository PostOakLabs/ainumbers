import { executionHash } from './_hash.mjs';

const TOOL_ID = '824-zip317-transfer-fee';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_zip317_transfer_fee',
  mandate_type: 'compliance_control', gpu: false,
};

// Conventional transfer-fee recompute for a DECLARED transaction shape -- the
// caller pastes counts and byte sizes, never keys and never raw transactions.
// The kernel recomputes the fee the published conventional formula yields for
// that declared shape: a fixed marginal fee per logical action, floored by a
// grace window. It is a recompute of a published rule over declared numbers;
// it makes no statement about what any wallet or node will accept at a given
// time, and nothing here is marketing.
//
// METHOD (integer arithmetic only):
//   logical_actions =
//     max(ceil(tx_in_total_size / 150), ceil(tx_out_total_size / 34))  // transparent
//   + 2 * n_joinsplit                                                  // sprout
//   + max(n_spends_sapling, n_outputs_sapling)                         // sapling
//   + n_actions_orchard                                                // orchard
//   conventional_fee = 5000 * max(2, logical_actions)
//   The two-action floor is the grace window; applied.grace_applied records
//   when the floor bound (logical_actions below 2).
//
// DECLARED-SHAPE REFUSALS (closed, each with a reachable path + fixture):
//   - A string in a declared numeric field: a declared shape carries numbers;
//     a string where a number belongs is identifier-like or free text by
//     construction (txids, addresses, key material) and is never echoed.
//   - A draft-revision shape: the pool contributions defined only by later
//     drafts of the fee rule (additional action pools, memo bundles) are not
//     part of the rule this node implements; a shape declaring them, or
//     selecting a later revision, is refused -- never guessed at.
//   - A count or byte size that is negative, fractional, or beyond the exact
//     integer range is not a declared transaction shape.
//
// Domain exclusions (declared, not computed): no key material of any kind is
// read or required (no viewing key, no spending key); no network; the caller
// owns supplying the declared shape correctly; absent pools contribute 0.
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random. All outputs are exact integers in zatoshi.

const MARGINAL_FEE_ZATOSHI = 5000; // zatoshi per logical action
const GRACE_ACTIONS = 2;           // grace window: fee floor, in actions
const INPUT_UNIT_SIZE = 150;       // bytes per unit transparent input
const OUTPUT_UNIT_SIZE = 34;       // bytes per unit transparent output
const MAX_SAFE_COUNT = 9007199254740991; // exact-integer boundary

// Declared-shape fields: numeric counts/sizes of the active revision.
const SHAPE_FIELDS = [
  'tx_in_total_size', 'tx_out_total_size',
  'n_joinsplit', 'n_spends_sapling', 'n_outputs_sapling', 'n_actions_orchard',
];
// Draft-revision-only fields: declared by later drafts, never implemented here.
const DRAFT_FIELDS = ['n_actions_ironwood', 'n_memo_chunks'];

function refused(field, because) {
  return {
    field,
    because,
  };
}

// Read one declared field. Returns { kind: 'absent' | 'ok', n } or
// { kind: 'string' | 'domain', field } -- strings are located before any
// coercion so an identifier-like value is never parsed and never echoed.
function readField(v, field) {
  if (v === undefined || v === null) return { kind: 'absent', n: 0 };
  if (typeof v === 'string') return { kind: 'string', field };
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_SAFE_COUNT) {
    return { kind: 'domain', field };
  }
  return { kind: 'ok', n: v };
}

// Ceiling division for non-negative integers: exact, no floats beyond the
// integer boundary already enforced by readField.
function ceilDiv(a, b) {
  return Math.floor((a + b - 1) / b);
}

export function compute(pp) {
  pp = pp || {};

  // -- Pass 1: strings in ANY declared field, before any numeric read.
  for (const f of [...SHAPE_FIELDS, ...DRAFT_FIELDS, 'revision']) {
    if (typeof pp[f] === 'string') {
      const r = refused(f, 'string_in_declared_numeric_field');
      return buildRefusal(r);
    }
  }

  // -- Pass 2: draft-revision selection and draft-only contributions.
  const rev = readField(pp.revision, 'revision');
  if (rev.kind === 'domain') return buildRefusal(refused(rev.field, 'count_or_size_out_of_declared_domain'));
  if (rev.kind === 'ok' && rev.n > 0) {
    return buildRefusal(refused('revision', 'revision_above_active_not_implemented'));
  }
  for (const f of DRAFT_FIELDS) {
    const d = readField(pp[f], f);
    if (d.kind === 'domain') return buildRefusal(refused(d.field, 'count_or_size_out_of_declared_domain'));
    if (d.kind === 'ok' && d.n > 0) {
      const because = f === 'n_actions_ironwood'
        ? 'draft_revision_action_pool_not_implemented'
        : 'draft_revision_memo_bundles_not_implemented';
      return buildRefusal(refused(f, because));
    }
  }

  // -- Pass 3: domain check on the active-revision shape fields.
  const vals = {};
  for (const f of SHAPE_FIELDS) {
    const r = readField(pp[f], f);
    if (r.kind === 'domain') return buildRefusal(refused(r.field, 'count_or_size_out_of_declared_domain'));
    vals[f] = r.n;
  }

  // -- Contributions (integer arithmetic only).
  const transparent = Math.max(
    ceilDiv(vals.tx_in_total_size, INPUT_UNIT_SIZE),
    ceilDiv(vals.tx_out_total_size, OUTPUT_UNIT_SIZE),
  );
  const sprout = 2 * vals.n_joinsplit;
  const sapling = Math.max(vals.n_spends_sapling, vals.n_outputs_sapling);
  const orchard = vals.n_actions_orchard;
  const logicalActions = transparent + sprout + sapling + orchard;
  const floored = Math.max(GRACE_ACTIONS, logicalActions);
  const fee = MARGINAL_FEE_ZATOSHI * floored;

  return {
    output_payload: {
      verdict: 'completed',
      conventional_fee_zatoshi: fee,
      logical_actions: logicalActions,
      contributions: { transparent, sprout, sapling, orchard },
      applied: {
        marginal_fee_zatoshi: MARGINAL_FEE_ZATOSHI,
        grace_actions: GRACE_ACTIONS,
        grace_applied: logicalActions < GRACE_ACTIONS,
        revision: rev.kind === 'ok' ? rev.n : 0,
      },
      evidence: {
        record_type: 'zip317_conventional_fee',
        tool_id: TOOL_ID,
        tool_version: TOOL_VERSION,
        method: 'declared_transaction_shape_recompute',
        fee_source: 'published_conventional_formula',
        acceptance_not_stated: true,
        pii_carried: false,
        refused: false,
      },
      manual_review_required: false,
    },
    compliance_flags: [],
  };
}

// Refusal payload: structured non-verdict naming the branch; the refused value
// is never echoed. manual_review_required mirrors the INPUT_REFUSED flag.
function buildRefusal(r) {
  // The flag is earned by the refusal reason being named, not emitted as a constant.
  const compliance_flags = [];
  if (r.because) compliance_flags.push('INPUT_REFUSED');
  return {
    output_payload: {
      verdict: 'refused',
      refused_because: r.because,
      refused_field: r.field,
      conventional_fee_zatoshi: null,
      logical_actions: null,
      contributions: null,
      evidence: {
        record_type: 'zip317_conventional_fee',
        tool_id: TOOL_ID,
        tool_version: TOOL_VERSION,
        pii_carried: false,
        refused: true,
      },
      manual_review_required: true,
    },
    compliance_flags,
  };
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
