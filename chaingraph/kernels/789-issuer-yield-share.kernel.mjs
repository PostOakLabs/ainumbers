import { executionHash } from './_hash.mjs';

// 789-issuer-yield-share — recomputes a white-label stablecoin deal's reserve-income
// split (issuer, platform, distributor, custodian) from aggregate declared values and
// traces every holder-facing reward to its payer and funding source, flagging any
// reward whose payer is the issuer or whose funding is an issuer flow. KERNEL SOURCE
// IS BEHAVIOUR ONLY (KERNEL-CITATION-CLASS-1): the statutory citation for the yield
// prohibition lives in the node shard's cited_clause_digest / description and in the
// node page copy, never in this file.
//
// Inputs (aggregate only, integer minor units and integer basis points):
//   profile        — 'genius_enacted' (the only shipped profile; refused otherwise).
//   period         — { days, avg_reserve_value_minor, reserve_yield_bp } OR the same
//                    object carrying a declared reserve_income_minor.
//   split          — [{ party_role, share_bp | fixed_minor }] over issuer / platform /
//                    distributor / custodian.
//   holder_rewards — [{ payer_role, funded_from, value_minor, conditioned_on }] with
//                    funded_from in { reserve_income, distributor_margin, other } and
//                    conditioned_on in { holding, activity, none }.
//
// ROUNDING RULE (the one documented rule): every derived minor-unit amount is
// Math.floor of the exact product (bp math: floor(value * bp / 10000); income from an
// annual yield accrues linearly over days/365). The split conserves only when the
// floored share amounts sum exactly to the recomputed income.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no
// network, no filesystem, no TextEncoder/atob/btoa/URL inside compute(). No UTF-8
// encoding is needed, so no pure-JS encoder is carried (scaffold hygiene rule).

const TOOL_ID = '789-issuer-yield-share';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_issuer_reserve_yield_share',
  mandate_type: 'compliance_control', gpu: false,
};

