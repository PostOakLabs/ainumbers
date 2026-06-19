/**
 * art-36-tempo-mpp-agent-mandate.kernel.mjs
 * Tempo MPP Agent Mandate — decode and risk-score an agent payment session.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

export const meta = {
  tool_id:      'art-36-tempo-mpp-agent-mandate',
  mcp_name:     'decode_mpp_session',
  mandate_type: 'payment_mandate',
  version:      '1.0.0',
};

const CALL_COSTS = {
  tempo_stablecoin: 0.001,
  fiat_card:        0.10,
  lightning:        0.0005,
};

function validateDid(did) {
  return typeof did === 'string' && did.startsWith('did:key:z6Mk');
}

function computeRisk(agentDid, rail, spendCap, didValid) {
  if (!didValid) {
    return {
      level: 'HIGH',
      reasons: [
        'Agent DID does not match did:key:z6Mk... format — identity unverified',
        'KYA check failed: cannot confirm agent signer',
      ],
    };
  }

  if (rail === 'tempo_stablecoin' && spendCap <= 50) {
    return {
      level: 'LOW',
      reasons: [
        'Agent DID validated as did:key method (z6Mk prefix, self-describing, registry-free)',
        'Tempo stablecoin rail selected — on-chain settlement, no chargeback risk',
        'Spend cap ≤ $50 — low-value session, minimal exposure',
      ],
    };
  }

  // MEDIUM
  const reasons = [
    'Agent DID validated as did:key method (z6Mk prefix, self-describing, registry-free)',
  ];
  if (spendCap > 50) {
    reasons.push(`Spend cap $${spendCap} exceeds $50 threshold — elevated exposure`);
  }
  if (rail === 'fiat_card') {
    reasons.push('Fiat card rail — chargeback window applies (60–120 days CNP)');
  }
  if (rail === 'lightning') {
    reasons.push('Lightning rail — payment channel risk, routing uncertainty');
  }
  return { level: 'MEDIUM', reasons };
}

export function compute(pp) {
  const agentDid  = pp.agentDid  ?? '';
  const merchant  = pp.merchant  ?? '';
  const spendCap  = pp.spendCap  ?? 0;
  const duration  = pp.duration  ?? '8h';
  const rail      = pp.rail      ?? 'tempo_stablecoin';
  const stablecoin = pp.stablecoin ?? 'USDC';
  const cadence   = pp.cadence   ?? 'per-request';

  const costPerCall  = CALL_COSTS[rail] ?? CALL_COSTS.tempo_stablecoin;
  const maxVouchers  = Math.floor(spendCap / costPerCall);
  const didValid     = validateDid(agentDid);
  const risk         = computeRisk(agentDid, rail, spendCap, didValid);

  const compliance_flags = ['SPEND_CAP_SET'];
  if (didValid) compliance_flags.push('AGENT_IDENTITY_VERIFIED');
  compliance_flags.push('MPP_SESSION_STRUCTURED');

  return {
    risk,
    did_valid:       didValid,
    max_vouchers:    maxVouchers,
    cost_per_call:   costPerCall,
    rail,
    stablecoin,
    spend_cap:       spendCap,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:          meta.tool_id,
    mandate_type:     meta.mandate_type,
    risk:             r.risk,
    did_valid:        r.did_valid,
    max_vouchers:     r.max_vouchers,
    cost_per_call:    r.cost_per_call,
    rail:             r.rail,
    stablecoin:       r.stablecoin,
    spend_cap:        r.spend_cap,
    compliance_flags: r.compliance_flags,
    inputs:           pp,
  };
}
