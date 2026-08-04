/**
 * art-529-ccp-default-waterfall-recompute.kernel.mjs
 * CCP-CORE-BUILD-SPEC.md §1.2 — recomputes the sequential loss-allocation order at a
 * defaulting-member event: defaulter's IM -> defaulter's default-fund contribution ->
 * CCP skin-in-the-game -> surviving members' default-fund pool (pro-rata) -> assessment
 * powers, per a caller-declared waterfall structure (region-portable, not hardcoded to one
 * CCP's rulebook) and a caller-declared loss amount.
 * Clause: PFMI Principle 4 (Credit Risk) -- the standing "cover 2" / waterfall-sequencing
 * requirement -- and each CCP's own published rulebook waterfall order.
 *
 * OCG Standard §25 ocg-private-input@1. The defaulter's IM, the defaulter's default-fund
 * contribution, and the surviving-members' default-fund pool are member-level figures --
 * enumerable and sensitive per SPEC.md §25.1 (a bare digest over a low-cardinality dollar
 * figure is reversible by enumeration). They are committed via sha256-salted@1 at
 * policy_parameters.member_figures_commitment and NEVER appear in policy_parameters,
 * output_payload, or the §4 hash preimage in the clear. The CCP's own skin-in-the-game and
 * any assessment-power cap are the CCP's own already-published figures (PQD §0), so they
 * stay public policy inputs.
 *
 * §27 naming collision resolved (CCP-CORE-BUILD-SPEC.md §1.2): art-509-recompute-payment-waterfall
 * is a SECURITISATION cashflow waterfall, unrelated domain. This node's slug carries "ccp",
 * "default", and "waterfall" together so the domain is unambiguous at a glance.
 *
 * Pure decision kernel -- no DOM, no window, no Date.now(), no Math.random() in compute().
 */
import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID = 'art-529-ccp-default-waterfall-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_ccp_default_waterfall',
  mandate_type: 'analytics_mandate',
  gpu: false,
  // §25 profile marker -- buildArtifact's first argument is the PRIVATE WITNESS (member-level
  // figures + salt), not the artifact's own policy_parameters (which carries only the
  // commitment). Gate scripts that replay buildArtifact(fixture.policy_parameters) must skip
  // nodes carrying this flag (see chaingraph/kernels/vm-parity-gate.mjs).
  private_input_profile: 'ocg-private-input@1',
};

// The five recognised waterfall stage types (PFMI Principle 4 sequencing). A caller declares
// its OWN order/subset from this set -- no CCP's rulebook is hardcoded.
const KNOWN_STAGES = new Set([
  'defaulter_im',
  'defaulter_default_fund',
  'ccp_skin_in_game',
  'surviving_member_default_fund_pro_rata',
  'assessment_powers',
]);
const PRIVATE_STAGES = new Set(['defaulter_im', 'defaulter_default_fund', 'surviving_member_default_fund_pro_rata']);

function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function toMinorUnits(v, where, rejected, allowNull = false) {
  if (v === undefined || v === null) {
    if (!allowNull) rejected.push({ where, reason: 'absent', supplied: null });
    return 0;
  }
  if (isSafeIntAmount(v) && v >= 0) return v;
  rejected.push({ where, reason: typeof v === 'number' ? 'not a non-negative safe integer number of minor units' : `expected a non-negative integer number of minor units, got ${typeof v}`, supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v) });
  return 0;
}
function display(minor) {
  const whole = Math.trunc(minor / 100);
  const frac = minor - whole * 100;
  return String(whole) + '.' + String(frac).padStart(2, '0');
}

