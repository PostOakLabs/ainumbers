import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-30-agent-commerce-conformance-validator';
const TOOL_VERSION = '1.1.0'; // 1.1.0: + MPP (Tempo Machine Payments Protocol) leg — additive, fires only when mpp_session supplied

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_agent_commerce_conformance',
  mandate_type: 'payment_mandate',
  gpu: false,
};

function safeJson(v) {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch(e) { return null; }
  }
  return v || null;
}

function validateAP2(trio) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });

  if (!trio) { push('AP2-I00', 'fail', 'ap2_mandate_trio is null/missing'); return checks; }
  const intent = trio.intent;
  const cart = trio.cart;
  const payment = trio.payment;

  if (!intent) { push('AP2-I00', 'fail', 'intent block missing'); return checks; }
  push('AP2-I00', 'pass', 'intent block present');
  push('AP2-I01', intent.mandate_type==='intent' ? 'pass' : 'fail', `mandate_type=${intent.mandate_type}`);
  push('AP2-I02', !!intent.mandate_id ? 'pass' : 'fail', 'mandate_id present');
  push('AP2-I03', intent.expires_at ? 'pass' : 'warn', intent.expires_at ? 'expires_at present' : 'expires_at missing');
  const scopeOk = intent.scope && Array.isArray(intent.scope.merchant_ids) && intent.scope.currency && typeof intent.scope.max_amount==='number';
  push('AP2-I04', scopeOk ? 'pass' : 'fail', 'scope fields: merchant_ids, currency, max_amount');
  push('AP2-I05', typeof intent.human_not_present==='boolean' ? 'pass' : 'warn', 'human_not_present bool');
  push('AP2-I06', !!intent.issuer_id ? 'pass' : 'warn', 'issuer_id present');

  if (cart) {
    push('AP2-C01', cart.mandate_type==='cart' ? 'pass' : 'fail', `cart.mandate_type=${cart.mandate_type}`);
    push('AP2-C02', cart.parent_mandate_id===intent.mandate_id ? 'pass' : 'fail', 'parent_mandate_id matches intent.mandate_id');
    push('AP2-C03', /^[0-9a-f]{64}$/.test(cart.parent_hash||'') ? 'pass' : 'warn', 'parent_hash 64-hex');
    push('AP2-C04', Array.isArray(cart.items) && cart.items.length>0 ? 'pass' : 'fail', 'cart.items non-empty');
  }

  if (!payment) { push('AP2-P00', 'fail', 'payment block missing'); return checks; }
  push('AP2-P00', 'pass', 'payment block present');
  push('AP2-P01', payment.mandate_type==='payment' ? 'pass' : 'fail', `payment.mandate_type=${payment.mandate_type}`);
  const expectedParent = cart ? cart.mandate_id : intent.mandate_id;
  push('AP2-P02', payment.parent_mandate_id===expectedParent ? 'pass' : 'fail', 'payment.parent_mandate_id chain');
  push('AP2-P03', /^[0-9a-f]{64}$/.test(payment.parent_hash||'') ? 'pass' : 'warn', 'parent_hash 64-hex');
  push('AP2-P04', typeof payment.amount==='number' && payment.amount>0 ? 'pass' : 'fail', 'payment.amount>0');
  push('AP2-P05', intent.scope?.currency?.toUpperCase()===payment.currency?.toUpperCase() ? 'pass' : 'warn', 'currency matches intent.scope.currency');
  push('AP2-P06', payment.amount <= intent.scope?.max_amount ? 'pass' : 'warn', 'amount within max_amount cap');
  push('AP2-P07', typeof payment.human_not_present==='boolean' && payment.human_not_present===intent.human_not_present ? 'pass' : 'warn', 'human_not_present consistent');
  push('AP2-P08', !!payment.payment_method ? 'pass' : 'fail', 'payment_method present');

  return checks;
}

