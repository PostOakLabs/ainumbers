import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-479-compare-receivables-finance-economics';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compare_receivables_finance_economics',
  mandate_type: 'analytics_mandate', gpu: false,
};

// Net-proceeds / effective-annual-cost comparison across forfaiting (non-recourse, PV discount),
// factoring with recourse, factoring without recourse, and invoice discounting. Provable node
// counterpart to tools/425-forfaiting-factoring-economics.html's `runComparison()` -- ported
// verbatim (same four formulas, same day-count conventions) so tool<->kernel parity is exact.
//
// Deterministic by construction: pure +,-,*,/ arithmetic only (no sqrt/exp/log/pow, so no
// _detmath transcendentals needed -- +,-,*,/ are IEEE-754 bit-portable across every JS engine
// per OCG SPEC Sec 18.5). No Date.now()/bare new Date()/Math.random()/locale formatting.
// Finite gate: invoice_value and tenor_days must be positive finite numbers or compute() throws
// a clean rejection (empty-input-finite.test.mjs option (a)); every cost formula's denominator
// is floored at 1e-9 so a degenerate (zero) net-proceeds input cannot leak Infinity/NaN.
//
// forfaiting_commitment_fee_pct is accepted (mirrors the tool page's input_schema) but, like the
// tool page itself, is NOT used in the net-proceeds/cost math -- the page computes forfCommit but
// never reads it in runComparison(). This kernel intentionally reproduces that as-is (row fence:
// do not "fix" the page's math to fit the kernel).

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function pct(v) { const n = num(v); return n === null ? 0 : n / 100; }
function str(v, dfl) { return typeof v === 'string' && v ? v : dfl; }

function annualCost(fv, netProceeds, tenorDays) {
  const denom = netProceeds > 1e-9 ? netProceeds : 1e-9;
  return ((fv - netProceeds) / denom) * (365 / tenorDays) * 100;
}

export function compute(pp) {
  pp = pp || {};
  const fv = num(pp.invoice_value);
  if (fv === null || fv <= 0) throw new Error('invoice_value must be a positive number');
  const tenor = num(pp.tenor_days);
  if (tenor === null || tenor <= 0) throw new Error('tenor_days must be a positive number');

  const currency = str(pp.currency, 'USD');
  const obligorQuality = str(pp.obligor_quality, 'sub_ig');
  const numDebtors = str(pp.num_debtors, 'mid');

  const forfDisc = pct(pp.forfaiting_discount_rate_pct);
  const forfArr = pct(pp.forfaiting_arrangement_fee_pct);

  const factAdv = pct(pp.factoring_advance_rate_pct);
  const factSvc = pct(pp.factoring_service_fee_pct);
  const factFin = pct(pp.factoring_finance_charge_pct);

  const nrAdv = pct(pp.nr_factoring_advance_rate_pct);
  const nrSvc = pct(pp.nr_factoring_service_fee_pct);
  const nrFin = pct(pp.nr_factoring_finance_charge_pct);

  const idAdv = pct(pp.id_advance_rate_pct);
  const idDisc = pct(pp.id_discount_charge_pct);
  const idSvc = pct(pp.id_service_fee_pct);

  // FORFAITING: PV = FV / (1 + discount_rate * tenor/360); arrangement fee on face; non-recourse.
  const forfPV = fv / (1 + forfDisc * (tenor / 360));
  const forfFees = fv * forfArr;
  const forfNetProceeds = forfPV - forfFees;
  const forfCost = annualCost(fv, forfNetProceeds, tenor);

  // FACTORING (WITH RECOURSE)
  const factAdvAmt = fv * factAdv;
  const factSvcAmt = fv * factSvc;
  const factFinAmt = factAdvAmt * factFin * (tenor / 365);
  const factNetProceeds = factAdvAmt - factSvcAmt - factFinAmt;
  const factCost = annualCost(fv, factNetProceeds, tenor);

  // FACTORING (NON-RECOURSE)
  const nrAdvAmt = fv * nrAdv;
  const nrSvcAmt = fv * nrSvc;
  const nrFinAmt = nrAdvAmt * nrFin * (tenor / 365);
  const nrNetProceeds = nrAdvAmt - nrSvcAmt - nrFinAmt;
  const nrCost = annualCost(fv, nrNetProceeds, tenor);

  // INVOICE DISCOUNTING
  const idAdvAmt = fv * idAdv;
  const idSvcAmt = fv * idSvc;
  const idDiscAmt = idAdvAmt * idDisc * (tenor / 365);
  const idNetProceeds = idAdvAmt - idSvcAmt - idDiscAmt;
  const idCost = annualCost(fv, idNetProceeds, tenor);

  const instruments = [
    { id: 'forfaiting', name: 'Forfaiting', net_proceeds: forfNetProceeds, cost: forfCost, recourse: 'non-recourse' },
    { id: 'factoring_recourse', name: 'Factoring (With Recourse)', net_proceeds: factNetProceeds, cost: factCost, recourse: 'with-recourse' },
    { id: 'factoring_non_recourse', name: 'Factoring (Non-Recourse)', net_proceeds: nrNetProceeds, cost: nrCost, recourse: 'non-recourse' },
    { id: 'invoice_discounting', name: 'Invoice Discounting', net_proceeds: idNetProceeds, cost: idCost, recourse: 'with-recourse' },
  ];

  const maxProceeds = Math.max.apply(null, instruments.map((i) => i.net_proceeds));
  const minCost = Math.min.apply(null, instruments.map((i) => i.cost));
  const bestProceeds = instruments.find((i) => i.net_proceeds === maxProceeds);
  const cheapest = instruments.find((i) => i.cost === minCost);
  const sorted = instruments.slice().sort((a, b) => a.cost - b.cost);

  const results = {};
  for (const i of instruments) {
    results[i.id] = {
      net_proceeds: Math.round(i.net_proceeds),
      effective_annual_cost_pct: Math.round(i.cost * 100) / 100,
      recourse: i.recourse,
    };
  }

  const output_payload = {
    portfolio: { face_value: fv, tenor_days: tenor, currency, obligor_quality: obligorQuality, num_debtors: numDebtors },
    results,
    cheapest_instrument: cheapest.name,
    highest_proceeds_instrument: bestProceeds.name,
    cost_ranking: sorted.map((i) => i.name),
  };

  const compliance_flags = ['RECEIVABLES_FINANCE_ECONOMICS_COMPARED'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
