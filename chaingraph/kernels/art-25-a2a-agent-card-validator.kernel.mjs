import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-25-a2a-agent-card-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_a2a_agent_card',
  mandate_type: 'compliance_control',
  gpu: false,
};

function isHttps(s) {
  return typeof s === 'string' && /^https:\/\//.test(s);
}

function lintCard(c) {
  const out = [];

  if (typeof c !== 'object' || c === null || Array.isArray(c)) {
    out.push({ level: 'error', msg: 'Agent card must be a JSON object.' });
    return out;
  }

  // Required string fields
  const missing = [];
  for (const k of ['name', 'description', 'url', 'version']) {
    if (!c[k] || typeof c[k] !== 'string') missing.push(k);
  }
  if (missing.length > 0) {
    for (const k of missing) out.push({ level: 'error', msg: `Missing required "${k}" (string).` });
  } else {
    out.push({ level: 'pass', msg: 'Core identity fields present (name, description, url, version).' });
  }

  // protocolVersion
  if (!('protocolVersion' in c)) {
    out.push({ level: 'warn', msg: 'No "protocolVersion" — A2A v1.0 cards declare it (e.g. "1.0").' });
  } else {
    out.push({ level: 'pass', msg: `protocolVersion = "${c.protocolVersion}".` });
  }

  // url https
  if (c.url && !isHttps(c.url)) {
    out.push({ level: 'warn', msg: '"url" should be https for a production agent endpoint.' });
  }

  // capabilities
  if (!('capabilities' in c)) {
    out.push({ level: 'warn', msg: 'No "capabilities" object — declare streaming / pushNotifications support.' });
  } else if (typeof c.capabilities !== 'object' || Array.isArray(c.capabilities)) {
    out.push({ level: 'error', msg: '"capabilities" must be an object.' });
  } else {
    out.push({ level: 'pass', msg: `capabilities present (streaming=${!!c.capabilities.streaming}, pushNotifications=${!!c.capabilities.pushNotifications}).` });
    const ext = c.capabilities.extensions;
    if (Array.isArray(ext) && ext.length > 0) {
      ext.forEach((e, i) => {
        if (!e || typeof e.uri !== 'string') out.push({ level: 'warn', msg: `capabilities.extensions[${i}] has no "uri".` });
      });
      const ap2 = ext.filter(e => e && typeof e.uri === 'string' && /ap2|payments/i.test(e.uri));
      const x402 = ext.filter(e => e && typeof e.uri === 'string' && /x402/i.test(e.uri));
      if (ap2.length) out.push({ level: 'pass', msg: `AP2 payments extension declared (${ap2[0].uri}).` });
      if (x402.length) out.push({ level: 'pass', msg: 'x402 extension declared.' });
      if (!ap2.length && !x402.length) out.push({ level: 'info', msg: `${ext.length} extension(s) declared — none recognised as AP2/x402.` });
    } else {
      out.push({ level: 'info', msg: 'No capabilities.extensions — declare AP2/x402 here if this agent transacts.' });
    }
  }

  // defaultInputModes / defaultOutputModes
  if (!Array.isArray(c.defaultInputModes)) out.push({ level: 'warn', msg: '"defaultInputModes" should be an array of media types.' });
  if (!Array.isArray(c.defaultOutputModes)) out.push({ level: 'warn', msg: '"defaultOutputModes" should be an array of media types.' });

  // skills
  if (!Array.isArray(c.skills) || c.skills.length === 0) {
    out.push({ level: 'error', msg: '"skills" must be a non-empty array — it is the agent\'s advertised capability surface.' });
  } else {
    out.push({ level: 'pass', msg: `${c.skills.length} skill(s) advertised.` });
    c.skills.forEach((s, i) => {
      for (const k of ['id', 'name', 'description']) {
        if (!s || !s[k]) out.push({ level: 'warn', msg: `skills[${i}] missing "${k}".` });
      }
      if (s && !Array.isArray(s.tags)) out.push({ level: 'info', msg: `skills[${i}] has no tags array (used for discovery).` });
    });
  }

  // provider
  if (c.provider && !c.provider.organization) {
    out.push({ level: 'warn', msg: '"provider" present but missing organization.' });
  }

  // signatures (Signed Agent Card)
  if (Array.isArray(c.signatures) && c.signatures.length > 0) {
    const ok = c.signatures.every(s => s && s.protected && s.signature);
    if (ok) {
      out.push({ level: 'pass', msg: `Signed Agent Card — ${c.signatures.length} JWS signature(s) present (crypto verification out of scope).` });
    } else {
      out.push({ level: 'error', msg: 'signatures present but a JWS entry is missing "protected" or "signature".' });
    }
  } else {
    out.push({ level: 'info', msg: 'Unsigned card. A2A v1.0 supports Signed Agent Cards (a "signatures" JWS array).' });
  }

  out.push({ level: 'info', msg: 'Serve this document at /.well-known/agent-card.json for discovery.' });

  return out;
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
  const card = pp.agent_card ?? pp;
  const findings = lintCard(card);
  const { score, errors, warnings, passes } = scoreOf(findings);

  const verdict = errors > 0 ? 'invalid' : warnings > 0 ? 'advisory' : 'valid';

  const hasAp2 = Array.isArray(card?.capabilities?.extensions) &&
    card.capabilities.extensions.some(e => e && /ap2|payments/i.test(e.uri ?? ''));
  const hasSigned = Array.isArray(card?.signatures) && card.signatures.length > 0;

  const compliance_flags = {
    A2A_AGENT_CARD_VALIDATED: true,
    CARD_VALID: verdict === 'valid',
    CARD_ADVISORY: verdict === 'advisory',
    CARD_INVALID: verdict === 'invalid',
    HAS_AP2_EXTENSION: hasAp2,
    HAS_SIGNED_CARD: hasSigned,
    HAS_SKILLS: Array.isArray(card?.skills) && card.skills.length > 0,
  };

  const output_payload = { verdict, score, errors, warnings, passes, has_ap2_extension: hasAp2, has_signed_card: hasSigned, findings: findings.map(f => ({ level: f.level, msg: f.msg })) };
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
