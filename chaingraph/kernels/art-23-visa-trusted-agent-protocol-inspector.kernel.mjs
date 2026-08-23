import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-23-visa-trusted-agent-protocol-inspector';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'inspect_visa_tap_signature',
  mandate_type: 'compliance_control',
  gpu: false,
};

function parseSigInput(line) {
  if (!line) return null;
  line = line.replace(/^signature-input:\s*/i, '').trim();
  const m = line.match(/^([A-Za-z0-9_-]+)\s*=\s*\(([^)]*)\)(.*)/);
  if (!m) return null;
  const comps = (m[2].match(/"[^"]*"/g) || []).map(s => s.replace(/"/g, ''));
  const params = {};
  const re = /;\s*([A-Za-z0-9_-]+)=("?)([^;"]*)\2/g;
  let pm;
  while ((pm = re.exec(m[3]))) params[pm[1]] = pm[3];
  return { label: m[1], comps, params };
}

function inspect(siRaw, sigRaw) {
  const findings = [];

  if (!siRaw || !siRaw.trim()) {
    findings.push({ level: 'error', msg: 'No Signature-Input provided.', weight: 2 });
    return { findings, parsed_label: null, parsed_params: null };
  }

  const si = parseSigInput(siRaw);
  if (!si) {
    findings.push({ level: 'error', msg: 'Could not parse Signature-Input.', weight: 2 });
    return { findings, parsed_label: null, parsed_params: null };
  }

  findings.push({ level: 'pass', msg: `Parsed signature "${si.label}" with ${si.comps.length} covered component(s).`, weight: 2 });

  const p = si.params;

  if (p.tag && /trusted-agent|agent/i.test(p.tag)) {
    findings.push({ level: 'pass', msg: `Agent-recognition tag present (tag="${p.tag}").`, weight: 1 });
  } else {
    findings.push({ level: 'warn', msg: 'No agent-recognition tag — TAP signatures carry a tag identifying the agent-recognition purpose.', weight: 1 });
  }

  if (!('created' in p)) {
    findings.push({ level: 'error', msg: 'No "created" timestamp — required for freshness/replay protection.', weight: 1 });
  } else {
    findings.push({ level: 'pass', msg: `created = ${p.created}.`, weight: 1 });
  }

  if ('expires' in p) {
    findings.push({ level: 'pass', msg: `expires ${p.expires} declared — bounded validity window.`, weight: 1 });
  } else {
    findings.push({ level: 'warn', msg: 'No "expires" — set a short window to limit replay.', weight: 1 });
  }

  if (!('nonce' in p)) {
    findings.push({ level: 'warn', msg: 'No "nonce" / session id — TAP uses a unique session id to prevent replay.', weight: 1 });
  } else {
    findings.push({ level: 'pass', msg: `nonce/session id present ("${p.nonce}").`, weight: 1 });
  }

  if (!('keyid' in p)) {
    findings.push({ level: 'error', msg: 'No "keyid" — the verifier needs it to select the agent\'s public key.', weight: 1 });
  } else {
    findings.push({ level: 'pass', msg: `keyid = "${p.keyid}".`, weight: 1 });
  }

  if (!('alg' in p)) {
    findings.push({ level: 'info', msg: 'No explicit "alg" — TAP/Web Bot Auth use ed25519.', weight: 2 });
  } else if (String(p.alg).toLowerCase() !== 'ed25519') {
    findings.push({ level: 'warn', msg: `alg "${p.alg}" — Web Bot Auth-aligned TAP expects ed25519.`, weight: 2 });
  } else {
    findings.push({ level: 'pass', msg: 'alg = ed25519.', weight: 2 });
  }

  const lc = si.comps.map(c => c.toLowerCase());
  if (!lc.includes('@method') || (!lc.includes('@authority') && !lc.includes('@target-uri'))) {
    findings.push({ level: 'warn', msg: 'Covered components should bind @method and the target (@authority/@path or @target-uri).', weight: 2 });
  } else {
    findings.push({ level: 'pass', msg: 'Request binding present (method + target).', weight: 2 });
  }

  if (!sigRaw || !sigRaw.trim()) {
    findings.push({ level: 'warn', msg: 'No Signature header provided.', weight: 2 });
  } else {
    const sm = sigRaw.replace(/^signature:\s*/i, '').trim().match(/^([A-Za-z0-9_-]+)\s*=\s*:([^:]*):/);
    if (!sm) {
      findings.push({ level: 'error', msg: 'Could not parse Signature (expected label=:base64:).', weight: 2 });
    } else if (sm[1] !== si.label) {
      findings.push({ level: 'error', msg: `Signature label "${sm[1]}" ≠ Signature-Input label "${si.label}".`, weight: 2 });
    } else {
      findings.push({ level: 'pass', msg: 'Signature label matches (crypto verification out of scope).', weight: 2 });
    }
  }

  return { findings, parsed_label: si.label, parsed_params: p };
}

export function compute(pp) {
  const siRaw = (pp.signature_input ?? '').toString();
  const sigRaw = (pp.signature ?? '').toString();

  const { findings, parsed_label, parsed_params } = inspect(siRaw, sigRaw);

  let errors = 0, warnings = 0, passes = 0;
  for (const f of findings) {
    if (f.level === 'error') errors++;
    else if (f.level === 'warn') warnings++;
    else if (f.level === 'pass') passes++;
  }

  let score = 100 - errors * 15 - warnings * 4;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  const verdict = score >= 85 ? 'TAP_READY' : score >= 60 ? 'PARTIAL' : 'NOT_READY';

  const compliance_flags = [];
  compliance_flags.push('TAP_SIGNATURE_INSPECTED');
  if (errors === 0) compliance_flags.push('TAP_SIGNATURE_VALID');
  if (errors > 0) compliance_flags.push('TAP_SIGNATURE_INVALID');
  if (!!(parsed_params?.tag && /trusted-agent|agent/i.test(parsed_params.tag))) compliance_flags.push('HAS_AGENT_TAG');
  if (!!(parsed_params?.keyid)) compliance_flags.push('HAS_KEYID');
  if (!!(parsed_params?.nonce)) compliance_flags.push('HAS_NONCE');
  if (!!(parsed_params?.expires)) compliance_flags.push('HAS_EXPIRES');
  if (parsed_params?.alg?.toLowerCase() === 'ed25519') compliance_flags.push('ALG_ED25519');

  const output_payload = { verdict, score, errors, warnings, passes, parsed_label, parsed_params, findings: findings.map(f => ({ level: f.level, msg: f.msg })) };
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
