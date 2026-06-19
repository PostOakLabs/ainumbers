/**
 * cry-01-zk-compliance-proof-generator.kernel.mjs
 * ZK Compliance Proof Generator — LCG PRNG, predicate evaluation.
 * NTT (async BigInt) is replaced with a synchronous proof simulation.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

export const meta = {
  tool_id:      'cry-01-zk-compliance-proof-generator',
  mcp_name:     'generate_zk_compliance_proof',
  mandate_type: 'compliance_mandate',
  version:      '1.0.0',
};

// ── LCG (matches source HTML) ─────────────────────────────────────────────────
function makeLCG(seed) {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// ── Predicate definitions (ported from source PREDICATES) ────────────────────
const PREDICATES = {
  amount_below_threshold: {
    label: 'Amount Below Threshold',
    check: (data) => (data.amount ?? 0) < (data.threshold ?? 10000),
    constraint_count: 4,
    proof_system: 'Groth16',
  },
  sanctions_clear: {
    label: 'Sanctions Screening Clear',
    check: (data) => !(data.on_sanctions_list ?? false),
    constraint_count: 8,
    proof_system: 'PLONK',
  },
  kyc_complete: {
    label: 'KYC Documentation Complete',
    check: (data) => (data.kyc_level ?? 0) >= (data.required_kyc_level ?? 2),
    constraint_count: 6,
    proof_system: 'Groth16',
  },
  travel_rule_threshold: {
    label: 'Travel Rule Threshold Compliance',
    check: (data) => !((data.amount ?? 0) >= 1000 && !(data.originator_info && data.beneficiary_info)),
    constraint_count: 10,
    proof_system: 'PLONK',
  },
  velocity_normal: {
    label: 'Transaction Velocity Within Bounds',
    check: (data) => (data.tx_count_24h ?? 0) < (data.velocity_limit ?? 50),
    constraint_count: 5,
    proof_system: 'Groth16',
  },
  source_of_funds: {
    label: 'Source of Funds Verified',
    check: (data) => (data.source_of_funds_verified ?? false) === true,
    constraint_count: 12,
    proof_system: 'STARK',
  },
};

// ── Synchronous NTT proof simulation ────────────────────────────────────────
// Replaces the async BigInt NTT from source. Returns a deterministic proof token.
function simulateProofSync(rng, constraint_count, proof_system) {
  // Generate a simulated proof commitment (hex-like string, 32 "bytes")
  const bytes = [];
  for (let i = 0; i < 32; i++) {
    bytes.push(Math.floor(rng() * 256).toString(16).padStart(2, '0'));
  }
  const commitment = bytes.join('');
  // Simulate proof verification time proportional to constraints
  const proof_ms_simulated = Math.round(constraint_count * (proof_system === 'STARK' ? 12 : 8));
  return { commitment, proof_ms_simulated };
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const seed          = pp.seed          ?? 42;
  const predicate_type = pp.predicate_type ?? 'amount_below_threshold';
  const data          = pp.data          ?? {};

  const predicate = PREDICATES[predicate_type];
  if (!predicate) {
    return {
      proof_result:   'INVALID',
      predicate_type,
      error:          `Unknown predicate: ${predicate_type}`,
      checks:         [],
      compliance_flags: ['ZK_PROOF_INVALID_PREDICATE'],
    };
  }

  const rng = makeLCG(seed);

  // Evaluate the predicate
  let predicate_passed = false;
  try {
    predicate_passed = predicate.check(data);
  } catch (e) {
    predicate_passed = false;
  }

  // Generate proof simulation
  const { commitment, proof_ms_simulated } = simulateProofSync(rng, predicate.constraint_count, predicate.proof_system);

  // Build checks array (one per constraint, simplified)
  const checks = [];
  for (let i = 0; i < predicate.constraint_count; i++) {
    const passed = predicate_passed && rng() > 0.02; // 2% noise for non-critical constraints
    checks.push({
      constraint_index: i,
      label:            `Constraint ${i + 1}`,
      satisfied:        predicate_passed ? true : (i > 0 && rng() > 0.5), // first constraint fails for failed proofs
    });
  }
  // Ensure first constraint reflects actual predicate result
  if (checks.length > 0) checks[0].satisfied = predicate_passed;

  const proof_result = predicate_passed ? 'VALID' : 'INVALID';

  const compliance_flags = [];
  if (proof_result === 'VALID') {
    compliance_flags.push('ZK_PROOF_VALID');
    compliance_flags.push(`ZK_${predicate.proof_system}_VERIFIED`);
  } else {
    compliance_flags.push('ZK_PROOF_INVALID');
    compliance_flags.push(`ZK_PREDICATE_${predicate_type.toUpperCase()}_FAILED`);
  }

  return {
    proof_result,
    predicate_type,
    predicate_label:    predicate.label,
    proof_system:       predicate.proof_system,
    constraint_count:   predicate.constraint_count,
    proof_commitment:   commitment,
    proof_ms_simulated,
    checks,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:           meta.tool_id,
    mandate_type:      meta.mandate_type,
    proof_result:      r.proof_result,
    predicate_type:    r.predicate_type,
    proof_system:      r.proof_system,
    constraint_count:  r.constraint_count,
    proof_commitment:  r.proof_commitment,
    checks:            r.checks,
    compliance_flags:  r.compliance_flags,
    inputs:            pp,
  };
}
