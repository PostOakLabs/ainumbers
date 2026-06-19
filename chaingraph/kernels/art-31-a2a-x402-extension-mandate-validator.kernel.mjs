export const meta = {
  tool_id: 'art-31-a2a-x402-extension-mandate-validator',
  mcp_name: 'validate_a2a_x402_mandate',
  mandate_type: 'settlement_mandate',
};

const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

function safeJson(v) {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch(e) { return null; }
  }
  return v || null;
}

function assetMatch(a, b) {
  if (!a || !b) return false;
  const norm = s => {
    const l = String(s).toLowerCase().trim();
    return l === 'usdc' ? USDC_BASE.toLowerCase() : l;
  };
  return norm(a) === norm(b);
}

function checkExtension(card) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  const exts = card?.capabilities?.extensions;
  push('EXT-01', Array.isArray(exts) ? 'pass' : 'fail', 'capabilities.extensions is array');
  if (!Array.isArray(exts)) return { checks, found: null };
  const found = exts.find(e => e.uri?.toLowerCase().includes('x402'));
  push('EXT-02', found ? 'pass' : 'fail', found ? 'x402 extension found' : 'no x402 extension URI found');
  push('EXT-03', found && found.params && typeof found.params==='object' ? 'pass' : 'warn', 'x402 extension has params object');
  return { checks, found: found || null };
}

function checkScope(ext) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!ext) { push('SCOPE-00', 'fail', 'x402 extension not found'); return checks; }
  const pa = ext.params?.payment_authority;
  push('SCOPE-01', pa && typeof pa==='object' ? 'pass' : 'fail', 'payment_authority object present');
  const scopeVal = pa?.scope;
  const scopeOk = Array.isArray(scopeVal) ? scopeVal.length>0 : (typeof scopeVal==='string' && scopeVal.length>0);
  push('SCOPE-02', scopeOk ? 'pass' : 'fail', 'scope non-empty array or string');
  push('SCOPE-03', typeof pa?.max_amount==='number' && pa.max_amount>0 ? 'pass' : 'warn', `max_amount=${pa?.max_amount}`);
  return checks;
}

function checkRail(ext) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!ext) { push('RAIL-00', 'fail', 'x402 extension not found'); return { checks, rail: null }; }
  const rail = ext.params?.settlement_rail;
  push('RAIL-01', rail && typeof rail==='object' ? 'pass' : 'fail', 'settlement_rail object present');
  if (!rail) return { checks, rail: null };
  push('RAIL-02', rail.scheme==='exact' ? 'pass' : rail.scheme ? 'warn' : 'fail', `scheme=${rail.scheme}`);
  push('RAIL-03', !!rail.network ? 'pass' : 'fail', 'network present');
  push('RAIL-04', !!rail.asset ? 'pass' : 'fail', 'asset present');
  return { checks, rail };
}

function lintPaymentPayload(pay) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  if (!pay) { push('PAY-F01', 'fail', 'payment_payload null'); return checks; }
  const required = ['scheme','network','maxAmountRequired','resource','payTo','asset'];
  const codes = ['PAY-F01','PAY-F02','PAY-F03','PAY-F04','PAY-F05','PAY-F06'];
  required.forEach((f, i) => {
    push(codes[i], pay[f]!=null && pay[f]!=='' ? 'pass' : 'fail', `${f} present`);
  });
  push('PAY-F07', pay.scheme==='exact' ? 'pass' : 'warn', `scheme=${pay.scheme}`);
  push('PAY-F08', parseFloat(pay.maxAmountRequired)>0 ? 'pass' : 'fail', `maxAmountRequired=${pay.maxAmountRequired}`);
  if (pay.maxTimeoutSeconds != null) {
    push('PAY-F09', typeof pay.maxTimeoutSeconds==='number' && pay.maxTimeoutSeconds>0 ? 'pass' : 'warn', `maxTimeoutSeconds=${pay.maxTimeoutSeconds}`);
  }
  return checks;
}

function checkConsistency(pay, capAmt, capAsset, rail) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note: note||undefined });
  const payAmt = parseFloat(pay?.maxAmountRequired);
  if (typeof capAmt==='number' && !isNaN(payAmt)) {
    push('CON-01', payAmt <= capAmt + 1e-9 ? 'pass' : 'fail', `pay=${payAmt} cap=${capAmt}`);
  } else {
    push('CON-01', 'warn', 'cannot evaluate amount cap (missing values)');
  }
  if (capAsset && pay?.asset) {
    push('CON-02', assetMatch(pay.asset, capAsset) ? 'pass' : 'fail', `pay.asset=${pay.asset} cap.asset=${capAsset}`);
  } else {
    push('CON-02', 'warn', 'asset missing from payload or cap');
  }
  if (rail?.asset && pay?.asset) {
    push('CON-03', assetMatch(pay.asset, rail.asset) ? 'pass' : 'warn', `pay.asset=${pay.asset} rail.asset=${rail.asset}`);
  }
  if (rail?.network && pay?.network) {
    push('CON-04', String(rail.network).toLowerCase()===String(pay.network).toLowerCase() ? 'pass' : 'warn', `pay.network=${pay.network} rail.network=${rail.network}`);
  }
  return checks;
}

export function compute(pp) {
  const card = safeJson(pp.agent_card);
  const pay = safeJson(pp.payment_payload);
  const cap = pp.mandate_cap || {};
  const capAmt = typeof cap.max_amount==='number' ? cap.max_amount : parseFloat(cap.max_amount);
  const capAsset = cap.asset || null;

  const { checks: extChecks, found: ext } = checkExtension(card);
  const scopeChecks = checkScope(ext);
  const { checks: railChecks, rail } = checkRail(ext);
  const payChecks = lintPaymentPayload(pay);
  const conChecks = checkConsistency(pay, capAmt, capAsset, rail);

  const allChecks = [...extChecks, ...scopeChecks, ...railChecks, ...payChecks, ...conChecks];
  const failCount = allChecks.filter(c=>c.status==='fail').length;
  const warnCount = allChecks.filter(c=>c.status==='warn').length;
  const passCount = allChecks.filter(c=>c.status==='pass').length;
  const verdict = failCount>0 ? 'fail' : warnCount>0 ? 'warn' : 'pass';

  const compliance_flags = verdict==='fail'
    ? ['X402_EXTENSION_NON_CONFORMANT','FIELD_VALIDATION_FAILED']
    : verdict==='warn'
    ? ['X402_EXTENSION_CONFORMANT_WITH_WARNINGS']
    : ['X402_EXTENSION_FULLY_CONFORMANT'];

  return {
    verdict,
    pass_count: passCount,
    fail_count: failCount,
    warn_count: warnCount,
    extension_declared: !!ext,
    payment_authority_scope_present: !!(ext?.params?.payment_authority?.scope),
    settlement_rail_bound: !!(rail),
    checks: allChecks,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts={}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    inputs: pp,
    outputs: result,
    artifact_version: '1.0',
  };
}