function validateACP(payload) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!payload) { push('ACP-R00', 'fail', 'acp_payload null'); return checks; }

  let msgType = payload.message_type;
  if (!msgType) {
    if (payload.agent_id || payload.idempotency_key) msgType = 'CheckoutRequest';
    else if (payload.checkout_id || payload.shared_payment_token) msgType = 'CheckoutResponse';
    else msgType = 'unknown';
  }
  push('ACP-R00', ['CheckoutRequest','CheckoutResponse'].includes(msgType) ? 'pass' : 'fail', `message_type=${msgType}`);

  if (msgType === 'CheckoutRequest') {
    push('ACP-R01', !!payload.agent_id ? 'pass' : 'fail', 'agent_id present');
    push('ACP-R02', !!payload.merchant_id ? 'pass' : 'fail', 'merchant_id present');
    push('ACP-R03', !!payload.currency ? 'pass' : 'fail', 'currency present');
    push('ACP-R04', typeof payload.amount==='number' ? 'pass' : 'fail', 'amount present');
    push('ACP-R05', !!payload.idempotency_key ? 'pass' : 'warn', 'idempotency_key present');
    const sigPrefixes = ['sha256-hmac:','rs256:','es256:','ed25519:'];
    const sig = payload.signature || '';
    push('ACP-SIG1', !sig || sigPrefixes.some(p=>sig.startsWith(p)) ? 'pass' : 'warn', 'signature prefix valid');
  } else if (msgType === 'CheckoutResponse') {
    push('ACP-R01', !!payload.checkout_id ? 'pass' : 'fail', 'checkout_id present');
    push('ACP-R02', !!payload.status ? 'pass' : 'fail', 'status present');
    push('ACP-R03', typeof payload.amount_charged==='number' ? 'pass' : 'fail', 'amount_charged present');
    push('ACP-R04', !!payload.currency ? 'pass' : 'fail', 'currency present');
    push('ACP-R05', !!payload.merchant_id ? 'pass' : 'fail', 'merchant_id present');
    const spt = payload.shared_payment_token;
    const sptFields = ['payment_token_id','token_type','scope','issued_at','expires_at','merchant_id'];
    push('ACP-SPT0', spt && sptFields.every(f=>spt[f]!=null) ? 'pass' : 'fail', 'shared_payment_token has all 6 fields');
    if (spt) {
      push('ACP-SPT1', ['single_use','multi_use'].includes(spt.scope) ? 'pass' : 'warn', `scope=${spt.scope}`);
      const ttl = (typeof spt.expires_at==='number' && typeof spt.issued_at==='number') ? spt.expires_at - spt.issued_at : null;
      push('ACP-SPT2', ttl===null ? 'pass' : ttl<=3600 ? 'pass' : 'warn', ttl===null ? 'ttl not numeric, skip' : `ttl=${ttl}s`);
    }
  }
  return checks;
}

function validateTAP(headers) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!headers) { push('TAP-S01', 'fail', 'tap_headers null'); return checks; }

  const sigInput = headers['Signature-Input'] || headers['signature-input'] || '';
  const sigBody = headers['Signature'] || headers['signature'] || '';
  push('TAP-S01', sigInput.length > 0 ? 'pass' : 'fail', 'Signature-Input header present');
  push('TAP-S02', sigBody.length > 0 ? 'pass' : 'fail', 'Signature header present');

  // Parse params from Signature-Input
  const algM = sigInput.match(/alg="([^"]+)"/);
  const alg = algM ? algM[1] : null;
  const createdM = sigInput.match(/created=(\d+)/);
  const expiresM = sigInput.match(/expires=(\d+)/);
  const nonce = sigInput.match(/nonce="([^"]+)"/)?.[1];
  const keyid = sigInput.match(/keyid="([^"]+)"/)?.[1];

  const validAlgs = ['ed25519','ecdsa-p256-sha256','rsa-pss-sha512','hmac-sha256'];
  push('TAP-S03', alg && validAlgs.includes(alg) ? 'pass' : 'fail', `alg=${alg}`);
  push('TAP-S04', !!createdM ? 'pass' : 'fail', 'created timestamp present');

  if (expiresM && createdM) {
    const ttl = parseInt(expiresM[1]) - parseInt(createdM[1]);
    push('TAP-S05', ttl <= 86400 ? 'pass' : 'warn', `ttl=${ttl}s`);
  } else {
    push('TAP-S05', 'pass', 'expires not present, skip ttl check');
  }
  push('TAP-S06', !!keyid ? 'pass' : 'warn', 'keyid present');
  push('TAP-S07', /@method|@path/.test(sigInput) ? 'pass' : 'warn', '@method or @path in Signature-Input');
  push('TAP-S08', /^[A-Za-z0-9+/]+=*$/.test(sigBody.replace(/^sig\d*=:/, '').replace(/:$/, '')) ? 'pass' : 'warn', 'Signature body base64');

  return checks;
}

