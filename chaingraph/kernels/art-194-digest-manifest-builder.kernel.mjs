import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID = 'art-194-digest-manifest-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_digest_manifest',
  mandate_type: 'cryptographic_mandate', gpu: false,
};

// Binds N file digests into one canonical, hash-anchored manifest. manifest_sha256
// is SHA-256 over the JCS-canonical sorted entries array. This BUILDS flat
// manifests (no tree), which is distinct from verify_merkle_batch (cry-04, which
// verifies Merkle PROOFS); BrowserChain's log owns Merkle trees. Also serves the
// plain checksum-tool use case. Zero network, zero PII.

const HEX64 = /^[0-9a-f]{64}$/;
const finiteOrNull = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Deterministic code-unit comparison (matches JCS key ordering discipline).
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function basename(v) {
  const s = String(v || '');
  const cut = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  return cut >= 0 ? s.slice(cut + 1) : s;
}

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(String(str));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function compute(pp) {
  const entriesIn = Array.isArray(pp?.entries) ? pp.entries : [];
  const purpose = typeof pp?.purpose === 'string' ? pp.purpose : '';
  const sort = pp?.sort === 'digest' ? 'digest' : 'name';

  const checks = [];
  const push = (check, pass, detail) => checks.push({ check, pass, detail });

  const nameSeen = Object.create(null);
  const digestSeen = Object.create(null);
  const dupNames = [];
  const dupDigests = [];
  const malformed = [];
  const pathLike = [];

  const entries = entriesIn.map((e, idx) => {
    const rawName = String(e?.name || '');
    let name = rawName;
    if (rawName.includes('/') || rawName.includes('\\')) {
      pathLike.push(rawName);
      name = basename(rawName);
    }
    const sha256 = String(e?.sha256 || '').trim().toLowerCase();
    if (!HEX64.test(sha256)) malformed.push(name || `entry_${idx + 1}`);
    if (name) { if (nameSeen[name]) dupNames.push(name); nameSeen[name] = (nameSeen[name] || 0) + 1; }
    if (HEX64.test(sha256)) { if (digestSeen[sha256]) dupDigests.push(sha256); digestSeen[sha256] = (digestSeen[sha256] || 0) + 1; }

    const entry = { name, sha256 };
    const bytes = finiteOrNull(e?.bytes);
    if (bytes !== null) entry.bytes = bytes;
    if (typeof e?.media_type === 'string' && e.media_type) entry.media_type = e.media_type;
    return entry;
  });

  // Deterministic sort by chosen key, with name as a stable tiebreaker.
  entries.sort((a, b) => sort === 'digest'
    ? (cmp(a.sha256, b.sha256) || cmp(a.name, b.name))
    : (cmp(a.name, b.name) || cmp(a.sha256, b.sha256)));

  push('all_digests_64_hex', malformed.length === 0,
    malformed.length ? `malformed hex digest for: ${malformed.join(', ')}` : 'all digests are 64 hex');
  push('no_duplicate_names', dupNames.length === 0,
    dupNames.length ? `duplicate name(s): ${[...new Set(dupNames)].join(', ')}` : 'no duplicate names');
  push('no_duplicate_digests', dupDigests.length === 0,
    dupDigests.length ? `duplicate digest(s) present (${[...new Set(dupDigests)].length})` : 'no duplicate digests');
  push('no_path_like_names', pathLike.length === 0,
    pathLike.length ? `path-like name(s) flagged and basenamed: ${pathLike.join(', ')}` : 'no path-like names');

  const allHaveBytes = entries.length > 0 && entries.every((e) => typeof e.bytes === 'number');
  const total_bytes = allHaveBytes ? entries.reduce((s, e) => s + e.bytes, 0) : null;

  const manifest_sha256 = await sha256Hex(JSON.stringify(cgCanon(entries)));

  const manifest = {
    manifest_version: '1.0',
    purpose,
    entry_count: entries.length,
    total_bytes,
    sort,
    entries,
    manifest_sha256,
  };

  const all_checks_pass = checks.every((c) => c.pass);
  const compliance_flags = { DIGEST_MANIFEST_BUILT: true };
  compliance_flags[all_checks_pass ? 'MANIFEST_CHECKS_PASS' : 'MANIFEST_CHECKS_HAVE_WARNINGS'] = true;
  if (dupDigests.length) compliance_flags.DUPLICATE_DIGESTS_FLAGGED = true;

  return {
    output_payload: { manifest, checks, all_checks_pass },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
