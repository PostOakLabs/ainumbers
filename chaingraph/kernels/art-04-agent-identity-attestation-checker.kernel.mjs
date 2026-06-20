// art-04 — Agent Identity & Authorization Attestation Checker: pure decision kernel.
// Faithful port of checkAgentAttestation() in
//   repo/chaingraph/art-04-agent-identity-attestation-checker.html
// Pure: no DOM, no window, no network. Time-dependent checks use pp.validate_at_unix.
//
// policy_parameters carries the full credential so the execution_hash anchors
// the complete input (unlike the browser's lossy {credential_type, chain_depth, scope_count}).

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-04-agent-identity-attestation-checker';
const TOOL_VERSION = '1.0.0';

const MAX_CHAIN_DEPTH = 4;
const MAX_VALIDITY_DAYS = 90;
const KYA_SCOPE_REGISTRY = new Set([
  'read:account', 'read:transactions', 'read:portfolio',
  'write:payment', 'write:order', 'write:transfer',
  'execute:trade', 'execute:checkout', 'execute:transfer',
  'delegate:sub_agent', 'admin:audit', 'admin:revoke',
  'compliance:report', 'compliance:kyc', 'compliance:aml',
]);
const EU_AI_ACT_HIGH_RISK_SCOPES = new Set(['execute:trade', 'execute:transfer', 'admin:audit', 'admin:revoke']);
const VALID_SIG_PFX = ['ed25519:', 'es256:', 'rs256:'];

/**
 * compute(pp) — pure KYA-OS attestation engine.
 * pp: {
 *   credential: object,       // full KYA-OS AgentCredential or DelegationChain JSON
 *   validate_at_unix: number, // Unix seconds for expiry/validity checks (required for determinism)
 * }
 */