function validateX402(payload) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!payload) { push('X402-F01', 'fail', 'x402_payload null'); return checks; }

  push('X402-F01', ['exact','open'].includes(payload.scheme) ? 'pass' : 'fail', `scheme=${payload.scheme}`);
  push('X402-F02', !!payload.network ? 'pass' : 'fail', 'network present');
  push('X402-F03', parseFloat(payload.maxAmountRequired)>0 ? 'pass' : 'fail', `maxAmountRequired=${payload.maxAmountRequired}`);
  push('X402-F04', !!payload.asset ? 'pass' : 'fail', 'asset present');
  push('X402-F05', !!payload.payTo ? 'pass' : 'fail', 'payTo present');
  push('X402-F06', typeof payload.extra?.resource==='string' ? 'pass' : 'warn', 'extra.resource string');
  return checks;
}

// MPP — Tempo Machine Payments Protocol (Stripe-co-authored). Validates the agent-side
// session/charge/subscription pre-authorization that underlies a streamed-micropayment leg.
// Modes: charge (one-time), session (pay-as-you-go channel), subscription (recurring).
function validateMPP(session) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!session) { push('MPP-S00', 'fail', 'mpp_session null/missing'); return checks; }
  push('MPP-S00', 'pass', 'mpp_session present');
  const mode = session.mode;
  push('MPP-S01', ['charge','session','subscription'].includes(mode) ? 'pass' : 'fail', `mode=${mode}`);
  push('MPP-S02', !!session.session_id ? 'pass' : 'warn', 'session_id present');
  push('MPP-S03', typeof session.max_amount==='number' && session.max_amount>0 ? 'pass' : 'fail', 'max_amount>0 (pre-authorized spend cap)');
  push('MPP-S04', !!session.currency ? 'pass' : 'fail', 'currency present');
  push('MPP-S05', !!(session.payee || session.resource) ? 'pass' : 'fail', 'payee or resource present');
  // recurring/streamed modes need a cadence or channel expiry to bound the authorization
  if (mode === 'subscription') {
    push('MPP-S06', !!session.cadence ? 'pass' : 'fail', `subscription requires cadence (=${session.cadence})`);
  } else if (mode === 'session') {
    push('MPP-S06', session.expires_at!=null ? 'pass' : 'warn', 'session channel expires_at present');
  } else {
    push('MPP-S06', 'pass', 'charge: no cadence/expiry required');
  }
  // signed pre-authorization (access key / scoped key) — MPP "OAuth of payments" trust root
  const ak = session.access_key || session.signature || '';
  push('MPP-S07', !!ak ? 'pass' : 'warn', 'access_key/signature present (signed pre-authorization)');
  return checks;
}

