// art-12 — ACP Checkout Conformance Validator: pure decision kernel.
// Faithful port of validateAcpCheckout() in
//   repo/chaingraph/art-12-acp-checkout-conformance-validator.html
// Pure: no DOM, no window, no network.
// policy_parameters carries the full payload so the execution_hash anchors the complete input.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-12-acp-checkout-conformance-validator';
const TOOL_VERSION = '1.0.0';

const REQ_FIELDS_REQUEST = [
  { key: 'message_type', rule: 'eq:CheckoutRequest', code: 'ACP-R01', label: 'message_type = "CheckoutRequest"' },
  { key: 'request_id',   rule: 'nonempty_string',    code: 'ACP-R02', label: 'request_id present and non-empty' },
  { key: 'merchant_id',  rule: 'nonempty_string',    code: 'ACP-R03', label: 'merchant_id present and non-empty' },
  { key: 'agent_id',     rule: 'nonempty_string',    code: 'ACP-R04', label: 'agent_id present (agentic commerce identifier)' },
  { key: 'amount',       rule: 'positive_number',    code: 'ACP-R05', label: 'amount positive number' },
  { key: 'currency',     rule: 'iso4217',            code: 'ACP-R06', label: 'currency valid ISO 4217 code' },
  { key: 'items',        rule: 'nonempty_array',     code: 'ACP-R07', label: 'items non-empty array' },
  { key: 'timestamp',    rule: 'iso8601',            code: 'ACP-R08', label: 'timestamp ISO 8601 / Unix ms' },
  { key: 'redirect_url', rule: 'https_url',          code: 'ACP-R09', label: 'redirect_url HTTPS URL' },
  { key: 'signature',    rule: 'nonempty_string',    code: 'ACP-R10', label: 'signature field present (request signing)' },
];

const REQ_FIELDS_RESPONSE = [
  { key: 'message_type',        rule: 'eq:CheckoutResponse', code: 'ACP-S01', label: 'message_type = "CheckoutResponse"' },
  { key: 'request_id',          rule: 'nonempty_string',     code: 'ACP-S02', label: 'request_id echoes originating request' },
  { key: 'status',              rule: 'acp_status',          code: 'ACP-S03', label: 'status ∈ {approved, declined, pending, error}' },
  { key: 'shared_payment_token',rule: 'spt_object',          code: 'ACP-S04', label: 'shared_payment_token (SPT) object present' },
  { key: 'merchant_id',         rule: 'nonempty_string',     code: 'ACP-S05', label: 'merchant_id matches request' },
  { key: 'amount_charged',      rule: 'positive_number',     code: 'ACP-S06', label: 'amount_charged positive number' },
  { key: 'currency',            rule: 'iso4217',             code: 'ACP-S07', label: 'currency valid ISO 4217' },
  { key: 'timestamp',           rule: 'iso8601',             code: 'ACP-S08', label: 'timestamp ISO 8601 / Unix ms' },
  { key: 'response_signature',  rule: 'nonempty_string',     code: 'ACP-S09', label: 'response_signature present (response authentication)' },
  { key: 'transaction_id',      rule: 'nonempty_string',     code: 'ACP-S10', label: 'transaction_id present' },
];

const SPT_FIELDS = [
  { key: 'token_id',     required: true  },
  { key: 'token_type',   required: true  },
  { key: 'issued_at',    required: true  },
  { key: 'expires_at',   required: true  },
  { key: 'scope',        required: true  },
  { key: 'payment_rail', required: true  },
  { key: 'masked_pan',   required: false },
  { key: 'billing_zip',  required: false },
  { key: 'metadata',     required: false },
];

const ISO4217 = new Set(['USD','EUR','GBP','JPY','CAD','AUD','CHF','CNY','SEK','NOK','DKK','NZD','SGD','HKD','MXN','BRL','INR','RUB','KRW','TRY','ZAR','SAR','AED','PLN','THB','IDR','CZK','ILS','CLP','PHP']);
const ACP_STATUSES = new Set(['approved', 'declined', 'pending', 'error']);

