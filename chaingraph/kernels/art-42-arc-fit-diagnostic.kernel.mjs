/**
 * art-42-arc-fit-diagnostic.kernel.mjs
 * Arc Fit Diagnostic — 12-Q / 4-dimension A–F readiness scorer.
 * Routes to: arc-cpn-payment, arc-stablefx, arc-dvp-settlement,
 *            arc-agentic-commerce, arc-cctp-transfer.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

export const meta = {
  tool_id:      'art-42-arc-fit-diagnostic',
  mcp_name:     'run_arc_fit_diagnostic',
  mandate_type: 'agent_guardrail_mandate',
  version:      '1.0.0',
};

// Scoring constant
const SCORE = { yes: 4, partial: 2, no: 0 };

// Dimensions: id → label, chain routing slug, 3-question list
const DIMS = [
  {
    id:    'cpn',
    label: 'CPN Payments',
    chain: 'arc-cpn-payment',
    questions: [
      'q1_cpn_connectivity',        // PSP/bank already on CPN or evaluating
      'q2_corridor_volume',         // >$50k/month cross-border USD volume
      'q3_settlement_cutoff_pain',  // Cut-off windows / T+2 delay cause problems
    ],
  },
  {
    id:    'stablefx',
    label: 'StableFX / FX Settlement',
    chain: 'arc-stablefx',
    questions: [
      'q4_fx_margin_pressure',      // FX spread / margin cost is a concern
      'q5_herstatt_exposure',       // Intraday FX credit exposure (Herstatt risk)
      'q6_24_7_settlement_need',    // Need FX settlement outside CLS 5-cut windows
    ],
  },
  {
    id:    'dvp',
    label: 'DvP / Capital Markets',
    chain: 'arc-dvp-settlement',
    questions: [
      'q7_dvp_trade_type',              // Execute tokenized-asset DvP trades
      'q8_usyc_collateral_interest',    // Interest in USYC as on-chain collateral
      'q9_prefunding_cost',             // Pre-funding or failed-settlement charges
    ],
  },
  {
    id:    'commerce',
    label: 'Agentic Commerce',
    chain: 'arc-agentic-commerce',
    questions: [
      'q10_agent_payment_volume',  // AI agents making payments on behalf of users
      'q11_gas_sensitivity',       // ETH gas costs blocking agent micro-payments
      'q12_x402_ap2_adoption',     // Evaluating x402 / AP2 agentic payment protocols
    ],
  },
];

const DIM_MAX   = 12; // 3 questions × 4 pts
const TOTAL_MAX = 48;

// Grade thresholds (total raw score)
function grade(score) {
  if (score >= 40) return 'A';
  if (score >= 32) return 'B';
  if (score >= 24) return 'C';
  if (score >= 12) return 'D';
  return 'F';
}

// CCTP routing fires when ≥2 dimensions have at least 1 positive answer (score > 0)
function cctpBranch(dimResults) {
  const active = dimResults.filter(d => d.score > 0).length;
  return active >= 2;
}

export function compute(pp) {
  // pp keys: q1_cpn_connectivity … q12_x402_ap2_adoption (each 'yes'|'partial'|'no')
  const dimResults = DIMS.map(dim => {
    const dimScore = dim.questions.reduce(
      (acc, q) => acc + (SCORE[pp[q] ?? 'no'] ?? 0),
      0
    );
    return {
      id:    dim.id,
      label: dim.label,
      chain: dim.chain,
      score: dimScore,
      max:   DIM_MAX,
      pct:   Math.round((dimScore / DIM_MAX) * 100),
    };
  });

  const totalScore = dimResults.reduce((a, d) => a + d.score, 0);
  const totalPct   = Math.round((totalScore / TOTAL_MAX) * 100);

  // Primary chain routing: highest dim score wins;
  // tie-break order: cpn > stablefx > commerce > dvp
  const TIE_BREAK = ['cpn', 'stablefx', 'commerce', 'dvp'];
  const sorted = [...dimResults].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return TIE_BREAK.indexOf(a.id) - TIE_BREAK.indexOf(b.id);
  });
  const primaryDim = sorted[0];

  const overallGrade = grade(totalScore);

  // CCTP cross-chain branch
  const cctp_branch = cctpBranch(dimResults);

  // Compliance flags
  const compliance_flags = [];
  if (overallGrade === 'A' || overallGrade === 'B') {
    compliance_flags.push('ARC_FIT_CONFIRMED');
  } else if (overallGrade === 'C') {
    compliance_flags.push('ARC_PARTIAL_FIT');
  } else {
    compliance_flags.push('ARC_NOT_READY');
  }
  if (cctp_branch) compliance_flags.push('CCTP_ROUTING_RECOMMENDED');

  return {
    verdict:       overallGrade,
    total_score:   totalScore,
    total_max:     TOTAL_MAX,
    total_pct:     totalPct,
    primary_chain: primaryDim.chain,
    primary_dim:   primaryDim.id,
    cctp_branch,
    dim_results:   dimResults,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:          meta.tool_id,
    mandate_type:     meta.mandate_type,
    verdict:          r.verdict,
    total_score:      r.total_score,
    total_pct:        r.total_pct,
    primary_chain:    r.primary_chain,
    cctp_branch:      r.cctp_branch,
    dim_results:      r.dim_results,
    compliance_flags: r.compliance_flags,
    inputs:           pp,
  };
}
