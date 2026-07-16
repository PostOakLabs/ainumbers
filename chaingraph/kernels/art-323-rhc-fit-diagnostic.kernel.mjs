/**
 * art-323-rhc-fit-diagnostic.kernel.mjs
 * Robinhood Chain Fit Diagnostic — 12-Q / 4-path readiness scorer, entry point for RHC-1..RHC-6.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-323-rhc-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_robinhood_chain_fit_diagnostic',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

// Scoring constant
const SCORE = { yes: 4, partial: 2, no: 0 };

// Paths: id -> label, primary/secondary downstream chains, question list
const PATHS = [
  {
    id: 'stock_app',
    label: 'Stock-Token Application',
    chains: ['rhc-multiplier-reconciliation', 'rhc-valuation-lint'],
    questions: [
      'q1_holds_or_custodies_stock_tokens',
      'q2_tracks_corporate_actions',
      'q3_computes_usd_valuation',
    ],
  },
  {
    id: 'collateral_venue',
    label: 'Collateral / Lending Venue',
    chains: ['rhc-collateral-haircut'],
    questions: [
      'q4_accepts_stock_tokens_as_collateral',
      'q5_needs_staleness_halt_checks',
      'q6_off_hours_settlement_exposure',
    ],
  },
  {
    id: 'index_basket',
    label: 'Index / Basket / Compliance Characterization',
    chains: ['rhc-regime-mapping'],
    questions: [
      'q7_builds_index_or_basket_product',
      'q8_needs_regulatory_characterization',
      'q9_assumed_mica_genius_applies',
    ],
  },
  {
    id: 'agent_settlement',
    label: 'Agent-Settlement / Redemption Risk',
    chains: ['rhc-bold-finality-classification', 'rhc-ap-redemption-stress'],
    questions: [
      'q10_asserts_settlement_finality',
      'q11_relies_on_redemption_reachability',
      'q12_automates_settlement_decisions',
    ],
  },
];

const PATH_MAX = 12; // 3 questions x 4 pts
const TOTAL_MAX = 48;

function grade(score) {
  if (score >= 40) return 'A';
  if (score >= 30) return 'B';
  if (score >= 20) return 'C';
  if (score >= 12) return 'D';
  return 'F';
}

export function compute(pp) {
  // pp keys: q1_holds_or_custodies_stock_tokens ... q12_automates_settlement_decisions (each 'yes'|'partial'|'no')
  const pathResults = PATHS.map(path => {
    const pathScore = path.questions.reduce(
      (acc, q) => acc + (SCORE[pp[q] ?? 'no'] ?? 0),
      0
    );
    return {
      id:     path.id,
      label:  path.label,
      chains: path.chains,
      score:  pathScore,
      max:    PATH_MAX,
      pct:    Math.round((pathScore / PATH_MAX) * 100),
    };
  });

  const totalScore = pathResults.reduce((a, p) => a + p.score, 0);
  const totalPct   = Math.round((totalScore / TOTAL_MAX) * 100);

  // Routed workflow list: every path with score > 0, ordered highest-first.
  // Tie-break order mirrors the estate default: agent_settlement > collateral_venue > stock_app > index_basket.
  const TIE_BREAK = ['agent_settlement', 'collateral_venue', 'stock_app', 'index_basket'];
  const sorted = [...pathResults].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return TIE_BREAK.indexOf(a.id) - TIE_BREAK.indexOf(b.id);
  });

  const routed_workflows = sorted
    .filter(p => p.score > 0)
    .flatMap(p => p.chains);

  const overallGrade = grade(totalScore);

  const compliance_flags = [];
  if (overallGrade === 'A' || overallGrade === 'B') {
    compliance_flags.push('RHC_FIT_CONFIRMED');
  } else if (overallGrade === 'C') {
    compliance_flags.push('RHC_PARTIAL_FIT');
  } else {
    compliance_flags.push('RHC_NOT_READY');
  }

  const output_payload = {
    verdict:          overallGrade,
    total_score:      totalScore,
    total_max:        TOTAL_MAX,
    total_pct:        totalPct,
    primary_path:     sorted[0].id,
    routed_workflows,
    path_results:     pathResults,
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
