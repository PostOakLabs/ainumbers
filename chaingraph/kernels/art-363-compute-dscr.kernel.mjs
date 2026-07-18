import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-363-compute-dscr';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_dscr',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Debt Service Coverage Ratio and Interest Coverage Ratio suite, ported from the shipped
// tools/438-dscr-interest-coverage-calculator.html calcRatios() -- byte-parity is the
// fixture gate. Standard credit-analysis definitions: Basic/Cash/FCF DSCR, Fixed Charge
// Coverage Ratio (FCCR), EBIT- and EBITDA-basis Interest Coverage Ratio (ICR), and Net/
// Gross Leverage. Lender threshold matrix (investment grade, leveraged loan, CRE,
// infrastructure, SME/mid-market) is the same published reference table shown on the tool
// page.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random. Ratios rounded
// to 2 decimal places (r2) only at declared output boundaries; a ratio whose denominator is
// non-positive is returned as null (finite gate: never NaN/Infinity).

const LENDERS = [
  { name: 'Investment Grade Corporate', dscr_min: 1.50, icr_min: 4.0 },
  { name: 'Leveraged Loan (BB)', dscr_min: 1.25, icr_min: 2.5 },
  { name: 'CRE / Property', dscr_min: 1.25, icr_min: null },
  { name: 'Infrastructure', dscr_min: 1.15, icr_min: null },
  { name: 'SME / Mid-market', dscr_min: 1.20, icr_min: 2.0 },
];

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }

function calcRatios(ebitda, ebit, interest, principal, leases, capex, taxes, wc, amort, revolver, totalDebt, cash) {
  const ds = interest + principal + revolver;
  const basicDSCR = ds > 0 ? ebitda / ds : null;
  const cashDSCR = ds > 0 ? (ebitda - capex - taxes) / ds : null;
  const fcfDSCR = ds > 0 ? (ebitda - capex - wc - taxes) / ds : null;
  const fccrDenom = interest + leases + principal;
  const fccr = fccrDenom > 0 ? (ebitda + leases) / fccrDenom : null;
  const icrEBIT = interest > 0 ? ebit / interest : null;
  const icrEBITDA = interest > 0 ? ebitda / interest : null;
  const netLev = ebitda > 0 ? (totalDebt - cash) / ebitda : null;
  const grossLev = ebitda > 0 ? totalDebt / ebitda : null;
  return { basicDSCR, cashDSCR, fcfDSCR, fccr, icrEBIT, icrEBITDA, netLev, grossLev, ds };
}

export function compute(pp) {
  pp = pp || {};

  const p = {
    ebitda_musd: safeNum(pp.ebitda_musd, 30),
    ebit_musd: safeNum(pp.ebit_musd, 22),
    interest_musd: Math.max(0, safeNum(pp.interest_musd, 6)),
    principal_musd: Math.max(0, safeNum(pp.principal_musd, 5)),
    leases_musd: Math.max(0, safeNum(pp.leases_musd, 2)),
    capex_musd: Math.max(0, safeNum(pp.capex_musd, 6)),
    taxes_musd: Math.max(0, safeNum(pp.taxes_musd, 5)),
    working_capital_change_musd: safeNum(pp.working_capital_change_musd, 1.5),
    amortization_musd: Math.max(0, safeNum(pp.amortization_musd, 5)),
    revolver_draw_musd: Math.max(0, safeNum(pp.revolver_draw_musd, 0)),
    total_debt_musd: Math.max(0, safeNum(pp.total_debt_musd, 80)),
    cash_musd: Math.max(0, safeNum(pp.cash_musd, 12)),
  };

  const r = calcRatios(
    p.ebitda_musd, p.ebit_musd, p.interest_musd, p.principal_musd, p.leases_musd,
    p.capex_musd, p.taxes_musd, p.working_capital_change_musd, p.amortization_musd,
    p.revolver_draw_musd, p.total_debt_musd, p.cash_musd,
  );

  const lender_assessment = LENDERS.map((ldr) => {
    const dscrOk = r.basicDSCR !== null && r.basicDSCR >= ldr.dscr_min;
    const icrOk = ldr.icr_min === null || (r.icrEBITDA !== null && r.icrEBITDA >= ldr.icr_min);
    return {
      lender_category: ldr.name,
      dscr_min: ldr.dscr_min,
      icr_min: ldr.icr_min,
      dscr_pass: dscrOk,
      icr_pass: ldr.icr_min === null ? null : icrOk,
      meets_threshold: dscrOk && icrOk,
    };
  });

  const compliance_flags = [];
  if (r.basicDSCR === null) compliance_flags.push('DSCR_ZERO_DEBT_SERVICE_DENOMINATOR');
  if (r.basicDSCR !== null && r.basicDSCR < 1.0) compliance_flags.push('DSCR_BELOW_ONE_INSUFFICIENT_COVERAGE');

  const output_payload = {
    basic_dscr: r2(r.basicDSCR),
    cash_dscr: r2(r.cashDSCR),
    fcf_dscr: r2(r.fcfDSCR),
    fccr: r2(r.fccr),
    icr_ebit_basis: r2(r.icrEBIT),
    icr_ebitda_basis: r2(r.icrEBITDA),
    net_leverage: r2(r.netLev),
    gross_leverage: r2(r.grossLev),
    total_debt_service_musd: r2(r.ds),
    lender_assessment,
    regulatory_basis: 'Standard credit-analysis DSCR/ICR/leverage definitions used in commercial lending covenant testing; lender threshold matrix reflects typical market convention, not a regulatory mandate.',
    note: 'Ratios with a non-positive denominator return null rather than an unbounded or NaN value.',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
