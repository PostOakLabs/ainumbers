/**
 * art-08-en16931-einvoice-batch-validator.kernel.mjs
 * EN 16931 e-Invoice Batch Validator — LCG PRNG, synthetic invoice generation + rule validation.
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'art-08-en16931-einvoice-batch-validator',
  mcp_name:     'validate_einvoice_batch',
  mandate_type: 'compliance_mandate',
  version:      '1.0.0',
};

const TOOL_ID = 'art-08-en16931-einvoice-batch-validator';
const TOOL_VERSION = '1.0.0';

// ── LCG (matches source HTML) ─────────────────────────────────────────────────
function makeLCG(seed) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

// ── Static tables ─────────────────────────────────────────────────────────────
const PROFILES = ['B2B', 'B2G', 'B2C'];
const VAT_CATS  = ['S', 'Z', 'E', 'AE', 'O'];
const TYPE_CODES = ['380', '381', '384', '389', '393'];
const CURRENCIES = ['EUR', 'GBP', 'USD', 'CHF', 'SEK'];
const COUNTRIES  = ['DE', 'FR', 'IT', 'ES', 'NL', 'PL', 'SE', 'GB', 'AT', 'BE'];

// ── Invoice generator ─────────────────────────────────────────────────────────
function generateInvoice(idx, profile, errorRate, strictness, rand) {
  const invoiceId   = `INV-${String(idx + 1).padStart(5, '0')}`;
  const typeCode    = TYPE_CODES[Math.floor(rand() * TYPE_CODES.length)];
  const currency    = CURRENCIES[Math.floor(rand() * CURRENCIES.length)];
  const vatCat      = VAT_CATS[Math.floor(rand() * VAT_CATS.length)];
  const country     = COUNTRIES[Math.floor(rand() * COUNTRIES.length)];
  const lineCount   = 1 + Math.floor(rand() * 10);
  const totalAmount = +(rand() * 50000 + 50).toFixed(2);
  const vatAmount   = vatCat === 'S' ? +(totalAmount * 0.20).toFixed(2) : 0;

  // Inject errors based on errorRate
  const hasMissingBT1  = rand() < errorRate;            // BT-1: invoice number
  const hasMissingBT2  = rand() < errorRate * 0.5;     // BT-2: issue date
  const hasMissingBT9  = rand() < errorRate * 0.7;     // BT-9: due date
  const hasInvalidVat  = rand() < errorRate * 0.6;     // BT-151: VAT category
  const hasInvalidLine = rand() < errorRate * 0.4;     // BR-25: line item
  const hasMissingBT50 = profile === 'B2G' && rand() < errorRate * 0.8; // BT-50: buyer ref (B2G only)

  return {
    invoiceId, typeCode, currency, vatCat, country, lineCount,
    totalAmount, vatAmount,
    hasMissingBT1, hasMissingBT2, hasMissingBT9,
    hasInvalidVat, hasInvalidLine, hasMissingBT50,
    profile,
  };
}

// ── Validator ─────────────────────────────────────────────────────────────────
function validateInvoice(inv, strictness) {
  const failures = [];

  if (inv.hasMissingBT1)  failures.push('BR-1: BT-1 Invoice number missing');
  if (inv.hasMissingBT2)  failures.push('BR-2: BT-2 Issue date missing');
  if (inv.hasMissingBT9 && strictness !== 'lenient') failures.push('BR-14: BT-9 Due date missing');
  if (inv.hasInvalidVat)  failures.push('BR-36: BT-151 VAT category code invalid');
  if (inv.hasInvalidLine) failures.push('BR-25: BT-129 Line item quantity invalid');
  if (inv.hasMissingBT50 && inv.profile === 'B2G') failures.push('BR-53: BT-50 Buyer reference required for B2G');

  // Strictness: in 'strict' mode, enforce additional EN 16931 rules
  if (strictness === 'strict') {
    if (!CURRENCIES.includes(inv.currency)) failures.push('BR-5: BT-5 Currency code invalid');
    if (!TYPE_CODES.includes(inv.typeCode)) failures.push('BR-55: BT-3 Invoice type code invalid');
  }

  return { passed: failures.length === 0, failures };
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const seed         = pp.seed         ?? 42;
  const n_invoices   = Math.min(Math.max(pp.n_invoices   ?? 200, 10), 2000);
  const error_rate   = pp.error_rate   ?? 0.15;   // fraction of invoices with deliberate errors
  const strictness   = pp.strictness   ?? 'standard';  // 'lenient' | 'standard' | 'strict'
  const profile      = pp.profile      ?? 'B2B';       // 'B2B' | 'B2G' | 'B2C'

  const rand = makeLCG(seed);
  let passCount = 0, failCount = 0;
  const ruleFailureCounts = {};

  for (let i = 0; i < n_invoices; i++) {
    const inv    = generateInvoice(i, profile, error_rate, strictness, rand);
    const result = validateInvoice(inv, strictness);
    if (result.passed) {
      passCount++;
    } else {
      failCount++;
      result.failures.forEach(f => {
        ruleFailureCounts[f] = (ruleFailureCounts[f] ?? 0) + 1;
      });
    }
  }

  const compliance_rate_pct = +(passCount / n_invoices * 100).toFixed(2);
  // Deadline readiness: score 0-100 where 100 = fully ready
  const deadline_readiness_score = Math.max(0, Math.min(100,
    Math.round(compliance_rate_pct - (error_rate * 100 * 0.5))
  ));

  // Top 5 failure rules
  const top_failure_rules = Object.entries(ruleFailureCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([rule, count]) => ({ rule, count }));

  const compliance_flags = [];
  if (compliance_rate_pct >= 95) compliance_flags.push('EN16931_COMPLIANT');
  else if (compliance_rate_pct >= 80) compliance_flags.push('EN16931_PARTIAL_COMPLIANCE');
  else compliance_flags.push('EN16931_NON_COMPLIANT');
  if (deadline_readiness_score >= 80) compliance_flags.push('ERECEIPT_DEADLINE_READY');
  else compliance_flags.push('ERECEIPT_DEADLINE_AT_RISK');

  return {
    verdict:                 compliance_rate_pct >= 95 ? 'COMPLIANT' : compliance_rate_pct >= 80 ? 'PARTIAL' : 'NON_COMPLIANT',
    total_invoices:          n_invoices,
    pass_count:              passCount,
    fail_count:              failCount,
    compliance_rate_pct,
    deadline_readiness_score,
    top_failure_rules,
    rule_failure_counts:     ruleFailureCounts,
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const result = compute(pp);
  const { compliance_flags = {} } = result;
  const output_payload = result;
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
