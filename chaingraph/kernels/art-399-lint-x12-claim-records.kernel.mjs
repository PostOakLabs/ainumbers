import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-399-lint-x12-claim-records';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_x12_claim_records',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Lints X12 837 (health-care claim) / 835 (health-care claim payment/remittance
// advice) ENVELOPE and BALANCING structure only. FORMAT-ONLY, structurally
// PHI-IMPOSSIBLE: the schema below defines no patient name/DOB/diagnosis fields
// at all -- only envelope control numbers, claim/payment identifiers, and
// monetary amounts. This is distinct from the HIPAA-Security WATCH row (informal
// cross-reference only; does not trigger it).
//
// SUBSET NOTE: the X12 837/835 implementation guides are licensed documents --
// this kernel derives its rule set from PUBLIC CMS companion-guide summaries and
// the publicly documented envelope/balancing structure only.
// table_version: "X12-837-835-ENVELOPE-BALANCE-PUBLIC-SUBSET-V1"

const TABLE_VERSION = 'X12-837-835-ENVELOPE-BALANCE-PUBLIC-SUBSET-V1';
const TABLE_SOURCE = 'CMS X12 837/835 Companion Guide public summaries (cms.gov); ASC X12 005010 envelope structure (public control-number continuity rules: ISA13/IEA02, GS06/GE02, ST02/SE02).';
const SUBSET_COVERAGE_STATEMENT = 'This lints X12 837/835 ENVELOPE structure and 835 payment balancing only, from public CMS companion-guide summaries. It does not implement the full licensed X12 implementation guide, and defines no clinical/PHI fields whatsoever.';
const BALANCE_TOLERANCE = 0.01;

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function safeArr(v) { return Array.isArray(v) ? v : []; }

function lintEnvelope(env) {
  env = env || {};
  const isa13 = safeStr(env.isa13), iea02 = safeStr(env.iea02);
  const gs06 = safeStr(env.gs06), ge02 = safeStr(env.ge02);
  const st02 = safeStr(env.st02), se02 = safeStr(env.se02);
  const issues = [];

  if (!isa13 || !iea02) issues.push({ code: 'INTERCHANGE_CONTROL_NUMBER_MISSING', severity: 'ERROR', field: 'isa13/iea02', message: 'Interchange control number (ISA13) or trailer (IEA02) missing.' });
  else if (isa13 !== iea02) issues.push({ code: 'INTERCHANGE_CONTROL_MISMATCH', severity: 'ERROR', field: 'isa13/iea02', message: 'ISA13 (' + isa13 + ') does not match IEA02 (' + iea02 + ') -- interchange control-number continuity broken.' });

  if (!gs06 || !ge02) issues.push({ code: 'GROUP_CONTROL_NUMBER_MISSING', severity: 'ERROR', field: 'gs06/ge02', message: 'Group control number (GS06) or trailer (GE02) missing.' });
  else if (gs06 !== ge02) issues.push({ code: 'GROUP_CONTROL_MISMATCH', severity: 'ERROR', field: 'gs06/ge02', message: 'GS06 (' + gs06 + ') does not match GE02 (' + ge02 + ') -- group control-number continuity broken.' });

  if (!st02 || !se02) issues.push({ code: 'TRANSACTION_CONTROL_NUMBER_MISSING', severity: 'ERROR', field: 'st02/se02', message: 'Transaction set control number (ST02) or trailer (SE02) missing.' });
  else if (st02 !== se02) issues.push({ code: 'TRANSACTION_CONTROL_MISMATCH', severity: 'ERROR', field: 'st02/se02', message: 'ST02 (' + st02 + ') does not match SE02 (' + se02 + ') -- transaction control-number continuity broken.' });

  return issues;
}

function lint837(pp, issues) {
  const claims = safeArr(pp.claims);
  if (claims.length === 0) {
    issues.push({ code: 'NO_CLAIMS_PRESENT', severity: 'ERROR', field: 'claims', message: '837 transaction contains no claim loops.' });
    return { claim_count: 0, total_charge_amount: 0 };
  }
  let total_charge_amount = 0;
  claims.forEach((c, i) => {
    const claim_id = safeStr(c && c.claim_id);
    const charge = safeNum(c && c.charge_amount);
    if (!claim_id) issues.push({ code: 'CLAIM_ID_ABSENT', severity: 'ERROR', field: 'claims[' + i + '].claim_id', message: 'Claim ' + i + ' missing claim_id (CLM01).' });
    if (charge === null || charge < 0) issues.push({ code: 'CHARGE_AMOUNT_INVALID', severity: 'ERROR', field: 'claims[' + i + '].charge_amount', message: 'Claim ' + i + ' charge_amount (CLM02) absent, non-numeric, or negative.' });
    else total_charge_amount += charge;
  });
  return { claim_count: claims.length, total_charge_amount: +total_charge_amount.toFixed(2) };
}

function lint835(pp, issues) {
  const remittance = pp.remittance || {};
  const total_paid_amount = safeNum(remittance.total_paid_amount);
  const claim_payments = safeArr(remittance.claim_payments);

  if (total_paid_amount === null) issues.push({ code: 'TOTAL_PAID_AMOUNT_ABSENT', severity: 'ERROR', field: 'remittance.total_paid_amount', message: 'Remittance total paid amount (BPR02) absent or non-numeric.' });
  if (claim_payments.length === 0) issues.push({ code: 'NO_CLAIM_PAYMENTS_PRESENT', severity: 'ERROR', field: 'remittance.claim_payments', message: '835 transaction contains no claim-payment (CLP) loops.' });

  let sum_claim_payments = 0;
  claim_payments.forEach((c, i) => {
    const claim_id = safeStr(c && c.claim_id);
    const paid = safeNum(c && c.paid_amount);
    if (!claim_id) issues.push({ code: 'CLAIM_ID_ABSENT', severity: 'ERROR', field: 'remittance.claim_payments[' + i + '].claim_id', message: 'Claim payment ' + i + ' missing claim_id (CLP01).' });
    if (paid === null || paid < 0) issues.push({ code: 'PAID_AMOUNT_INVALID', severity: 'ERROR', field: 'remittance.claim_payments[' + i + '].paid_amount', message: 'Claim payment ' + i + ' paid_amount (CLP04) absent, non-numeric, or negative.' });
    else sum_claim_payments += paid;
  });
  sum_claim_payments = +sum_claim_payments.toFixed(2);

  let balances = null;
  if (total_paid_amount !== null && claim_payments.length > 0) {
    balances = Math.abs(total_paid_amount - sum_claim_payments) <= BALANCE_TOLERANCE;
    if (!balances) {
      issues.push({ code: 'REMITTANCE_BALANCE_MISMATCH', severity: 'ERROR', field: 'remittance', message: 'Remittance total_paid_amount (' + total_paid_amount + ') does not equal sum of claim_payments (' + sum_claim_payments + ').' });
    }
  }

  return { total_paid_amount, sum_claim_payments, claim_payment_count: claim_payments.length, balances };
}

export function compute(pp) {
  pp = pp || {};
  const message_type = safeStr(pp.message_type) === '835' ? '835' : '837';
  const issues = lintEnvelope(pp.envelope);

  let type_result;
  if (message_type === '837') type_result = lint837(pp, issues);
  else type_result = lint835(pp, issues);

  const error_count = issues.filter((i) => i.severity === 'ERROR').length;
  const warning_count = issues.filter((i) => i.severity === 'WARNING').length;
  const compliant = error_count === 0;

  const output_payload = {
    message_type,
    compliant,
    error_count,
    warning_count,
    ...type_result,
    issues,
    disambiguation: 'lint_x12_claim_records checks X12 837/835 ENVELOPE control-number continuity and, for 835, payment-amount balancing (arithmetic only) -- a FORMAT-ONLY validator over identifiers and amounts, never claim content.',
    phi_note: 'This schema is structurally PHI-IMPOSSIBLE: it defines only envelope control numbers, claim/payment identifiers, and monetary amounts -- no patient name, DOB, diagnosis, or any clinical field exists in the input or output. See the HIPAA-Security WATCH row for the separate, un-triggered security-rule surface.',
    subset_coverage_statement: SUBSET_COVERAGE_STATEMENT,
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'ASC X12 005010 837/835 transaction sets; CMS companion-guide public summaries; HIPAA Administrative Simplification transaction-standard rule (45 CFR Part 162).',
  };

  const compliance_flags = [];
  if (!compliant) compliance_flags.push('X12_ENVELOPE_OR_BALANCE_NON_COMPLIANT');
  if (message_type === '835' && type_result.balances === false) compliance_flags.push('X12_835_BALANCE_MISMATCH');

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