/**
 * compute(pp) — pure decision kernel.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const flags = [];
  const PROFILE = 'genius_enacted';

  // FLAG-COMPUTED-LINT (FLAGS-COMPUTED-LINT-1): refusal flag emitted via ternary on the
  // data-dependent `refused` marker at the compute return — never an unconditional push.
  let refused = false;
  function refuse(reason, detail) {
    refused = true;
    return {
      output_payload: {
        profile: typeof pp.profile === 'string' ? pp.profile : null,
        verdict: 'refused',
        refused_because: reason,
        detail: detail || null,
        income: null,
        holder_rewards_trace: null,
        flags: null,
        manual_review_required: true,
      },
      compliance_flags: refused ? ['MALFORMED_INPUT_REFUSED'] : flags,
    };
  }

  // -- profile: only the enacted statutory profile is pinned by this row.
  if (pp.profile !== PROFILE) {
    return refuse('profile_must_be_genius_enacted', String(pp.profile).slice(0, 60));
  }

  // -- period: integer days >= 1; either a declared income or (avg value, annual bp).
  const period = pp.period || {};
  const days = period.days;
  if (typeof days !== 'number' || !isFinite(days) || days !== Math.floor(days) || days < 1 || days > 366) {
    return refuse('period_days_must_be_integer_1_to_366', String(days));
  }
  const declaredIncome = period.reserve_income_minor;
  let declaredIncomeMinor = null;
  let avg = null;
  let bp = null;
  if (declaredIncome !== undefined && declaredIncome !== null) {
    if (typeof declaredIncome !== 'number' || !isFinite(declaredIncome) || declaredIncome !== Math.floor(declaredIncome) || declaredIncome < 0) {
      return refuse('reserve_income_minor_must_be_nonnegative_integer', String(declaredIncome));
    }
    declaredIncomeMinor = declaredIncome;
  } else {
    avg = period.avg_reserve_value_minor;
    bp = period.reserve_yield_bp;
    if (typeof avg !== 'number' || !isFinite(avg) || avg !== Math.floor(avg) || avg < 0) {
      return refuse('avg_reserve_value_minor_must_be_nonnegative_integer', String(avg));
    }
    if (typeof bp !== 'number' || !isFinite(bp) || bp !== Math.floor(bp) || bp < 0 || bp > 100000) {
      return refuse('reserve_yield_bp_must_be_integer_0_to_100000', String(bp));
    }
  }

  // -- recomputed income (the single rounding rule: floor).
  const incomeMinor = declaredIncomeMinor !== null
    ? declaredIncomeMinor
    : Math.floor(Math.floor(avg * bp / 10000) * days / 365);

  // -- split: 1..16 parties, each share_bp (0..10000) or fixed_minor (>= 0), not both.
  const split = pp.split;
  if (!Array.isArray(split) || split.length < 1 || split.length > 16) {
    return refuse('split_must_be_array_1_to_16', String(Array.isArray(split) ? split.length : typeof split));
  }
  const ROLE_RE = /^[a-z_]{3,24}$/;
  const shares = [];
  let sumBp = 0;
  let hasBp = false;
  let sumFixed = 0;
  for (let i = 0; i < split.length; i++) {
    const e = split[i] || {};
    if (typeof e.party_role !== 'string' || !ROLE_RE.test(e.party_role)) {
      return refuse('split_party_role_must_be_snake_case', String(e.party_role).slice(0, 40));
    }
    const hasBpEntry = e.share_bp !== undefined && e.share_bp !== null;
    const hasFixed = e.fixed_minor !== undefined && e.fixed_minor !== null;
    if (hasBpEntry === hasFixed) {
      return refuse('split_entry_needs_exactly_one_of_share_bp_or_fixed_minor', e.party_role);
    }
    if (hasBpEntry) {
      const b = e.share_bp;
      if (typeof b !== 'number' || !isFinite(b) || b !== Math.floor(b) || b < 0 || b > 10000) {
        return refuse('share_bp_must_be_integer_0_to_10000', String(b));
      }
      hasBp = true;
      sumBp += b;
      shares.push({ party_role: e.party_role, basis: 'share_bp', share_bp: b, amount_minor: Math.floor(incomeMinor * b / 10000) });
    } else {
      const f = e.fixed_minor;
      if (typeof f !== 'number' || !isFinite(f) || f !== Math.floor(f) || f < 0) {
        return refuse('fixed_minor_must_be_nonnegative_integer', String(f));
      }
      sumFixed += f;
      shares.push({ party_role: e.party_role, basis: 'fixed_minor', amount_minor: f });
    }
  }
  const allocated = shares.reduce((s, x) => s + x.amount_minor, 0);
  // Conservation: floored shares must sum exactly to the recomputed income.
  const conserving = allocated === incomeMinor;
  // A bp-only split must name the full 10000 bp regardless of rounding residue.
  const bpFull = !hasBp || sumBp === 10000;

  // -- holder_rewards: 0..64 entries.
  const rewards = pp.holder_rewards;
  if (rewards === undefined || rewards === null) {
    return refuse('holder_rewards_must_be_present_use_empty_array', String(rewards));
  }
  if (!Array.isArray(rewards) || rewards.length > 64) {
    return refuse('holder_rewards_must_be_array_0_to_64', String(Array.isArray(rewards) ? rewards.length : typeof rewards));
  }
  const FUND_FROM = { reserve_income: true, distributor_margin: true, other: true };
  const COND_ON = { holding: true, activity: true, none: true };
  const trace = [];
  let issuerPaid = false;
  let issuerFunded = false;
  for (let i = 0; i < rewards.length; i++) {
    const r = rewards[i] || {};
    if (typeof r.payer_role !== 'string' || !ROLE_RE.test(r.payer_role)) {
      return refuse('reward_payer_role_must_be_snake_case', String(r.payer_role).slice(0, 40));
    }
    if (!FUND_FROM[r.funded_from]) {
      return refuse('reward_funded_from_must_be_enumerated', String(r.funded_from).slice(0, 40));
    }
    const v = r.value_minor;
    if (typeof v !== 'number' || !isFinite(v) || v !== Math.floor(v) || v < 0) {
      return refuse('reward_value_minor_must_be_nonnegative_integer', String(v));
    }
    if (!COND_ON[r.conditioned_on]) {
      return refuse('reward_conditioned_on_must_be_enumerated', String(r.conditioned_on).slice(0, 40));
    }
    const payerIsIssuer = r.payer_role === 'issuer';
    const fromIssuerFlow = r.funded_from === 'reserve_income';
    if (payerIsIssuer) issuerPaid = true;
    if (fromIssuerFlow && !payerIsIssuer) issuerFunded = true;
    trace.push({
      reward_index: i,
      payer_role: r.payer_role,
      funded_from: r.funded_from,
      value_minor: v,
      conditioned_on: r.conditioned_on,
      payer_is_issuer: payerIsIssuer,
      funded_by_issuer_flow: fromIssuerFlow,
      rule_ref: 'issuer_yield_prohibition',
    });
  }

  if (issuerPaid) flags.push('ISSUER_PAID_HOLDER_YIELD');
  if (issuerFunded) flags.push('REWARD_FUNDED_FROM_ISSUER_SHARE');
  if (!conserving || !bpFull) flags.push('SPLIT_NOT_CONSERVING');

  const verdict = issuerPaid ? 'ISSUER_YIELD_PRESENT' : (issuerFunded ? 'REVIEW' : 'NO_ISSUER_YIELD');

  return {
    output_payload: {
      profile: PROFILE,
      proposed: false,
      verdict,
      income: {
        basis: declaredIncomeMinor !== null ? 'declared_reserve_income_minor' : 'recomputed_from_yield_bp',
        period_days: days,
        avg_reserve_value_minor: declaredIncomeMinor !== null ? null : avg,
        reserve_yield_bp: declaredIncomeMinor !== null ? null : bp,
        declared_reserve_income_minor: declaredIncomeMinor,
        reserve_income_minor: incomeMinor,
        shares,
        allocated_share_sum_minor: allocated,
        conserving: conserving && bpFull,
      },
      holder_rewards_trace: trace,
      flags,
      limits: {
        states_facts_about_flows_only: true,
        no_lawfulness_opinion: true,
      },
      manual_review_required: verdict !== 'NO_ISSUER_YIELD' || flags.length > 0,
    },
    compliance_flags: flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
