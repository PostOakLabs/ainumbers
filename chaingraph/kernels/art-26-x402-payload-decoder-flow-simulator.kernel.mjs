import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-26-x402-payload-decoder-flow-simulator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'simulate_x402_flow',
  mandate_type: 'compliance_control',
  gpu: false,
};

const KNOWN_SCHEMES = ['exact', 'upto'];
const KNOWN_NETWORKS = ['base', 'base-sepolia', 'polygon', 'arbitrum', 'solana', 'world', 'avalanche'];

// Lenient UTF-8 decode matching Node's `Buffer.toString('utf8')` -- substitutes
// U+FFFD for any ill-formed byte sequence instead of throwing (non-fatal, unlike
// TextDecoder's default). Byte-range table per the WHATWG Encoding Standard.
function _decodeUtf8Lenient(bytes) {
  var out = '';
  var i = 0;
  var n = bytes.length;
  while (i < n) {
    var b0 = bytes[i];
    if (b0 < 0x80) { out += String.fromCharCode(b0); i += 1; continue; }
    var need, cp, lo1, hi1;
    if (b0 >= 0xc2 && b0 <= 0xdf) { need = 1; cp = b0 & 0x1f; lo1 = 0x80; hi1 = 0xbf; }
    else if (b0 === 0xe0) { need = 2; cp = b0 & 0x0f; lo1 = 0xa0; hi1 = 0xbf; }
    else if (b0 >= 0xe1 && b0 <= 0xec) { need = 2; cp = b0 & 0x0f; lo1 = 0x80; hi1 = 0xbf; }
    else if (b0 === 0xed) { need = 2; cp = b0 & 0x0f; lo1 = 0x80; hi1 = 0x9f; }
    else if (b0 >= 0xee && b0 <= 0xef) { need = 2; cp = b0 & 0x0f; lo1 = 0x80; hi1 = 0xbf; }
    else if (b0 === 0xf0) { need = 3; cp = b0 & 0x07; lo1 = 0x90; hi1 = 0xbf; }
    else if (b0 >= 0xf1 && b0 <= 0xf3) { need = 3; cp = b0 & 0x07; lo1 = 0x80; hi1 = 0xbf; }
    else if (b0 === 0xf4) { need = 3; cp = b0 & 0x07; lo1 = 0x80; hi1 = 0x8f; }
    else { out += '�'; i += 1; continue; }
    var ok = (i + need < n);
    if (ok) {
      for (var k = 1; k <= need && ok; k++) {
        var bk = bytes[i + k];
        var lo = (k === 1) ? lo1 : 0x80;
        var hi = (k === 1) ? hi1 : 0xbf;
        if (bk < lo || bk > hi) { ok = false; break; }
        cp = (cp << 6) | (bk & 0x3f);
      }
    }
    if (!ok) { out += '�'; i += 1; continue; }
    if (cp <= 0xffff) { out += String.fromCharCode(cp); }
    else {
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
    i += need + 1;
  }
  return out;
}

function tryBase64Decode(s) {
  // Strip header prefix if present
  s = s.trim().replace(/^[A-Za-z0-9-]+:\s*/, '');
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  try {
    // The zkVM guest never provides `Buffer` (confirmed via the chaingraph/vm
    // QuickJS-ng harness, SILENT-DEGRADE-FIX-1-2026-08-14: the unconditional
    // `Buffer.from` call threw ReferenceError, caught by this function's own
    // try/catch, silently returning null for every base64 input on the guest --
    // even genuinely valid x402 payloads -- which downstream reports as "Could
    // not decode input" instead of the correct decoded verdict). `atob` IS
    // available on the guest (art-124 precedent); take that branch first.
    if (globalThis.atob) {
      var bin = globalThis.atob(s);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return _decodeUtf8Lenient(bytes);
    }
    return Buffer.from(s, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function detectKind(obj) {
  if (!obj || typeof obj !== 'object') return 'unknown';
  if (Array.isArray(obj.accepts) || obj.error !== undefined) return 'PaymentRequired';
  if (obj.scheme && obj.payload) return 'PaymentPayload';
  if (obj.success !== undefined || obj.transaction !== undefined) return 'PaymentResponse';
  return 'unknown';
}

function lintPayload(obj) {
  const findings = [];

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    findings.push({ level: 'error', msg: 'PaymentPayload must be a JSON object.' });
    return findings;
  }

  if (!('x402Version' in obj)) {
    findings.push({ level: 'warn', msg: 'Missing "x402Version".' });
  } else if (typeof obj.x402Version !== 'number') {
    findings.push({ level: 'warn', msg: '"x402Version" is conventionally a number.' });
  } else {
    findings.push({ level: 'pass', msg: 'x402Version present.' });
  }

  if (!obj.scheme) {
    findings.push({ level: 'error', msg: 'Missing "scheme".' });
  } else if (!KNOWN_SCHEMES.includes(obj.scheme)) {
    findings.push({ level: 'warn', msg: `scheme "${obj.scheme}" not recognised (${KNOWN_SCHEMES.join(', ')}).` });
  } else {
    findings.push({ level: 'pass', msg: `scheme "${obj.scheme}" recognised.` });
  }

  if (!obj.network) {
    findings.push({ level: 'error', msg: 'Missing "network".' });
  } else if (!KNOWN_NETWORKS.includes(obj.network)) {
    findings.push({ level: 'warn', msg: `network "${obj.network}" not in known set — verify facilitator support.` });
  } else {
    findings.push({ level: 'pass', msg: `network "${obj.network}" recognised.` });
  }

  if (!obj.payload || typeof obj.payload !== 'object') {
    findings.push({ level: 'error', msg: 'Missing "payload" object (scheme-specific).' });
  } else {
    const p = obj.payload;
    if (!p.signature) {
      findings.push({ level: 'warn', msg: 'payload.signature missing.' });
    } else {
      findings.push({ level: 'pass', msg: 'payload.signature present.' });
    }
    if (obj.scheme === 'exact') {
      findings.push({ level: 'info', msg: 'exact-EVM authorization fields below are ILLUSTRATIVE (EIP-3009 style).' });
      const a = p.authorization;
      if (!a || typeof a !== 'object') {
        findings.push({ level: 'warn', msg: 'payload.authorization missing.' });
      } else {
        for (const k of ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce']) {
          if (a[k] === undefined) findings.push({ level: 'warn', msg: `payload.authorization.${k} missing (illustrative EIP-3009 field).` });
        }
        if (a.validAfter !== undefined && a.validBefore !== undefined) {
          const va = Number(a.validAfter), vb = Number(a.validBefore);
          if (!isNaN(va) && !isNaN(vb) && vb <= va) {
            findings.push({ level: 'error', msg: 'authorization.validBefore must be greater than validAfter.' });
          }
        }
        if (a.value !== undefined && !/^\d+$/.test(String(a.value))) {
          findings.push({ level: 'warn', msg: 'authorization.value should be an integer string.' });
        }
      }
    }
  }

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
  const input = (pp.header_or_payload ?? pp.payload ?? '').toString().trim();

  // Try to detect if it's JSON directly or base64-encoded
  let obj = null;
  let is_json = false;
  let decoded_type = 'unknown';
  let mode = 'decode';
  let findings = [];
  let score = null;

  // First try direct JSON parse
  try {
    obj = JSON.parse(input);
    is_json = true;
  } catch {
    // Try base64 decode
    const decoded = tryBase64Decode(input);
    if (decoded) {
      try {
        obj = JSON.parse(decoded);
        is_json = true;
      } catch { /* non-JSON base64 */ }
    }
  }

  if (obj) {
    decoded_type = detectKind(obj);
    // If it's a PaymentPayload, lint it
    if (decoded_type === 'PaymentPayload') {
      mode = 'lint';
      findings = lintPayload(obj);
    } else {
      // Just decode mode
      mode = 'decode';
      findings = [];
    }
  } else {
    findings = [{ level: 'error', msg: 'Could not decode input — provide a base64 x402 header or PaymentPayload JSON.' }];
  }

  let errors = 0, warnings = 0, passes = 0;
  for (const f of findings) {
    if (f.level === 'error') errors++;
    else if (f.level === 'warn') warnings++;
    else if (f.level === 'pass') passes++;
  }

  score = 100 - errors * 15 - warnings * 4;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  const compliance_flags = ['X402_PAYLOAD_PROCESSED'];
  if (is_json) compliance_flags.push('X402_DECODE_OK');
  if (errors === 0 && is_json) compliance_flags.push('X402_PAYLOAD_VALID');
  if (obj?.scheme) compliance_flags.push('HAS_SCHEME');
  if (obj?.network) compliance_flags.push('HAS_NETWORK');
  if (obj?.scheme && KNOWN_SCHEMES.includes(obj.scheme)) compliance_flags.push('SCHEME_KNOWN');
  if (obj?.network && KNOWN_NETWORKS.includes(obj.network)) compliance_flags.push('NETWORK_KNOWN');

  const output_payload = { decoded_type, mode, is_json, score, errors, warnings, passes, scheme: obj?.scheme ?? null, network: obj?.network ?? null, has_accepts: !!(obj && Array.isArray(obj.accepts)), findings: findings.map(f => ({ level: f.level, msg: f.msg })) };
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
