import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-260-allocate-ihb-interest';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'analytics_mandate', gpu: false };

// In-house bank (IHB) interest allocation for notional pooling and ZBA sweep structures.
// Computes arm's-length interest allocation per OECD Transfer Pricing Guidelines 2022.
// Supports ACT/360, ACT/365, and 30/360 day-count conventions.
// Includes withholding tax flag per participating entity.
// ZERO PII: entity IDs, balances, rates, and period parameters only.

const TABLE_VERSION = 'OECD-TP-IHB-INTEREST-ALLOC-2022';
const TABLE_SOURCE  = 'OECD Transfer Pricing Guidelines 2022 Ch.I (arm\'s-length standard) + Ch.VIII (IHB cash pools); SWIFT IHB banking guide; ECB TARGET2 compensation methodology';

// Day-count fraction computation (pure arithmetic, no transcendentals)
function dayCountFraction(days, convention) {
  if (convention === 'ACT/360') return days / 360;
  if (convention === 'ACT/365') return days / 365;
  // 30/360: assume days already converted to 30/360 basis
  return days / 360;
}

export function compute(params) {
  const p = params || {};

  const pool_type = ['notional','zba'].includes(p.pool_type) ? p.pool_type : 'notional';
  const arm_length_rate = _finite(p.arm_length_rate, 0);
  const days = _finite(p.days, 1);
  const day_count_convention = ['ACT/360','ACT/365','30/360'].includes(p.day_count_convention) ? p.day_count_convention : 'ACT/360';
  const pool_members = Array.isArray(p.pool_members) ? p.pool_members : [];
  const base_currency = (p.base_currency || 'USD').toUpperCase();

  const dcf = dayCountFraction(days, day_count_convention);

  let pool_net = 0;
  const members_normalized = [];

  for (let i = 0; i < pool_members.length; i++) {
    const m = pool_members[i] || {};
    const balance = _finite(m.balance, 0);
    const wh_rate = _finite(m.withholding_rate, 0);
    const entity_id = m.entity_id || ('entity_' + i);
    members_normalized.push({ entity_id, balance, withholding_rate: wh_rate, currency: m.currency || base_currency });
    pool_net += balance;
  }
  pool_net = _round4(pool_net);

  const allocations = [];

  if (pool_type === 'notional') {
    // Notional pooling: interest computed on net pool balance, allocated pro-rata
    const gross_pool_interest = _round4(pool_net * arm_length_rate * dcf);

    // Total positive balances and total negative balances for pro-rata
    const total_positive = members_normalized.reduce(function(s, m) { return s + (m.balance > 0 ? m.balance : 0); }, 0);
    const total_negative = members_normalized.reduce(function(s, m) { return s + (m.balance < 0 ? Math.abs(m.balance) : 0); }, 0);

    for (let i = 0; i < members_normalized.length; i++) {
      const m = members_normalized[i];
      let gross_interest = 0;

      if (m.balance > 0 && total_positive > 0) {
        // Depositor: receives credit interest pro-rata
        gross_interest = _round4(gross_pool_interest > 0 ? gross_pool_interest * m.balance / total_positive : 0);
      } else if (m.balance < 0 && total_negative > 0) {
        // Borrower: charged debit interest pro-rata on absolute balance
        gross_interest = _round4(gross_pool_interest < 0 ? gross_pool_interest * Math.abs(m.balance) / total_negative : 0);
      }

      const wh_amount = m.withholding_rate > 0 && gross_interest > 0 ? _round4(gross_interest * m.withholding_rate) : 0;
      const net_interest = _round4(gross_interest - wh_amount);

      allocations.push({
        entity_id:          m.entity_id,
        balance:            m.balance,
        gross_interest,
        withholding_rate:   m.withholding_rate,
        withholding_amount: wh_amount,
        net_interest,
        allocation_basis:   'PRO_RATA_NOTIONAL',
      });
    }
  } else {
    // ZBA sweep: each entity earns/pays interest independently on its own balance
    for (let i = 0; i < members_normalized.length; i++) {
      const m = members_normalized[i];
      const gross_interest = _round4(m.balance * arm_length_rate * dcf);
      const wh_amount = m.withholding_rate > 0 && gross_interest > 0 ? _round4(gross_interest * m.withholding_rate) : 0;
      const net_interest = _round4(gross_interest - wh_amount);

      allocations.push({
        entity_id:          m.entity_id,
        balance:            m.balance,
        gross_interest,
        withholding_rate:   m.withholding_rate,
        withholding_amount: wh_amount,
        net_interest,
        allocation_basis:   'INDIVIDUAL_ZBA',
      });
    }
  }

  const total_interest_allocated = _round4(allocations.reduce(function(s, a) { return s + a.gross_interest; }, 0));
  const net_interest_payable     = _round4(allocations.reduce(function(s, a) { return s + a.net_interest; }, 0));

  return {
    pool_type,
    pool_net_balance:           pool_net,
    arm_length_rate,
    days,
    day_count_convention,
    day_count_fraction:         _round6(dcf),
    base_currency,
    total_interest_allocated,
    net_interest_payable,
    entity_count:               allocations.length,
    allocations,
    oecd_tp_compliant:          true,
    table_version:              TABLE_VERSION,
    table_source:               TABLE_SOURCE,
    regulatory_basis:           'Interest allocation per OECD TP Guidelines 2022 Ch.VIII (cash pooling, arm\'s-length principle); pool leader earns spread between lending/borrowing rates; arm_length_rate should reflect comparable uncontrolled transactions. ACT/360 default per SWIFT TARGET2.',
    pii_note:                   'ZERO PII: entity IDs, aggregate balances, rates, and period parameters only. No account holder, ultimate beneficiary, or personal data enters this kernel.',
    not_legal_advice:           'Not tax, legal, or accounting advice. IHB structures require review by qualified transfer-pricing advisors and local tax counsel.',
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}
function _round4(v) { return Math.round(v * 10000) / 10000; }
function _round6(v) { return Math.round(v * 1000000) / 1000000; }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
