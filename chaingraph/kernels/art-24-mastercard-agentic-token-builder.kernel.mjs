export const meta = {
  tool_id: 'art-24-mastercard-agentic-token-builder',
  mcp_name: 'build_mastercard_agentic_token',
  mandate_type: 'compliance_control',
};

function first(o, keys) {
  if (!o || typeof o !== 'object') return null;
  for (const k of keys) {
    if (o[k] !== undefined) return { k, v: o[k] };
  }
  return null;
}

function lintScope(o) {
  const findings = [];

  if (typeof o !== 'object' || o === null || Array.isArray(o)) {
    findings.push({ level: 'error', msg: 'Token scope must be a JSON object.' });
    return findings;
  }

  // Agent binding
  const agent = first(o, ['agentId', 'agent_id', 'agent']);
  if (!agent || !agent.v) {
    findings.push({ level: 'error', msg: 'No agent binding — an Agentic Token MUST bind to a specific agent id.' });
  } else {
    findings.push({ level: 'pass', msg: `Agent-bound (${agent.k} = ${agent.v}).` });
  }

  // Merchant scope
  const mer = first(o, ['merchantScope', 'merchants', 'allowed_merchants', 'merchant']);
  if (!mer || mer.v === undefined) {
    findings.push({ level: 'error', msg: 'No merchant scope — restrict the token to specific merchants.' });
  } else if (mer.v === 'any' || mer.v === '*' || (Array.isArray(mer.v) && mer.v.length === 0)) {
    findings.push({ level: 'warn', msg: 'Merchant scope is "any" — unrestricted; pin an allow-list where possible.' });
  } else {
    findings.push({ level: 'pass', msg: `Merchant-scoped (${Array.isArray(mer.v) ? mer.v.length + ' merchant(s)' : mer.v}).` });
  }

  // Consent policy
  const cp = first(o, ['consentPolicy', 'consent_policy', 'policy', 'consent']);
  const pol = cp ? cp.v : o;

  const ptl = first(pol, ['perTransactionLimit', 'txnLimit', 'per_transaction_limit', 'transactionLimit']);
  const tot = first(pol, ['totalLimit', 'total_limit', 'periodLimit', 'maxAmount']);

  if (!ptl && !tot) {
    findings.push({ level: 'error', msg: 'No spend limit — MUST cap per-transaction and/or total spend.' });
  } else {
    if (ptl) findings.push({ level: 'pass', msg: 'Per-transaction limit set.' });
    if (tot) findings.push({ level: 'pass', msg: 'Total/period limit set.' });
  }

  // Expiry
  const exp = first(pol, ['expiresAt', 'expiry', 'exp', 'valid_until', 'expires']);
  if (!exp) {
    findings.push({ level: 'warn', msg: 'No expiry — set a validity window so the token does not live forever.' });
  } else {
    findings.push({ level: 'pass', msg: `Expiry set (${exp.k}).` });
  }

  // Velocity
  const vel = first(pol, ['velocity', 'frequency', 'rateLimit']);
  if (!vel) {
    findings.push({ level: 'info', msg: 'No velocity/frequency cap — consider one to bound runaway agent spend.' });
  } else {
    findings.push({ level: 'pass', msg: `Velocity cap present (${vel.v}).` });
  }

  findings.push({ level: 'info', msg: 'Field names illustrative (MDES Agentic Token) — verify against Mastercard. The agent never receives the raw PAN.' });

  return findings;
}

function scoreOf(findings) {
  let e = 0, w = 0, p = 0;
  for (const f of findings) {
    if (f.level === 'error') e++;
    else if (f.level === 'warn') w++;
    else if (f.level === 'pass') p++;
  }
  let score = 100 - e * 15 - w * 4;
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return { score, errors: e, warnings: w, passes: p };
}

export function compute(pp) {
  // Accept token_scope as object or nested in pp
  const scope = pp.token_scope ?? pp;

  const findings = lintScope(scope);
  const { score, errors, warnings, passes } = scoreOf(findings);

  const verdict = errors > 0 ? 'unsafe' : warnings > 0 ? 'advisory' : 'safe';

  const compliance_flags = {
    AGENTIC_TOKEN_SCOPE_LINTED: true,
    TOKEN_SCOPE_SAFE: verdict === 'safe',
    TOKEN_SCOPE_ADVISORY: verdict === 'advisory',
    TOKEN_SCOPE_UNSAFE: verdict === 'unsafe',
    HAS_AGENT_BINDING: findings.some(f => f.level === 'pass' && f.msg.startsWith('Agent-bound')),
    HAS_MERCHANT_SCOPE: findings.some(f => f.level === 'pass' && f.msg.startsWith('Merchant-scoped')),
    HAS_SPEND_LIMIT: findings.some(f => f.level === 'pass' && f.msg.includes('limit set')),
    HAS_EXPIRY: findings.some(f => f.level === 'pass' && f.msg.startsWith('Expiry set')),
  };

  return {
    verdict,
    score,
    errors,
    warnings,
    passes,
    findings: findings.map(f => ({ level: f.level, msg: f.msg })),
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    ...result,
  };
}
