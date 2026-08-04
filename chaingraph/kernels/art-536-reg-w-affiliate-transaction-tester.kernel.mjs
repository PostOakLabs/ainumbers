import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-536-reg-w-affiliate-transaction-tester';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'test_reg_w_affiliate_transactions',
  mandate_type: 'compliance_control', gpu: false,
};

// Regulation W (12 CFR 223) covered-transaction quantitative-limit tester (art-536,
// BILLABLES-WAVE2-BUILD-SPEC.md SS6). Per covered transaction with an affiliate, tests the
// 10% single-affiliate / 20% aggregate-affiliate capital limits (12 CFR 223.11/223.12) and
// a collateral-coverage percentage requirement on covered CREDIT transactions (12 CFR
// 223.14). The qualitative "on terms substantially the same" market-terms test (12 CFR
// 223.51) is NEVER computed here -- market_terms_substantially_same is a caller-declared
// boolean the kernel only records for the artifact, never a judgment this kernel makes.
//
// CFR PERCENTAGES ARE PINNED POLICY INPUT, NEVER KERNEL SOURCE (art-445/art-484/art-507
// discipline applied here): capital_base, single_affiliate_limit_pct,
// aggregate_affiliate_limit_pct, and collateral_coverage_required_pct all arrive as
// policy_parameters, with policy_vintage a REQUIRED field citing the eCFR codification
// year used. There is no in-kernel fallback to "10"/"20" even though those numbers match
// today's statute -- a future 223 amendment must not require a kernel-source edit.
//
// KILL CONDITION (absence-instrument discipline, art-524 precedent): if capital_base, either
// limit percentage, collateral_coverage_required_pct, policy_vintage, or a non-empty
// transactions[] is not declared, the node refuses to guess and emits execution_state
// "did_not_run" rather than a degraded result.
//
// IDENTIFIER SCOPE CHECKED (SS6 SS25 instruction): affiliate_id/transaction_id are
// caller-declared institutional labels for a legal-entity affiliate and an internal
// transaction reference -- not a natural person's identifier -- the same non-PII-label
// precedent as art-524's source_id. No SS25 salting applies; no PII enters this schema.
//
// Rollup (SPEC.md SS27.4, closed enum, no new vocabulary): either quantitative capital
// limit breached => escalate (a substantive finding, not a role/authorization outcome, so
// never reject); no capital breach but a collateral shortfall on a covered credit
// transaction => review_required; both limits satisfied and no shortfall => auto_pass.
//
// Deterministic arithmetic only -- no clock, no randomness, no network, zero PII.

function s(v) { return String(v == null ? '' : v).trim(); }
function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : null; }

export function compute(pp) {
  pp = pp || {};
  const policy_vintage = s(pp.policy_vintage) || null;
  const capital_base = n(pp.capital_base);
  const single_affiliate_limit_pct = n(pp.single_affiliate_limit_pct);
  const aggregate_affiliate_limit_pct = n(pp.aggregate_affiliate_limit_pct);
  const collateral_coverage_required_pct = n(pp.collateral_coverage_required_pct);
  const transactions_in = Array.isArray(pp.transactions) ? pp.transactions : [];

  const policyDeclared = policy_vintage
    && capital_base !== null && capital_base > 0
    && single_affiliate_limit_pct !== null
    && aggregate_affiliate_limit_pct !== null
    && collateral_coverage_required_pct !== null;

  if (!policyDeclared || transactions_in.length === 0) {
    return {
      output_payload: {
        execution_state: 'did_not_run',
        decision: null,
        reason: !policyDeclared
          ? 'reg_w_policy_parameters_not_declared'
          : 'no_covered_transactions_declared',
        policy_vintage,
        single_affiliate_tests: [],
        aggregate_test: null,
        collateral_tests: [],
        market_terms_declarations: [],
      },
      compliance_flags: ['REG_W_KILL_CONDITION_INCOMPLETE_DECLARATION'],
    };
  }

  const transactions = transactions_in.map((t) => ({
    affiliate_id: s(t && t.affiliate_id),
    transaction_id: s(t && t.transaction_id),
    transaction_type: s(t && t.transaction_type) || 'credit',
    amount: n(t && t.amount) || 0,
    collateral_value: n(t && t.collateral_value),
    market_terms_substantially_same: (t && t.market_terms_substantially_same) === true,
    collateral_coverage_required_pct_override: n(t && t.collateral_coverage_required_pct_override),
  })).filter((t) => t.affiliate_id);

  const byAffiliate = new Map();
  for (const t of transactions) {
    byAffiliate.set(t.affiliate_id, (byAffiliate.get(t.affiliate_id) || 0) + t.amount);
  }

  const single_affiliate_limit_amount = r2(capital_base * (single_affiliate_limit_pct / 100));
  const single_affiliate_tests = [...byAffiliate.entries()].map(([affiliate_id, exposure]) => ({
    affiliate_id,
    exposure: r2(exposure),
    limit_amount: single_affiliate_limit_amount,
    breach: exposure > single_affiliate_limit_amount,
  }));
  const single_affiliate_breach = single_affiliate_tests.some((r) => r.breach);

  const aggregate_exposure = transactions.reduce((acc, t) => acc + t.amount, 0);
  const aggregate_limit_amount = r2(capital_base * (aggregate_affiliate_limit_pct / 100));
  const aggregate_breach = aggregate_exposure > aggregate_limit_amount;
  const aggregate_test = {
    exposure: r2(aggregate_exposure),
    limit_amount: aggregate_limit_amount,
    breach: aggregate_breach,
  };

  const collateral_tests = transactions
    .filter((t) => t.transaction_type === 'credit')
    .map((t) => {
      const required_pct = t.collateral_coverage_required_pct_override !== null
        ? t.collateral_coverage_required_pct_override
        : collateral_coverage_required_pct;
      const required_collateral = r2(t.amount * (required_pct / 100));
      const collateral_value = t.collateral_value;
      const shortfall = collateral_value === null || collateral_value < required_collateral;
      return {
        transaction_id: t.transaction_id,
        affiliate_id: t.affiliate_id,
        amount: r2(t.amount),
        required_collateral_pct: required_pct,
        required_collateral,
        collateral_value,
        shortfall,
      };
    });
  const collateral_shortfall = collateral_tests.some((r) => r.shortfall);

  const market_terms_declarations = transactions.map((t) => ({
    transaction_id: t.transaction_id,
    affiliate_id: t.affiliate_id,
    market_terms_substantially_same: t.market_terms_substantially_same,
  }));

  const compliance_flags = [];
  let decision;
  if (single_affiliate_breach || aggregate_breach) {
    decision = 'escalate';
    if (single_affiliate_breach) compliance_flags.push('SINGLE_AFFILIATE_LIMIT_BREACHED');
    if (aggregate_breach) compliance_flags.push('AGGREGATE_AFFILIATE_LIMIT_BREACHED');
  } else if (collateral_shortfall) {
    decision = 'review_required';
    compliance_flags.push('COLLATERAL_COVERAGE_SHORTFALL_DETECTED');
  } else {
    decision = 'auto_pass';
    compliance_flags.push('REG_W_QUANTITATIVE_LIMITS_SATISFIED');
  }

  return {
    output_payload: {
      execution_state: 'ran',
      decision,
      reason: null,
      policy_vintage,
      single_affiliate_tests,
      aggregate_test,
      collateral_tests,
      market_terms_declarations,
    },
    compliance_flags,
  };
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
