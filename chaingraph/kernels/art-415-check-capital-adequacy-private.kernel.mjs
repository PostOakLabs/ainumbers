/**
 * art-415-check-capital-adequacy-private.kernel.mjs
 * Private-input capital ratio vs regulatory minimum — profiles the capital-ratio math of
 * art-07 (compute_basel31_delta) / art-180 (calculate_solvency2_scr_ratio) under OCG
 * Standard §25 ocg-private-input@1. Eligible capital + risk-weighted-assets are the
 * PRIVATE witness: never present in policy_parameters, output_payload, or the
 * execution_hash preimage. Only a sha256-salted@1 hiding commitment sits at
 * policy_parameters.capital_inputs_commitment. Proves "we are above the minimum" without
 * disclosing capital or RWA.
 *
 * Private-input variant of compute_basel31_delta / calculate_solvency2_scr_ratio — use the
 * public-input kernels when disclosure of the capital figures is acceptable; use this one
 * when it is not.
 *
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */
import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID      = 'art-415-check-capital-adequacy-private';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'check_capital_adequacy_private',
  mandate_type: 'analytics_mandate',
  gpu:          false,
  // §25 profile marker — see art-413's identical note. buildArtifact's first argument is the
  // PRIVATE WITNESS (capital_inputs/salt), not policy_parameters (commitment only).
  private_input_profile: 'ocg-private-input@1',
};

const REGULATORY_CITATION = 'Basel III/3.1 CET1 minimum incl. capital conservation buffer (BCBS d424); Solvency II SCR coverage minimum 100% (Delegated Regulation (EU) 2015/35).';
const DEFAULT_REGULATORY_MINIMUM_PCT = 10.5; // Basel III/3.1 CET1 minimum incl. 2.5pp conservation buffer

// ---- pure, deterministic verdict math over the PRIVATE capital + RWA figures ----
// Called only with the plaintext witness, held in the prover's memory — never with committed pp.
function capitalAdequacyPrivate(capital_inputs, regulatory_minimum_pct) {
  const capital = Number(capital_inputs?.eligible_capital);
  const rwa     = Number(capital_inputs?.risk_weighted_assets);
  const capitalFinite = Number.isFinite(capital) ? capital : 0;
  const rwaFinite     = Number.isFinite(rwa) ? rwa : 0;

  const ratio_pct = rwaFinite > 0 ? (capitalFinite / rwaFinite) * 100 : 0;
  const above_minimum = ratio_pct >= regulatory_minimum_pct;
  const tier = above_minimum
    ? (ratio_pct >= regulatory_minimum_pct + 2.5 ? 'well_capitalized' : 'adequately_capitalized')
    : 'below_minimum';

  return { above_minimum, tier };
}

// §25.1 commitment = sha256(salt ‖ cgCanon(input_value)), hex-encoded, "sha256:"-prefixed.
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

// See art-413's identical note: satisfies gate harnesses expecting a `compute` export without
// ever recomputing the verdict from policy_parameters alone (SPEC.md §18.3). Defined BEFORE
// buildArtifact so check-engine-parity.mjs's bundler (which extracts everything textually
// preceding `export async function buildArtifact`) captures it.
export function compute(pp) {
  const p = pp || {};
  return {
    above_minimum: null,
    tier: null,
    regulatory_minimum_pct: p.regulatory_minimum_pct ?? DEFAULT_REGULATORY_MINIMUM_PCT,
    note: 'Private-input node: verdict is not recomputable from policy_parameters alone (SPEC.md §18.3). Call buildArtifact with the private witness, or verify the existing artifact via validate_private_inputs.',
  };
}

/**
 * buildArtifact — the wire input `raw` is the caller's PRIVATE witness plus public config:
 *   { capital_inputs: {eligible_capital, risk_weighted_assets}, salt, regime?, regulatory_minimum_pct? }
 * The returned artifact's policy_parameters carries ONLY the commitment + public fields —
 * `capital_inputs` and `salt` never enter policy_parameters, output_payload, or the §4 preimage.
 */
export async function buildArtifact(raw, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const r = raw || {};
  const capital_inputs = (r.capital_inputs && typeof r.capital_inputs === 'object') ? r.capital_inputs : {};
  const salt           = r.salt;
  const regime         = typeof r.regime === 'string' ? r.regime : 'basel3.1';
  const regulatory_minimum_pct = Number.isFinite(Number(r.regulatory_minimum_pct)) ? Number(r.regulatory_minimum_pct) : DEFAULT_REGULATORY_MINIMUM_PCT;

  const verdict = capitalAdequacyPrivate(capital_inputs, regulatory_minimum_pct);
  const capital_inputs_commitment = await commitPrivateInput(salt, capital_inputs);

  const policy_parameters = {
    capital_inputs_commitment,
    regulatory_minimum_pct,
    regulatory_citation: REGULATORY_CITATION,
    regime,
  };
  const output_payload = {
    above_minimum: verdict.above_minimum,
    tier: verdict.tier,
    regulatory_minimum_pct,
    regulatory_basis: 'Basel III/3.1 CET1 minimum incl. capital conservation buffer (BCBS d424); Solvency II SCR coverage minimum 100% (Delegated Regulation (EU) 2015/35). Verdict proves the committed capital and RWA figures clear the pinned regulatory minimum — the underlying figures are never disclosed (OCG Standard §25 ocg-private-input@1).',
    pii_note: 'ZERO PII disclosed: eligible capital and risk-weighted assets are a private witness, never present in policy_parameters or output_payload. Only the above/below-minimum verdict is public.',
    not_legal_advice: 'Not legal or regulatory advice. Capital adequacy determinations require review by a qualified capital/treasury officer and the applicable prudential regulator.',
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
      { pointer: '/capital_inputs_commitment', commitment: capital_inputs_commitment, commitment_scheme: 'sha256-salted@1' },
    ],
    compliance_flags: verdict.above_minimum ? ['CAPITAL_ABOVE_MINIMUM'] : ['CAPITAL_BELOW_MINIMUM'],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