export function compute(pp) {
  const cred = pp.credential;
  const now  = typeof pp.validate_at_unix === 'number' ? pp.validate_at_unix : Math.floor(Date.now() / 1000);

  const checks = [];
  let pass = 0, fail = 0, warn = 0;

  const addCheck = (status, code, text, detail = '') => {
    checks.push({ status, code, text, detail });
    if (status === 'pass') pass++;
    else if (status === 'fail') fail++;
    else if (status === 'warn') warn++;
  };

  if (!cred || typeof cred !== 'object') {
    addCheck('fail', 'KYA-T01', 'credential is required and must be a JSON object');
    return { output_payload: { overall_status: 'fail', pass, fail, warn, checks: checks.map(c => ({ code: c.code, status: c.status })), root_agent_id: null, scopes: [] }, compliance_flags: ['KYA_ATTESTATION_FAILED'] };
  }

  const type = cred.credential_type;
  if (!['AgentCredential', 'DelegationChain'].includes(type)) {
    addCheck('fail', 'KYA-T01', 'credential_type must be AgentCredential or DelegationChain', `Got: ${JSON.stringify(type)}`);
  } else {
    addCheck('pass', 'KYA-T01', `Credential type: ${type}`);
  }

  const rootCred = type === 'DelegationChain' ? cred.root : cred;
  const delegates = type === 'DelegationChain' ? (cred.delegates || []) : [];

  if (!rootCred) {
    addCheck('fail', 'KYA-R01', 'Root credential missing in DelegationChain');
  } else {
    // KYA-R01: agent_id
    if (rootCred.agent_id && typeof rootCred.agent_id === 'string')
      addCheck('pass', 'KYA-R01', 'Root agent_id present');
    else
      addCheck('fail', 'KYA-R01', 'Root agent_id missing or invalid');

    // KYA-R02: issuer DID
    if (rootCred.issuer && rootCred.issuer.startsWith('did:'))
      addCheck('pass', 'KYA-R02', `Root issuer DID valid: ${rootCred.issuer}`);
    else
      addCheck('fail', 'KYA-R02', 'Root issuer must be a DID (did:web:... or did:key:...)');

    // KYA-R03 + KYA-R04: validity window
    const iat = rootCred.issued_at, exp = rootCred.expires_at;
    if (typeof iat === 'number' && typeof exp === 'number') {
      if (exp <= now)
        addCheck('fail', 'KYA-R03', 'Root credential EXPIRED', `expired_at=${new Date(exp * 1000).toISOString()}, now=${new Date(now * 1000).toISOString()}`);
      else if (iat > now)
        addCheck('fail', 'KYA-R03', 'Root credential not yet valid (issued_at in future)');
      else {
        const ttlDays = Math.round((exp - now) / 86400);
        addCheck('pass', 'KYA-R03', `Root credential valid (expires in ${ttlDays} days)`);
      }
      const totalDays = Math.round((exp - iat) / 86400);
      if (totalDays > MAX_VALIDITY_DAYS)
        addCheck('warn', 'KYA-R04', `Root validity window ${totalDays} days exceeds KYA-OS recommended max ${MAX_VALIDITY_DAYS} days`);
      else
        addCheck('pass', 'KYA-R04', `Root validity window ${totalDays} days (within ${MAX_VALIDITY_DAYS}-day max)`);
    } else {
      addCheck('fail', 'KYA-R03', 'Root issued_at / expires_at missing or not Unix timestamps');
    }

    // KYA-R05: scopes
    if (Array.isArray(rootCred.scopes) && rootCred.scopes.length > 0) {
      const unknownScopes = rootCred.scopes.filter(s => !KYA_SCOPE_REGISTRY.has(s));
      if (unknownScopes.length > 0)
        addCheck('warn', 'KYA-R05', `Root has ${unknownScopes.length} non-standard scope(s): ${unknownScopes.join(', ')}`);
      else
        addCheck('pass', 'KYA-R05', `Root scopes valid: ${rootCred.scopes.join(', ')}`);
    } else {
      addCheck('fail', 'KYA-R05', 'Root scopes array missing or empty');
    }

    // KYA-R06: signature
    const VALID_SIG_PFX = ['ed25519:', 'es256:', 'rs256:'];
    if (rootCred.signature && VALID_SIG_PFX.some(p => rootCred.signature.toLowerCase().startsWith(p)))
      addCheck('pass', 'KYA-R06', `Root signature format valid (${rootCred.signature.split(':')[0]})`);
    else
      addCheck('warn', 'KYA-R06', 'Root signature missing or unrecognised format (expected ed25519:, ES256:, RS256:)');

    // KYA-EU1 + KYA-EU2: EU AI Act
    if (rootCred.eu_ai_act_risk_class) {
      const validClasses = ['unacceptable', 'high', 'limited', 'minimal'];
      if (!validClasses.includes(rootCred.eu_ai_act_risk_class))
        addCheck('warn', 'KYA-EU1', `eu_ai_act_risk_class "${rootCred.eu_ai_act_risk_class}" not in KYA-OS vocabulary`);
      else if (rootCred.eu_ai_act_risk_class === 'high') {
        addCheck('warn', 'KYA-EU1', 'High-risk AI system classification — EU AI Act conformity assessment required (Art. 6/Art. 10)');
        const highRiskScopes = (rootCred.scopes || []).filter(s => EU_AI_ACT_HIGH_RISK_SCOPES.has(s));
        if (highRiskScopes.length > 0)
          addCheck('warn', 'KYA-EU2', `High-risk scopes detected (${highRiskScopes.join(', ')}) — require human-oversight capability per EU AI Act Art. 14`);
      } else {
        addCheck('pass', 'KYA-EU1', `EU AI Act risk class: ${rootCred.eu_ai_act_risk_class}`);
      }
    } else {
      addCheck('warn', 'KYA-EU1', 'eu_ai_act_risk_class absent — mandatory under KYA-OS for EU deployment');
    }
  }

  // Delegation chain checks
  if (delegates.length > 0) {
    const maxDepth = Math.max(...delegates.map(d => d.depth || 0));
    if (maxDepth > MAX_CHAIN_DEPTH)
      addCheck('fail', 'KYA-D01', `Chain depth ${maxDepth} exceeds KYA-OS cap of ${MAX_CHAIN_DEPTH}`);
    else
      addCheck('pass', 'KYA-D01', `Delegation depth ${maxDepth} within cap (max ${MAX_CHAIN_DEPTH})`);

    const rootScopes = new Set(rootCred?.scopes || []);
    const scopeViolations = [];
    for (const d of delegates) {
      const parentScopesArr = d.depth === 1
        ? (rootCred?.scopes || [])
        : (delegates.find(p => p.agent_id === d.delegated_by)?.scopes || []);
      const parentScopes = new Set(parentScopesArr);
      const excess = (d.scopes || []).filter(s => !parentScopes.has(s));
      if (excess.length > 0) scopeViolations.push(`${d.agent_id}: ${excess.join(',')}`);
    }
    if (scopeViolations.length > 0)
      addCheck('fail', 'KYA-D02', 'Scope escalation violation — delegate claims scopes not in parent', scopeViolations.join(' | '));
    else
      addCheck('pass', 'KYA-D02', 'All delegate scopes contained within parent scopes (no escalation)');

    const expiredDelegates = delegates.filter(d => typeof d.expires_at === 'number' && d.expires_at <= now).map(d => d.agent_id);
    if (expiredDelegates.length > 0)
      addCheck('fail', 'KYA-D03', `${expiredDelegates.length} delegate(s) expired`, expiredDelegates.join(', '));
    else
      addCheck('pass', 'KYA-D03', 'All delegates within validity window');

    const unsignedDelegates = delegates.filter(d => !d.signature || !VALID_SIG_PFX.some(p => d.signature.toLowerCase().startsWith(p)));
    if (unsignedDelegates.length > 0)
      addCheck('warn', 'KYA-D04', `${unsignedDelegates.length} delegate(s) missing valid signature`, unsignedDelegates.map(d => d.agent_id).join(', '));
    else
      addCheck('pass', 'KYA-D04', 'All delegates have valid signature format');
  }

  const overallStatus = fail > 0 ? 'fail' : warn > 0 ? 'warn' : 'pass';
  const allScopes = Array.from(new Set([...(rootCred?.scopes || []), ...delegates.flatMap(d => d.scopes || [])]));

  const output_payload = {
    overall_status: overallStatus,
    pass, fail, warn,
    checks: checks.map(c => ({ code: c.code, status: c.status })),
    root_agent_id: rootCred?.agent_id || null,
    scopes: allScopes,
  };

  const compliance_flags = fail > 0 ? ['KYA_ATTESTATION_FAILED']
    : warn > 0 ? ['KYA_ATTESTED_WITH_WARNINGS']
    : ['KYA_FULLY_ATTESTED'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: 'compliance_mandate',
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

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'compliance_mandate' };
