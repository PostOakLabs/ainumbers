/**
 * art-38-tempo-onchain-aml.kernel.mjs
 * Tempo On-Chain AML & Travel Rule Screener — batch TIP-20 transfer classifier.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

export const meta = {
  tool_id:      'art-38-tempo-onchain-aml',
  mcp_name:     'screen_tip20_transfer_batch',
  mandate_type: 'aml_rule',
  version:      '1.0.0',
};

// OFAC test SDN names (case-insensitive substring match)
const OFAC_SDN_NAMES = ['SANCTIONED ENTITY', 'OFAC_TEST_SDN', 'BLOCKED_PARTY'];

// Default thresholds (USD)
const DEFAULT_TR_THRESHOLD  = 3_000;
const DEFAULT_SAR_THRESHOLD = 5_000;

// Travel Rule required fields
const TR_REQUIRED_FIELDS = [
  'originator_name',
  'originator_vasp',
  'beneficiary_name',
  'beneficiary_vasp',
];

function isBlankOrUnknown(val) {
  if (!val) return true;
  const v = String(val).trim().toUpperCase();
  return v === '' || v === 'UNKNOWN' || v === 'N/A';
}

function screenTransfer(tx, trThreshold, sarThreshold) {
  const amount = Number(tx.amount_usd) || 0;
  const flags  = [];

  // --- OFAC screening ---
  const parties = [tx.originator_name, tx.beneficiary_name].map(n => (n || '').toUpperCase());
  const ofacHit = OFAC_SDN_NAMES.some(sdn => parties.some(p => p.includes(sdn)));

  // --- Travel Rule ---
  let travelRuleStatus = 'NOT_REQUIRED';
  if (amount >= trThreshold) {
    const missingFields = TR_REQUIRED_FIELDS.filter(f => !tx[f] || String(tx[f]).trim() === '');
    if (missingFields.length > 0) {
      travelRuleStatus = 'INCOMPLETE';
      flags.push('TRAVEL_RULE_INCOMPLETE');
    } else {
      travelRuleStatus = 'COMPLETE';
    }
  }

  // --- AML typology flags ---
  if (amount >= 9_000 && amount < 10_000) {
    flags.push('STRUCTURING_INDICATOR');
  }
  if (!tx.memo && amount >= 5_000) {
    flags.push('UNUSUAL_TRANSACTION');
  }
  if (isBlankOrUnknown(tx.originator_name) || isBlankOrUnknown(tx.beneficiary_name)) {
    flags.push('MISSING_IDENTITY');
  }
  if (tx.mode === 'edd' && !tx.memo) {
    flags.push('EDD_NO_MEMO');
  }

  // --- SAR determination ---
  let sarDetermination;
  if (ofacHit) {
    sarDetermination = 'SAR_REQUIRED';
  } else if (
    amount >= sarThreshold &&
    (flags.includes('STRUCTURING_INDICATOR') || flags.includes('MISSING_IDENTITY'))
  ) {
    sarDetermination = 'SAR_RECOMMENDED';
  } else {
    sarDetermination = 'NOT_REQUIRED';
  }

  // --- Overall verdict ---
  let verdict;
  if (ofacHit || sarDetermination === 'SAR_REQUIRED') {
    verdict = 'ESCALATE';
  } else if (flags.length > 0) {
    verdict = 'FLAG';
  } else {
    verdict = 'PASS';
  }

  return {
    tx_ref:             tx.tx_ref ?? null,
    amount_usd:         amount,
    verdict,
    ofac_hit:           ofacHit,
    travel_rule_status: travelRuleStatus,
    sar_determination:  sarDetermination,
    flags,
  };
}

export function compute(pp) {
  // pp: { transfers: Array<tx>, tr_threshold?, sar_threshold? }
  const trThreshold  = Number(pp.tr_threshold)  || DEFAULT_TR_THRESHOLD;
  const sarThreshold = Number(pp.sar_threshold) || DEFAULT_SAR_THRESHOLD;

  const transfers = Array.isArray(pp.transfers) ? pp.transfers : [];

  const results = transfers.map(tx => screenTransfer(tx, trThreshold, sarThreshold));

  const escalateCount = results.filter(r => r.verdict === 'ESCALATE').length;
  const flagCount     = results.filter(r => r.verdict === 'FLAG').length;
  const passCount     = results.filter(r => r.verdict === 'PASS').length;

  const batchVerdict = escalateCount > 0 ? 'ESCALATE'
    : flagCount > 0 ? 'FLAG'
    : 'PASS';

  const compliance_flags = [];
  if (escalateCount > 0) compliance_flags.push('BATCH_HAS_ESCALATIONS');
  if (flagCount > 0)     compliance_flags.push('BATCH_HAS_FLAGS');
  if (batchVerdict === 'PASS') compliance_flags.push('BATCH_CLEAN');

  return {
    batch_verdict:    batchVerdict,
    total:            results.length,
    escalate_count:   escalateCount,
    flag_count:       flagCount,
    pass_count:       passCount,
    tr_threshold_usd: trThreshold,
    sar_threshold_usd: sarThreshold,
    results,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:      meta.tool_id,
    mandate_type: meta.mandate_type,
    ...r,
    inputs: {
      tr_threshold:  pp.tr_threshold  ?? DEFAULT_TR_THRESHOLD,
      sar_threshold: pp.sar_threshold ?? DEFAULT_SAR_THRESHOLD,
      transfer_count: (pp.transfers ?? []).length,
    },
  };
}