// MPP cross-protocol coherence vs the AP2 intent envelope (only when both present).
function validateCrossProtocolMPP(ap2Trio, mppSession) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  const intent = ap2Trio && ap2Trio.intent;
  if (!intent || !mppSession) return checks;
  if (typeof mppSession.max_amount==='number' && typeof intent.scope?.max_amount==='number') {
    push('XP-M01', mppSession.max_amount <= intent.scope.max_amount ? 'pass' : 'warn', `mpp cap=${mppSession.max_amount} within intent max=${intent.scope.max_amount}`);
  }
  if (mppSession.currency && intent.scope?.currency) {
    push('XP-M02', mppSession.currency.toUpperCase()===intent.scope.currency.toUpperCase() ? 'pass' : 'warn', 'mpp currency matches intent.scope.currency');
  }
  return checks;
}

function validateCrossProtocol(ap2Trio, acpPayload, x402Payload) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!ap2Trio) return checks;
  const pay = ap2Trio.payment;
  if (!pay) return checks;

  if (acpPayload) {
    const acpAmt = acpPayload.amount ?? acpPayload.amount_charged;
    if (typeof pay.amount==='number' && typeof acpAmt==='number') {
      push('XP-A01', Math.abs(pay.amount - acpAmt) < 0.005 ? 'pass' : 'warn', `ap2=${pay.amount} acp=${acpAmt}`);
    }
    push('XP-A02', pay.merchant_id===acpPayload.merchant_id ? 'pass' : 'warn', 'merchant_id cross-match');
  }
  if (x402Payload) {
    const x4Amt = parseFloat(x402Payload.maxAmountRequired);
    if (typeof pay.amount==='number' && !isNaN(x4Amt)) {
      push('XP-A03', Math.abs(pay.amount - x4Amt) < 0.01 ? 'pass' : 'warn', `ap2=${pay.amount} x402=${x4Amt}`);
    }
  }
  return checks;
}

export function compute(pp) {
  const ap2Trio = safeJson(pp.ap2_mandate_trio);
  const acpPayload = pp.acp_payload ? safeJson(pp.acp_payload) : null;
  const tapHeaders = pp.tap_headers ? safeJson(pp.tap_headers) : null;
  const x402Payload = pp.x402_payload ? safeJson(pp.x402_payload) : null;
  const mppSession = pp.mpp_session ? safeJson(pp.mpp_session) : null;

  const protocolsValidated = ['AP2'];
  const allChecks = [...validateAP2(ap2Trio)];
  if (acpPayload) { allChecks.push(...validateACP(acpPayload)); protocolsValidated.push('ACP'); }
  if (tapHeaders) { allChecks.push(...validateTAP(tapHeaders)); protocolsValidated.push('TAP'); }
  if (x402Payload) { allChecks.push(...validateX402(x402Payload)); protocolsValidated.push('x402'); }
  if (mppSession) { allChecks.push(...validateMPP(mppSession)); protocolsValidated.push('MPP'); }
  allChecks.push(...validateCrossProtocol(ap2Trio, acpPayload, x402Payload));
  // MPP cross-checks appended last so existing protocol/check ordering is byte-identical when mpp absent.
  if (mppSession) { allChecks.push(...validateCrossProtocolMPP(ap2Trio, mppSession)); }

  const failCount = allChecks.filter(c=>c.status==='fail').length;
  const warnCount = allChecks.filter(c=>c.status==='warn').length;
  const passCount = allChecks.filter(c=>c.status==='pass').length;
  const overall_status = failCount>0 ? 'fail' : warnCount>0 ? 'warn' : 'pass';

  const compliance_flags = overall_status==='fail'
    ? ['CROSS_PROTOCOL_NON_CONFORMANT','FIELD_VALIDATION_FAILED']
    : overall_status==='warn'
    ? ['CROSS_PROTOCOL_CONFORMANT_WITH_WARNINGS']
    : ['CROSS_PROTOCOL_FULLY_CONFORMANT'];

  const output_payload = { overall_status, pass_count: passCount, fail_count: failCount, warn_count: warnCount, checks: allChecks, protocols_validated: protocolsValidated };
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