function runRule(rule, value) {
  if (rule === 'nonempty_string') return typeof value === 'string' && value.trim().length > 0;
  if (rule.startsWith('eq:')) return value === rule.slice(3);
  if (rule === 'positive_number') return typeof value === 'number' && value > 0;
  if (rule === 'nonempty_array') return Array.isArray(value) && value.length > 0;
  if (rule === 'iso4217') return typeof value === 'string' && ISO4217.has(value.toUpperCase());
  if (rule === 'iso8601') {
    if (typeof value === 'number') return value > 1e9;
    if (typeof value !== 'string') return false;
    return !isNaN(Date.parse(value));
  }
  if (rule === 'https_url') {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }
  if (rule === 'acp_status') return ACP_STATUSES.has(value);
  if (rule === 'spt_object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return true;
}

/**
 * compute(pp) — pure ACP conformance engine.
 * pp: {
 *   payload: object,             // the ACP CheckoutRequest or CheckoutResponse JSON
 *   message_type_override?: string, // 'CheckoutRequest'|'CheckoutResponse'|'auto' (default 'auto')
 * }
 */
export function compute(pp) {
  const parsed = pp.payload;
  const msgTypeOverride = pp.message_type_override ?? 'auto';

  if (!parsed || typeof parsed !== 'object') {
    return {
      output_payload: { overall_status: 'fail', pass_count: 0, fail_count: 1, warn_count: 0, checks: [{ code: 'ACP-T01', status: 'fail' }], merchant_id: null, currency: null },
      compliance_flags: ['ACP_NON_CONFORMANT', 'FIELD_VALIDATION_FAILED'],
    };
  }

  let msgType = msgTypeOverride === 'auto' ? parsed.message_type : msgTypeOverride;
  if (!['CheckoutRequest', 'CheckoutResponse'].includes(msgType)) msgType = null;

  const checks = [];
  let passCount = 0, failCount = 0, warnCount = 0;

  // Message type check
  if (!msgType) {
    checks.push({ status: 'fail', code: 'ACP-T01', text: 'Cannot determine message_type — must be "CheckoutRequest" or "CheckoutResponse"' });
    failCount++;
  } else {
    checks.push({ status: 'pass', code: 'ACP-T01', text: `Message type detected: ${msgType}` });
    passCount++;
  }

  // Field checks
  const fieldRules = msgType === 'CheckoutRequest' ? REQ_FIELDS_REQUEST
    : msgType === 'CheckoutResponse' ? REQ_FIELDS_RESPONSE : [];
  for (const rule of fieldRules) {
    const value = parsed[rule.key];
    const present = Object.prototype.hasOwnProperty.call(parsed, rule.key);
    const ok = present && runRule(rule.rule, value);
    if (ok) {
      checks.push({ status: 'pass', code: rule.code, text: rule.label });
      passCount++;
    } else {
      checks.push({ status: 'fail', code: rule.code, text: rule.label, detail: !present ? `Field "${rule.key}" is absent` : `Invalid value: ${JSON.stringify(value)}` });
      failCount++;
    }
  }

  // Items sub-validation (CheckoutRequest)
  if (msgType === 'CheckoutRequest' && Array.isArray(parsed.items) && parsed.items.length > 0) {
    const itemProblems = [];
    parsed.items.forEach((item, i) => {
      if (!item.sku && !item.product_id) itemProblems.push(`items[${i}] missing sku/product_id`);
      if (typeof item.unit_price !== 'number' || item.unit_price < 0) itemProblems.push(`items[${i}].unit_price invalid`);
      if (typeof item.quantity !== 'number' || item.quantity < 1) itemProblems.push(`items[${i}].quantity invalid`);
    });
    if (itemProblems.length === 0) {
      checks.push({ status: 'pass', code: 'ACP-R07a', text: `Items array: ${parsed.items.length} items, all have required sub-fields` });
      passCount++;
    } else {
      checks.push({ status: 'warn', code: 'ACP-R07a', text: 'Items array has field issues', detail: itemProblems.join(' · ') });
      warnCount++;
    }
  }

  // Amount precision check (≤2 decimal places for non-JPY/KRW/CLP)
  const amountField = msgType === 'CheckoutRequest' ? 'amount' : 'amount_charged';
  if (typeof parsed[amountField] === 'number') {
    const cur = (parsed.currency || '').toUpperCase();
    const noDecimalCurrencies = new Set(['JPY', 'KRW', 'CLP']);
    if (!noDecimalCurrencies.has(cur)) {
      const decimals = (parsed[amountField].toString().split('.')[1] || '').length;
      if (decimals > 2) {
        checks.push({ status: 'warn', code: 'ACP-P01', text: `Amount has ${decimals} decimal places — ACP requires ≤ 2 for ${cur}` });
        warnCount++;
      } else {
        checks.push({ status: 'pass', code: 'ACP-P01', text: `Amount precision valid (${decimals} decimal places)` });
        passCount++;
      }
    }
  }

  // Idempotency key (CheckoutRequest — recommended)
  if (msgType === 'CheckoutRequest') {
    if (parsed.idempotency_key && typeof parsed.idempotency_key === 'string') {
      checks.push({ status: 'pass', code: 'ACP-R11', text: 'idempotency_key present (recommended for retry safety)' });
      passCount++;
    } else {
      checks.push({ status: 'warn', code: 'ACP-R11', text: 'idempotency_key absent — recommended for retry-safe agent commerce' });
      warnCount++;
    }
  }

  // Signature format check
  const sigField = msgType === 'CheckoutRequest' ? 'signature' : 'response_signature';
  if (parsed[sigField] && typeof parsed[sigField] === 'string') {
    const validPrefixes = ['sha256-hmac:', 'rs256:', 'es256:', 'ed25519:'];
    const prefixOk = validPrefixes.some(p => parsed[sigField].toLowerCase().startsWith(p));
    if (prefixOk) {
      checks.push({ status: 'pass', code: 'ACP-SIG1', text: `Signature format valid prefix (${parsed[sigField].split(':')[0]})` });
      passCount++;
    } else {
      checks.push({ status: 'warn', code: 'ACP-SIG1', text: 'Signature prefix unrecognised — expected sha256-hmac:, RS256:, ES256:, or Ed25519:' });
      warnCount++;
    }
  }

  // SPT deep validation (CheckoutResponse)
  if (msgType === 'CheckoutResponse' && parsed.shared_payment_token && typeof parsed.shared_payment_token === 'object') {
    const spt = parsed.shared_payment_token;
    let sptPass = 0, sptFail = 0;
    for (const sf of SPT_FIELDS) {
      if (!sf.required) continue;
      const present = Object.prototype.hasOwnProperty.call(spt, sf.key);
      const value = spt[sf.key];
      if (present && value !== null && value !== '') sptPass++;
      else sptFail++;
    }
    if (spt.issued_at && spt.expires_at) {
      const ttl = spt.expires_at - spt.issued_at;
      if (ttl < 0) {
        checks.push({ status: 'fail', code: 'ACP-SPT1', text: 'SPT expires_at is before issued_at' });
        failCount++;
      } else if (ttl > 3600) {
        checks.push({ status: 'warn', code: 'ACP-SPT1', text: `SPT TTL is ${ttl}s — ACP recommends ≤ 3600s for single-use tokens` });
        warnCount++;
      } else {
        checks.push({ status: 'pass', code: 'ACP-SPT1', text: `SPT TTL: ${ttl}s — within recommended 1-hour window` });
        passCount++;
      }
    }
    if (spt.scope && !['single_use', 'multi_use'].includes(spt.scope)) {
      checks.push({ status: 'fail', code: 'ACP-SPT2', text: `SPT scope invalid — must be "single_use" or "multi_use"` });
      failCount++;
    } else if (spt.scope) {
      checks.push({ status: 'pass', code: 'ACP-SPT2', text: `SPT scope valid: "${spt.scope}"` });
      passCount++;
    }
    if (spt.masked_pan && !/^\d{4}$/.test(String(spt.masked_pan))) {
      checks.push({ status: 'warn', code: 'ACP-SPT3', text: 'SPT masked_pan should be exactly 4 digits' });
      warnCount++;
    }
    if (sptFail === 0) {
      checks.push({ status: 'pass', code: 'ACP-SPT0', text: `SPT required fields: ${sptPass}/${sptPass} present` });
      passCount++;
    } else {
      const missingKeys = SPT_FIELDS.filter(sf => sf.required && !Object.prototype.hasOwnProperty.call(spt, sf.key)).map(sf => sf.key).join(', ');
      checks.push({ status: 'fail', code: 'ACP-SPT0', text: `SPT missing ${sptFail} required field(s)`, detail: missingKeys });
      failCount++;
    }
  }

  const overallStatus = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';

  const output_payload = {
    overall_status: overallStatus,
    pass_count:     passCount,
    fail_count:     failCount,
    warn_count:     warnCount,
    checks:         checks.map(c => ({ code: c.code, status: c.status })),
    merchant_id:    parsed.merchant_id || null,
    currency:       parsed.currency || null,
  };

  const compliance_flags = failCount > 0
    ? ['ACP_NON_CONFORMANT', 'FIELD_VALIDATION_FAILED']
    : warnCount > 0
      ? ['ACP_CONFORMANT_WITH_WARNINGS']
      : ['ACP_FULLY_CONFORMANT'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: 'payment_mandate',
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

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'payment_mandate' };