// §25.1 commitment = sha256(salt || cgCanon(input_value)), hex-encoded, "sha256:"-prefixed.
async function commitPrivateInput(saltHex, inputValue) {
  if (typeof saltHex !== 'string' || saltHex.length < 64 || !/^[0-9a-f]+$/i.test(saltHex)) {
    throw new Error('salt must be a hex string of at least 256 bits (64 hex chars)');
  }
  const saltBytes = new Uint8Array(saltHex.length / 2);
  for (let i = 0; i < saltBytes.length; i++) saltBytes[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
  const inputBytes = new TextEncoder().encode(JSON.stringify(cgCanon(inputValue)));
  const combined = new Uint8Array(saltBytes.length + inputBytes.length);
  combined.set(saltBytes, 0);
  combined.set(inputBytes, saltBytes.length);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', combined);
  return 'sha256:' + Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Sequential recompute over the PRIVATE member figures + PUBLIC CCP-level figures. Called only
// with the plaintext witness held in the prover's memory -- never with committed pp.
function recomputeWaterfall(structure, lossMinorUnits, amountsByStage) {
  let remaining = lossMinorUnits;
  const steps = [];
  for (const stage of structure) {
    const capacity = amountsByStage[stage] ?? 0;
    const absorbed = Math.min(remaining, capacity);
    remaining -= absorbed;
    steps.push({
      stage,
      private_figure: PRIVATE_STAGES.has(stage),
      absorbed_minor_units: absorbed,
      absorbed_display: display(absorbed),
      exhausted_stage_capacity: absorbed === capacity && capacity > 0,
      loss_fully_absorbed_at_this_stage: remaining === 0,
    });
    if (remaining === 0) break;
  }
  return { steps, residual_minor_units: remaining };
}

// Deterministic, side-effect-free recompute over an ALREADY-COMMITTED policy_parameters --
// exists for gate harnesses that expect a `compute` export (empty-input-finite.test.mjs skips
// kernels lacking one). Per SPEC.md §18.3, a private-input node's output is NOT third-party-
// recomputable from policy_parameters alone -- this only echoes the public shape.
export function compute(pp) {
  const p = pp || {};
  return {
    recomputed: false,
    loss_amount_minor_units: isSafeIntAmount(p.loss_amount_minor_units) ? p.loss_amount_minor_units : 0,
    note: 'Private-input node: the waterfall recompute is not derivable from policy_parameters alone (SPEC.md §18.3). Call buildArtifact with the private member-level witness, or verify the existing artifact via validate_private_inputs.',
  };
}

/**
 * buildArtifact -- the wire input `raw` is the caller's PRIVATE witness plus public config:
 *   {
 *     waterfall_structure: [stage,...],           public -- caller-declared order/subset
 *     loss_amount_minor_units,                     public -- caller-declared loss
 *     ccp_skin_in_game_minor_units,                 public -- CCP's own published figure
 *     assessment_powers_cap_minor_units?,           public -- optional, omitted = uncapped
 *     currency?,
 *     defaulter_im_minor_units,                     PRIVATE
 *     defaulter_default_fund_minor_units,           PRIVATE
 *     surviving_member_default_fund_pool_minor_units, PRIVATE
 *     salt,                                         PRIVATE -- >=256-bit hex, never emitted
 *   }
 * The returned artifact's own policy_parameters carries ONLY the commitment + public fields --
 * the three member-level figures and the salt never enter policy_parameters, output_payload,
 * or the §4 preimage.
 */
export async function buildArtifact(raw, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const r = raw || {};
  const rejected_inputs = [];

  const currency = typeof r.currency === 'string' && r.currency.trim() ? r.currency.trim().toUpperCase() : 'USD';

  const structureIn = Array.isArray(r.waterfall_structure) ? r.waterfall_structure : [];
  const waterfall_structure = [];
  for (const s of structureIn) {
    if (typeof s === 'string' && KNOWN_STAGES.has(s) && !waterfall_structure.includes(s)) waterfall_structure.push(s);
    else rejected_inputs.push({ where: 'waterfall_structure', reason: 'not a recognised, non-duplicate stage id', supplied: s });
  }
  if (waterfall_structure.length === 0) rejected_inputs.push({ where: 'waterfall_structure', reason: 'absent or empty -- a caller-declared stage order is required', supplied: null });

  const loss_amount_minor_units = toMinorUnits(r.loss_amount_minor_units, 'loss_amount_minor_units', rejected_inputs);
  const ccp_skin_in_game_minor_units = toMinorUnits(r.ccp_skin_in_game_minor_units, 'ccp_skin_in_game_minor_units', rejected_inputs);
  const assessment_powers_cap_declared = r.assessment_powers_cap_minor_units !== undefined && r.assessment_powers_cap_minor_units !== null;
  const assessment_powers_cap_minor_units = assessment_powers_cap_declared
    ? toMinorUnits(r.assessment_powers_cap_minor_units, 'assessment_powers_cap_minor_units', rejected_inputs)
    : null;

  const defaulter_im_minor_units = toMinorUnits(r.defaulter_im_minor_units, 'defaulter_im_minor_units', rejected_inputs);
  const defaulter_default_fund_minor_units = toMinorUnits(r.defaulter_default_fund_minor_units, 'defaulter_default_fund_minor_units', rejected_inputs);
  const surviving_member_default_fund_pool_minor_units = toMinorUnits(r.surviving_member_default_fund_pool_minor_units, 'surviving_member_default_fund_pool_minor_units', rejected_inputs);

  const member_figures = {
    defaulter_im_minor_units,
    defaulter_default_fund_minor_units,
    surviving_member_default_fund_pool_minor_units,
  };
  const member_figures_commitment = await commitPrivateInput(r.salt, member_figures);

  const amountsByStage = {
    defaulter_im: defaulter_im_minor_units,
    defaulter_default_fund: defaulter_default_fund_minor_units,
    ccp_skin_in_game: ccp_skin_in_game_minor_units,
    surviving_member_default_fund_pro_rata: surviving_member_default_fund_pool_minor_units,
    // Uncapped assessment powers absorb whatever remains -- Number.MAX_SAFE_INTEGER is a
    // finite sentinel, never Infinity (I-JSON hash-preimage safety, CONTRACT money convention).
    assessment_powers: assessment_powers_cap_declared ? assessment_powers_cap_minor_units : Number.MAX_SAFE_INTEGER,
  };

  const { steps, residual_minor_units } = recomputeWaterfall(waterfall_structure, loss_amount_minor_units, amountsByStage);
  const loss_fully_absorbed = residual_minor_units === 0;
  const breach = !loss_fully_absorbed;

  const compliance_flags = [];
  if (loss_fully_absorbed) compliance_flags.push('WATERFALL_LOSS_FULLY_ABSORBED');
  else compliance_flags.push('WATERFALL_BREACH_RESIDUAL_UNALLOCATED');
  if (steps.some((s) => s.stage === 'assessment_powers' && s.absorbed_minor_units > 0)) compliance_flags.push('WATERFALL_REACHED_ASSESSMENT_POWERS');
  if (rejected_inputs.length > 0) compliance_flags.push('WATERFALL_INPUTS_REJECTED');

  const rationale = [
    `Waterfall structure: ${waterfall_structure.join(' -> ') || 'NONE DECLARED'}.`,
    `Loss of ${display(loss_amount_minor_units)} ${currency} recomputed sequentially across ${steps.length} stage(s) reached; the three member-level absorption capacities (defaulter IM, defaulter default-fund contribution, surviving-member default-fund pool) are private witnesses committed under OCG Standard §25 ocg-private-input@1, never disclosed in the clear.`,
    loss_fully_absorbed
      ? `Loss fully absorbed; residual unallocated is 0.00 ${currency}.`
      : `Residual of ${display(residual_minor_units)} ${currency} remains unallocated after every declared stage -- a breach of the declared waterfall structure at this loss amount.`,
    'This is a sequential recompute over a caller-declared waterfall structure and a caller-declared loss amount, per PFMI Principle 4 and each CCP\'s own published rulebook order. It is not a determination that any CCP\'s actual default-fund sizing is adequate, and it performs no stress-scenario modelling of its own.',
  ];

  const output_payload = {
    currency,
    waterfall_structure,
    loss_amount_minor_units, loss_amount_display: display(loss_amount_minor_units),
    ccp_skin_in_game_minor_units, ccp_skin_in_game_display: display(ccp_skin_in_game_minor_units),
    assessment_powers_cap_declared, assessment_powers_cap_minor_units,
    steps,
    residual_minor_units, residual_display: display(residual_minor_units),
    loss_fully_absorbed, breach,
    rejected_inputs, rationale,
    provenance: 'PFMI Principle 4 (Credit Risk) -- the standing Cover-2 / waterfall-sequencing requirement -- and the caller-declared waterfall structure, which is not hardcoded to any one CCP rulebook.',
    note: 'Deterministic, single-run recompute of a sequential default-waterfall loss allocation. The defaulter IM, defaulter default-fund contribution, and surviving-member default-fund pool are member-level figures committed via sha256-salted@1 (OCG Standard §25) and never appear in the clear anywhere in this artifact. It forecasts nothing, sizes no fund, and makes no determination that a CCP\'s published resources are adequate.',
  };

  const policy_parameters = {
    currency,
    waterfall_structure,
    loss_amount_minor_units,
    ccp_skin_in_game_minor_units,
    assessment_powers_cap_declared,
    assessment_powers_cap_minor_units,
    member_figures_commitment,
  };

  const hash = await executionHash(policy_parameters, output_payload);

  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters,
    output_payload,
    private_inputs: [
      { pointer: '/member_figures_commitment', commitment: member_figures_commitment, commitment_scheme: 'sha256-salted@1' },
    ],
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    deferred_reason: 'New shard; awaiting the async GPU proving queue (S18 steady-state).',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
