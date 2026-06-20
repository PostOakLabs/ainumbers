/**
 * art-57-deposit-token-compliance-validator.kernel.mjs
 * Wave 13 — Tokenized Deposit / Deposit-Token Compliance Validator (W-B).
 * Validates a deposit token against the tests that distinguish it from a stablecoin
 * or e-money token: at-par redemption, on-balance-sheet liability, holder eligibility.
 * Answers: "is this token my bank's redeemable deposit, or is it a reserve-backed instrument?"
 * Key: a deposit token is a BANK LIABILITY, not reserve-backed e-money.
 * Pure decision kernel — no DOM, no window, no Date.now().
 * Citations (verify against current primary sources):
 *   US deposit law (commercial bank liability, not a security/e-money);
 *   MiCA EMT (Art. 48 et seq.) for the EU contrast;
 *   UK Finance RLN tokenised-deposit model;
 *   BIS "singleness of money" / Project Agorá.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-57-deposit-token-compliance-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'validate_deposit_token_compliance',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// Test 1: At-par redemption (MUST for deposit token)
function testRedemption(redemption_basis) {
  if (redemption_basis === 'at-par-on-demand') return { result: 'PASS', note: 'Redeemable at par on demand — consistent with deposit token (bank liability).' };
  if (redemption_basis === 'NAV') return { result: 'FAIL', note: 'NAV-based redemption is characteristic of a money market fund, not a deposit.' };
  if (redemption_basis === 'market') return { result: 'FAIL', note: 'Market-price redemption is characteristic of a security or asset-backed token, not a deposit.' };
  return { result: 'UNCLEAR', note: 'Redemption basis is unclear — verify with issuer legal counsel.' };
}

// Test 2: On-balance-sheet liability
function testLiability(liability_treatment) {
  if (liability_treatment === 'on-balance-sheet-deposit') return { result: 'PASS', note: 'On-balance-sheet deposit liability — consistent with a commercial bank deposit token.' };
  if (liability_treatment === 'segregated-reserve') return { result: 'FAIL', note: 'Segregated-reserve structure is characteristic of a reserve-backed stablecoin (e.g. MiCA EMT), not a bank deposit.' };
  if (liability_treatment === 'bankruptcy-remote-trust') return { result: 'FAIL', note: 'Bankruptcy-remote trust structure indicates an e-money token, not a deposit.' };
  return { result: 'UNCLEAR', note: 'Liability treatment unclear — verify issuer balance-sheet classification.' };
}

// Test 3: Holder eligibility (deposit tokens are typically allowlisted wholesale)
function testEligibility(holder_eligibility) {
  if (holder_eligibility === 'allowlisted-wholesale') return { result: 'PASS', note: 'Allowlisted wholesale holders — consistent with bank deposit token (RLN / JPMD model).' };
  if (holder_eligibility === 'KYC-retail') return { result: 'PARTIAL', note: 'Retail holders — possible under some models (e.g. future RLN retail tranche) but increases regulatory complexity.' };
  return { result: 'FAIL', note: 'Open / unrestricted holders — not consistent with a bank deposit token; assess as e-money token or stablecoin.' };
}

const REGIME_MAP = {
  US:  { label: 'US', note: 'A tokenized deposit is a bank liability under US deposit law. Not a security (no UCC Art.8 treatment) or e-money. FDIC insurance may apply per standard deposit rules. Verify with OCC/Fed/FDIC current guidance.' },
  UK:  { label: 'UK', note: 'UK RLN tokenised-sterling-deposit model (UK Finance 2025 pilot). Deposit sits on issuing bank balance sheet. Governed by PRA/FCA. FCA e-money regime does not apply to on-balance-sheet deposits. Verify with current BoE/FCA/PRA guidance.' },
  EU:  { label: 'EU', note: 'EU: deposit tokens are NOT e-money tokens under MiCA (MiCA Art. 2(6) carves out deposits held with credit institutions). Deposits remain under CRD/BRRD. An issuer tokenizing deposits does not need a MiCA EMT licence if the token represents a deposit liability. Verify with current EBA/ECB guidance.' },
  other: { label: 'Other', note: 'Verify applicable central-bank, deposit-insurance, and e-money/stablecoin legislation in this jurisdiction.' },
};

function classifyToken(token_class, redemption_result, liability_result) {
  if (token_class === 'commercial-bank-deposit-token' && redemption_result === 'PASS' && liability_result === 'PASS')
    return 'DEPOSIT_TOKEN_CONFIRMED';
  if (token_class === 'central-bank-money-token')
    return 'CBM_TOKEN';
  if (token_class === 'emt-stablecoin' || token_class === 'e-money-token')
    return 'EMT_STABLECOIN';
  if (liability_result === 'FAIL' || redemption_result === 'FAIL')
    return 'DEPOSIT_TOKEN_MISCLASSIFIED';
  return 'CLASSIFICATION_UNCLEAR';
}

export function compute(pp) {
  const {
    token_class        = 'unclear',
    issuer_type        = 'non-bank',
    redemption_basis   = 'unclear',
    liability_treatment= 'segregated-reserve',
    holder_eligibility = 'open',
    deposit_insurance  = 'none',
    jurisdiction       = 'other',
    governing_law      = '',
    interoperability   = 'single-issuer-closed',
  } = pp;

  const test_results = {
    redemption:  testRedemption(redemption_basis),
    liability:   testLiability(liability_treatment),
    eligibility: testEligibility(holder_eligibility),
  };

  // Insurance
  const insurance_result = (deposit_insurance === 'FDIC-eligible' || deposit_insurance === 'FSCS')
    ? { result: 'PASS', note: 'Deposit insurance coverage present.' }
    : { result: 'INFO', note: 'No deposit insurance — verify regulatory treatment and investor disclosure.' };
  test_results.insurance = insurance_result;

  // Classification
  const classification = classifyToken(token_class, test_results.redemption.result, test_results.liability.result);

  // Grade
  const passCount = Object.values(test_results).filter(t => t.result === 'PASS').length;
  const classification_grade =
    passCount === 4 ? 'A' :
    passCount === 3 ? 'B' :
    passCount === 2 ? 'C' :
    passCount === 1 ? 'D' : 'F';

  const regime = REGIME_MAP[jurisdiction] ?? REGIME_MAP.other;

  const remediation_checklist = [];
  if (test_results.redemption.result !== 'PASS')
    remediation_checklist.push({ test: 'redemption', issue: test_results.redemption.note, action: 'Confirm at-par-on-demand redemption with issuer legal counsel.' });
  if (test_results.liability.result !== 'PASS')
    remediation_checklist.push({ test: 'liability', issue: test_results.liability.note, action: 'Confirm on-balance-sheet classification with issuer. If segregated-reserve: token is a stablecoin/EMT, not a deposit.' });
  if (test_results.eligibility.result !== 'PASS')
    remediation_checklist.push({ test: 'eligibility', issue: test_results.eligibility.note, action: 'Restrict token holders to allowlisted wholesale counterparties or recategorise as EMT.' });

  const capital_accounting_note = classification === 'DEPOSIT_TOKEN_CONFIRMED'
    ? 'On-balance-sheet deposit liability — bank risk-weights apply. Not a security; not subject to MiCA. Capital treatment follows CRD/BRRD for EU issuers; standard deposit capital rules for US/UK.'
    : 'Classification unclear or misidentified — capital and accounting treatment depends on reclassification result. Stablecoin/EMT = MiCA Art. 48+ regime (EU) or GENIUS Act (US). Verify with current guidance.';

  const output_payload = {
    token_class,
    classification,
    classification_grade,
    test_results,
    applicable_regime: regime.label + ': ' + regime.note,
    capital_accounting_note,
    remediation_checklist,
    status_asof: '2026-06-20 — verify US deposit law, MiCA EMT Arts. 48+, UK RLN model, and FDIC/FCA/EBA guidance against current primary sources',
    note: 'Educational deposit-token compliance validator. A deposit token is a bank liability, NOT a reserve-backed e-money instrument. Distinct from Wave 8 Canton tokenized-asset layer and from Tempo/Arc stablecoin tools. Not legal, capital, or accounting advice.',
  };

  const compliance_flags = [];
  if (test_results.redemption.result !== 'PASS') compliance_flags.push('NOT_AT_PAR_REDEEMABLE');
  if (classification === 'DEPOSIT_TOKEN_MISCLASSIFIED') compliance_flags.push('DEPOSIT_TOKEN_MISCLASSIFIED_AS_STABLECOIN');
  if (test_results.eligibility.result === 'FAIL') compliance_flags.push('HOLDER_ELIGIBILITY_OPEN');
  if (issuer_type === 'non-bank') compliance_flags.push('NON_BANK_ISSUER_DEPOSIT_TOKEN_RISK');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
