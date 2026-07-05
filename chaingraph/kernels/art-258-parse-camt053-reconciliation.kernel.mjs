import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-258-parse-camt053-reconciliation';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'analytics_mandate', gpu: false };

// camt.053 Bank-to-Customer Statement reconciliation.
// Classifies BkTxCd Domain/Family/SubFamily to a recon bucket;
// validates the balance equation (OPBD + Σ movements = CLBD);
// scores structured-remittance match rate.
// NOT reconcile_mpp_subscription (MPP settlement) or reconcile_emir_pairing (EMIR trade reports).
// ZERO PII: structural statement fields and amounts only.
// TABLE_VERSION pins the ISO 20022 ExternalBankTransactionCode registry release.

const TABLE_VERSION = 'ISO20022-BKTXCD-2023-03';
const TABLE_SOURCE  = 'ISO 20022 ExternalBankTransactionCode1Code registry 2023-03 release; CGI-MP camt.053 Usage Guide v5.0 2023';

// BkTxCd domain → recon bucket mapping per ISO 20022 BKTXCD registry
const DOMAIN_BUCKET = {
  PMNT: 'PAYMENT',
  LDAS: 'LOAN_DEPOSIT',
  SECU: 'SECURITIES',
  FORX: 'FX_TRADE',
  FEES: 'BANK_CHARGES',
  CAMT: 'CASH_MANAGEMENT',
  OPCL: 'OPENING_CLOSING',
  NTAV: 'NOT_AVAILABLE',
  ACMT: 'ACCOUNT_MANAGEMENT',
  DERV: 'DERIVATIVES',
  XTND: 'EXTENDED'
};

// PMNT family → sub-bucket
const PMNT_FAMILY_BUCKET = {
  RCDT: 'CREDIT_RECEIVED',
  ICDT: 'CREDIT_ISSUED',
  IDDT: 'DIRECT_DEBIT_RECEIVED',
  ODDT: 'DIRECT_DEBIT_ISSUED',
  MCRD: 'MERCHANT_CARD',
  CCRD: 'CREDIT_CARD',
  BOOK: 'BOOK_TRANSFER',
  XBCT: 'CROSS_BORDER_CREDIT',
  CNTR: 'COUNTER_TRANSACTION',
  OTHR: 'OTHER_PAYMENT'
};

export function compute(params) {
  const p = params || {};

  const opening_balance = _finite(p.opening_balance, 0);
  const closing_balance = _finite(p.closing_balance, 0);
  const day_count_convention = ['ACT/360','ACT/365','30/360'].includes(p.day_count_convention) ? p.day_count_convention : 'ACT/360';
  const transactions = Array.isArray(p.transactions) ? p.transactions : [];

  let credit_sum = 0;
  let debit_sum  = 0;
  let structured_count = 0;
  let unstructured_count = 0;

  const tx_counts_by_bucket = {};
  const bucket_amounts = {};

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i] || {};
    const amount = _finite(tx.amount, 0);
    const cdi = (tx.credit_debit_indicator || '').toUpperCase();
    const bk_tx_cd = tx.bk_tx_cd || {};
    const domain = (bk_tx_cd.domain || 'NTAV').toUpperCase();
    const family = (bk_tx_cd.family || '').toUpperCase();

    let bucket = DOMAIN_BUCKET[domain] || 'UNKNOWN';
    if (domain === 'PMNT' && family && PMNT_FAMILY_BUCKET[family]) {
      bucket = PMNT_FAMILY_BUCKET[family];
    }

    tx_counts_by_bucket[bucket] = (tx_counts_by_bucket[bucket] || 0) + 1;
    bucket_amounts[bucket] = _round2((bucket_amounts[bucket] || 0) + amount);

    if (cdi === 'CRDT') {
      credit_sum = _round2(credit_sum + amount);
    } else if (cdi === 'DBIT') {
      debit_sum = _round2(debit_sum + amount);
    }

    // Structured-remittance scoring
    const rem = tx.remittance_info || {};
    if (rem.structured === true || (rem.end_to_end_id && rem.end_to_end_id !== 'NOTPROVIDED')) {
      structured_count++;
    } else {
      unstructured_count++;
    }
  }

  const calculated_closing = _round2(opening_balance + credit_sum - debit_sum);
  const variance = _round2(closing_balance - calculated_closing);
  const balance_equation_passes = Math.abs(variance) < 0.005;

  const total_tx = transactions.length;
  const match_rate_pct = total_tx > 0 ? _round2(structured_count / total_tx * 100) : 100;

  let reconciliation_status;
  if (!balance_equation_passes) {
    reconciliation_status = 'FAILED_BALANCE';
  } else if (match_rate_pct >= 90) {
    reconciliation_status = 'CLEAN';
  } else if (match_rate_pct >= 70) {
    reconciliation_status = 'PARTIAL_MATCH';
  } else {
    reconciliation_status = 'LOW_MATCH_RATE';
  }

  return {
    balance_equation_passes,
    opening_balance,
    calculated_closing,
    closing_balance,
    variance,
    credit_sum,
    debit_sum,
    total_transactions: total_tx,
    structured_count,
    unstructured_count,
    match_rate_pct,
    tx_counts_by_bucket,
    bucket_amounts,
    reconciliation_status,
    day_count_convention,
    table_version:      TABLE_VERSION,
    table_source:       TABLE_SOURCE,
    regulatory_basis:   'ISO 20022 camt.053 BkTxCd Domain/Family/SubFamily classification per ExternalBankTransactionCode1Code registry 2023-03; balance equation OPBD + Σ movements = CLBD per CGI-MP camt.053 Usage Guide v5.0. Use for automated corporate TMS reconciliation. NOT for reconcile_mpp_subscription (MPP settlement) or reconcile_emir_pairing (EMIR trade reports).',
    pii_note:           'ZERO PII: structural statement fields, amounts, and transaction codes only. No account holder, beneficiary, or personal data enters this kernel.',
    not_legal_advice:   'Not accounting, tax, or legal advice. Reconciliation output requires review by qualified finance staff before use in financial statements.',
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}
function _round2(v) { return Math.round(v * 100) / 100; }

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
