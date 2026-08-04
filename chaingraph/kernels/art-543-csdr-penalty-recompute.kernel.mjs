/**
 * art-543-csdr-penalty-recompute.kernel.mjs
 * TRADFI-OPS-BUILD-SPEC.md §1 (Family a) -- per-ISIN/day CSDR cash-penalty recompute.
 *
 * Fixes art-78-csdr-penalty-calculator's reachability defect: art-78 was priced off
 * `notional` and no shipped pack could feed it a differing `reference_price` (its own
 * note states the defect verbatim; DECISION-LEDGER-DISCARDED.md line 119). This node's
 * `policy_parameters` schema instead REQUIRES a caller-supplied `reference_price` per
 * fail -- never derives it from notional. art-78 keeps its wave-17 identity and chain
 * wiring untouched; this is a NEW node, not an edit.
 *
 * Formula (per fail): penalty = daily_rate_bps(asset_class, penalty_type) x
 * reference_price x quantity x fail_days, credited proportionally by
 * partial_settled_pct. Forward exposure = sum of penalty over the caller's declared
 * open-fails set. Every rate and every ISIN->asset-class mapping is caller input or a
 * versioned RTS rate-schedule constant (`rate_table_version`) -- never a fetched or
 * invented per-venue table, the art-506 discipline (TRADFI-OPS-BUILD-SPEC.md §0).
 *
 * RTS rate schedule (CSDR-RTS-2025-10, ESMA Final Report 13 Oct 2025, ESMA74-2119945926-
 * 3430): a closed, versioned, enumerated table -- shipped as a constant, unlike the
 * ISIN->asset-class mapping and reference price, which stay caller-supplied. Only the
 * 2025-10-13 ESMA Final Report date is corroborated; no further provision date is
 * written here (TRADFI-OPS-BUILD-SPEC.md §1 date-discipline warning).
 *
 * SPEC.md §25 PRIVATE-INPUT PROFILE (optional per artifact, kernel MUST implement the
 * path): ISIN and counterparty_id are enumerable/re-identifiable inputs. Each fail MAY
 * carry `isin_commitment` / `counterparty_id_commitment` (sha256-salted@1, SPEC.md
 * §25.0-§25.1) INSTEAD of a plaintext `isin` / `counterparty_id`. A bare digest is not
 * admissible under §25.1 for a low-entropy/enumerable input -- only a
 * "sha256-salted@1" commitment is accepted as a private form. Declaration is per-fail
 * and optional; an artifact with zero private fails stays fully conformant. Accepted
 * commitments are collected into `private_input_candidates` and attached to
 * `private_inputs[]` in buildArtifact() AFTER executionHash runs (hash-excluded by
 * construction, §25.2/§25.6).
 *
 * FINITE GATE: an empty `open_fails[]` is a genuine vacuous pass (nothing to price),
 * execution_state "ran", zero total exposure -- distinct from the rate_table_version
 * kill condition below, which is a caller-input defect, not an empty population. No
 * branch emits NaN, Infinity, or an undefined status.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute() (all
 * timestamps/dates are caller-declared policy_parameters).
 *
 * Spec: TRADFI-OPS-BUILD-SPEC.md §0 (reuse discipline) + §1 (Family a).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-543-csdr-penalty-recompute';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'recompute_csdr_penalty', mandate_type: 'compliance_mandate', gpu: false };

const RATE_TABLE_VERSION = 'CSDR-RTS-2025-10';
// bps/day per asset_class x penalty_type, ESMA Final Report 13 Oct 2025 (ESMA74-2119945926-3430).
const RATE_TABLE = {
  equity: { sefp: 1.0, lmfp: 0.5, csdp: 0.5 },
  ssa_bond: { sefp: 0.5, lmfp: 0.25, csdp: 0.25 },
  non_ssa_bond: { sefp: 0.5, lmfp: 0.25, csdp: 0.25 },
  other: { sefp: 0.5, lmfp: 0.5, csdp: 0.5 },
};

const SHA256_SALTED_SCHEME = 'sha256-salted@1';
const SHA256_COMMITMENT_RE = /^sha256:[0-9a-f]{64}$/;

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function isCommitment(v) { return typeof v === 'string' && SHA256_COMMITMENT_RE.test(v); }

const NOTE = 'DECISION-SUPPORT DRAFT -- not a regulatory penalty notice. Deterministic per-ISIN/day cash-penalty recompute against a versioned RTS rate schedule; verify against current CSDR Delegated Reg. (RTS) (EU) 2018/1229 as amended and ESMA RTS (Final Report 13 Oct 2025). Partial-settlement credit applies proportionally. reference_price is caller-supplied per fail -- never derived from notional (fixes art-78-csdr-penalty-calculator\'s reachability defect; art-78 itself is unchanged).';

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { execution_state: 'did_not_run', reason },
      recompute_id: (extra && extra.recompute_id) || '',
      rate_table_version: (extra && extra.rate_table_version) || null,
      fail_count: 0,
      determinations: [],
      total_penalty_exposure: 0,
      rejected_inputs: (extra && extra.rejected_inputs) || [],
      note: NOTE,
    },
    compliance_flags: flags,
    private_input_candidates: [],
  };
}

export function compute(pp) {
  pp = pp || {};
  const recompute_id = isNonEmptyString(pp.recompute_id) ? pp.recompute_id.trim() : '';
  const rejected_inputs = [];

  const declaredVersion = isNonEmptyString(pp.rate_table_version) ? pp.rate_table_version.trim() : null;
  if (declaredVersion !== RATE_TABLE_VERSION) {
    rejected_inputs.push({ where: 'rate_table_version', reason: `must be exactly "${RATE_TABLE_VERSION}" -- the RTS rate schedule is a closed, versioned, enumerated table (TRADFI-OPS-BUILD-SPEC.md §0) and cannot be silently substituted`, supplied: declaredVersion });
    return emptyResult('rate_table_version_missing_or_mismatched', { recompute_id, rate_table_version: declaredVersion, rejected_inputs }, ['CSDR_PENALTY_KILL_CONDITION_RATE_TABLE_VERSION_INVALID']);
  }

  const failsIn = Array.isArray(pp.open_fails) ? pp.open_fails : [];
  const private_input_candidates = [];
  const determinations = [];

  failsIn.forEach((f, i) => {
    f = f && typeof f === 'object' ? f : {};

    // ISIN: plaintext OR §25 salted commitment, never both, never neither.
    const isinPlain = isNonEmptyString(f.isin) ? f.isin.trim() : null;
    const isinCommit = isNonEmptyString(f.isin_commitment) ? f.isin_commitment.trim() : null;
    let isin_ref = null, isin_private = false;
    if (isinCommit) {
      if (!isCommitment(isinCommit)) {
        rejected_inputs.push({ where: `open_fails[${i}].isin_commitment`, reason: `not a well-formed ${SHA256_SALTED_SCHEME} commitment`, supplied: isinCommit });
        return;
      }
      isin_ref = isinCommit; isin_private = true;
      private_input_candidates.push({ pointer: `/open_fails/${i}/isin_commitment`, commitment: isinCommit, commitment_scheme: SHA256_SALTED_SCHEME });
    } else if (isinPlain) {
      isin_ref = isinPlain;
    } else {
      rejected_inputs.push({ where: `open_fails[${i}].isin`, reason: 'neither isin nor isin_commitment supplied', supplied: null });
      return;
    }

    // counterparty_id: same plaintext-or-commitment discipline, optional field.
    const cpPlain = isNonEmptyString(f.counterparty_id) ? f.counterparty_id.trim() : null;
    const cpCommit = isNonEmptyString(f.counterparty_id_commitment) ? f.counterparty_id_commitment.trim() : null;
    let counterparty_ref = null;
    if (cpCommit) {
      if (!isCommitment(cpCommit)) {
        rejected_inputs.push({ where: `open_fails[${i}].counterparty_id_commitment`, reason: `not a well-formed ${SHA256_SALTED_SCHEME} commitment`, supplied: cpCommit });
        return;
      }
      counterparty_ref = cpCommit;
      private_input_candidates.push({ pointer: `/open_fails/${i}/counterparty_id_commitment`, commitment: cpCommit, commitment_scheme: SHA256_SALTED_SCHEME });
    } else if (cpPlain) {
      counterparty_ref = cpPlain;
    }

    const asset_class = isNonEmptyString(f.asset_class) ? f.asset_class.trim() : null;
    const penalty_type = isNonEmptyString(f.penalty_type) ? f.penalty_type.trim() : null;
    const rateRow = asset_class ? RATE_TABLE[asset_class] : null;
    const daily_rate_bps = rateRow && penalty_type ? rateRow[penalty_type] : undefined;
    if (daily_rate_bps === undefined) {
      rejected_inputs.push({ where: `open_fails[${i}]`, reason: `no RTS rate for asset_class="${asset_class}" / penalty_type="${penalty_type}"`, supplied: { asset_class, penalty_type } });
      return;
    }

    const reference_price = f.reference_price;
    const quantity = f.quantity;
    const fail_days = f.fail_days;
    if (!isFiniteNum(reference_price) || reference_price < 0) {
      rejected_inputs.push({ where: `open_fails[${i}].reference_price`, reason: 'must be a caller-supplied non-negative finite number -- never derived from notional', supplied: reference_price });
      return;
    }
    if (!isFiniteNum(quantity) || quantity < 0) {
      rejected_inputs.push({ where: `open_fails[${i}].quantity`, reason: 'must be a non-negative finite number', supplied: quantity });
      return;
    }
    if (!Number.isInteger(fail_days) || fail_days < 0) {
      rejected_inputs.push({ where: `open_fails[${i}].fail_days`, reason: 'must be a non-negative integer', supplied: fail_days });
      return;
    }

    const partialRaw = f.partial_settled_pct;
    const partial_settled_pct = isFiniteNum(partialRaw) && partialRaw >= 0 && partialRaw <= 1 ? partialRaw : 0;

    const gross_penalty = daily_rate_bps / 10000 * reference_price * quantity * fail_days;
    const partial_credit = gross_penalty * partial_settled_pct;
    const penalty_amount = gross_penalty - partial_credit;

    determinations.push({
      fail_id: isNonEmptyString(f.fail_id) ? f.fail_id.trim() : `fail-${i}`,
      isin: isin_ref, isin_private,
      counterparty_id: counterparty_ref,
      asset_class, penalty_type,
      daily_rate_bps, reference_price, quantity, fail_days,
      partial_settled_pct, gross_penalty, partial_credit, penalty_amount,
    });
  });

  const total_penalty_exposure = determinations.reduce((s, d) => s + d.penalty_amount, 0);

  const compliance_flags = ['CSDR_PENALTY_RECOMPUTED'];
  if (determinations.some((d) => d.isin_private)) compliance_flags.push('CSDR_PENALTY_PRIVATE_INPUT_USED');
  if (rejected_inputs.length > 0) compliance_flags.push('CSDR_PENALTY_INPUTS_REJECTED');
  if (determinations.length > 0) compliance_flags.push('CSDR_PENALTY_FAILS_PRICED');

  const output_payload = {
    decision: { execution_state: 'ran', reason: null },
    recompute_id,
    rate_table_version: RATE_TABLE_VERSION,
    fail_count: determinations.length,
    determinations,
    total_penalty_exposure,
    rejected_inputs,
    note: NOTE,
  };

  return { output_payload, compliance_flags, private_input_candidates };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags, private_input_candidates } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  // §25.0 -- attached AFTER executionHash, hash-excluded by construction (SPEC.md §25.0/§25.6).
  if (private_input_candidates.length > 0) artifact.private_inputs = private_input_candidates;
  return artifact;
}
