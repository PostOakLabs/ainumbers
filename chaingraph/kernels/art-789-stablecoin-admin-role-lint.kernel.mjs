import { executionHash } from './_hash.mjs';

// art-789-stablecoin-admin-role-lint — stablecoin token admin-role configuration linter.
// Pure decision kernel over ROLE LABELS ONLY: it never receives addresses, public keys or
// key material. Inputs are profile / holders / roles / minters / policy; outputs are
// separation-of-duties, key-concentration, issuance-allowance and capability findings.
// Profile semantics come from the pinned Circle stablecoin-evm and Paxos usdp-contracts
// snapshots (see research/STABLECOIN-ADMIN-ROLE-PIN-2026-10-30.md and the node shard's
// cited_clause_digest); rules without a pinned source are marked "caller-declared policy"
// in the finding cite text. No Solidity is copied — the lint logic is plain JS.
//
// DETERMINISM: compute() is a pure function of pp — no Date.now()/Math.random(), no
// network, no filesystem, no TextEncoder/atob/btoa/URL (guest-safe).

const TOOL_ID = 'art-789-stablecoin-admin-role-lint';
const TOOL_VERSION = '1.0.0';

// ---- profiles (fixed contract; distinctness rules per the pinned snapshots, rest
// caller-declared policy as the cite strings state) ----
const PROFILES = {
  fiattoken: {
    roles: ['owner', 'proxy_admin', 'master_minter', 'pauser', 'blacklister', 'rescuer'],
    critical: ['owner', 'proxy_admin', 'master_minter', 'pauser', 'blacklister', 'rescuer'],
    require_distinct: [
      ['owner', 'master_minter'],
      ['owner', 'proxy_admin'],
      ['master_minter', 'pauser'],
    ],
    cite: 'Circle stablecoin-evm (pinned commit fc85788b): Pausable.sol, Blacklistable.sol, Rescuable.sol, MasterMinter.sol, AdminUpgradeabilityProxy.sol',
    capabilities: { pause: 'pauser', freeze: 'blacklister', upgrade: 'proxy_admin' },
  },
  usdp: {
    roles: ['owner', 'pauser', 'asset_protection', 'supply_controller'],
    critical: ['owner', 'pauser', 'asset_protection', 'supply_controller'],
    require_distinct: [['owner', 'supply_controller']],
    cite: 'Paxos usdp-contracts (pinned commits 1af2c7f0 / 674ac104): PaxosTokenV2.sol setSupplyControl, pause, freeze, increaseSupply',
    capabilities: { pause: 'pauser', freeze: 'asset_protection', upgrade: null },
  },
  generic: {
    roles: [], // caller-declared: whatever the roles map contains
    critical: null, // all declared roles are critical
    require_distinct: [], // policy.require_distinct only
    cite: 'caller-declared policy',
    capabilities: { pause: 'pauser', freeze: 'blacklister', upgrade: 'proxy_admin' },
  },
};

// Refusal: any label that looks like an address, public key or private key is refused.
const ADDRESS_LIKE = [
  { name: 'evm_address', re: /0x[0-9a-fA-F]{20,}/ },
  { name: 'long_hex_key', re: /\b[0-9a-fA-F]{64,}\b/ },
  { name: 'base58_address', re: /\b[1-9A-HJ-NP-Za-km-z]{26,44}\b/ },
];

function labelIsKeyMaterial(label) {
  const s = String(label);
  for (const p of ADDRESS_LIKE) {
    if (p.re.test(s)) return p.name;
  }
  return null;
}

function isMultisig(holder) {
  if (!holder) return false;
  const kind = holder.kind;
  const threshold = Number(holder.threshold || 0);
  const signers = Number(holder.signers_count || 0);
  return (kind === 'multisig' || kind === 'timelock' || kind === 'hsm_service') && (threshold >= 2 || signers >= 2 || (threshold === 0 && signers === 0 && kind !== 'multisig'));
}

export function compute(pp) {
  pp = pp || {};

  const profileName = pp.profile;
  const holders = Array.isArray(pp.holders) ? pp.holders : [];
  const roles = pp.roles && typeof pp.roles === 'object' ? pp.roles : null;
  const minters = Array.isArray(pp.minters) ? pp.minters : [];
  const policy = pp.policy && typeof pp.policy === 'object' ? pp.policy : {};
  const compliance_flags = [];

  // ---- input validation ----
  if (!Object.hasOwn(PROFILES, profileName) || !roles || !Object.keys(roles).length || !holders.length) {
    compliance_flags.push('MALFORMED_INPUT_REFUSED');
    return {
      output_payload: {
        manual_review_required: true,
        verdict: 'REFUSED',
        reason: !Object.hasOwn(PROFILES, profileName)
          ? 'profile must be one of fiattoken, usdp, generic'
          : 'roles map and at least one holder are required',
        findings: [],
      },
      compliance_flags,
    };
  }

  for (const h of holders) {
    if (!h || typeof h !== 'object' || typeof h.label !== 'string' || !h.label) {
      compliance_flags.push('MALFORMED_INPUT_REFUSED');
      return {
        output_payload: {
          manual_review_required: true,
          verdict: 'REFUSED',
          reason: 'holders must be non-null objects with a label',
          findings: [],
        },
        compliance_flags,
      };
    }
  }

  // ---- refusal branch (role labels only, never key material) ----
  const refused = [];
  for (const h of holders) {
    const hit = h && h.label ? labelIsKeyMaterial(h.label) : null;
    if (hit) refused.push({ field: 'holders.label', kind: hit });
  }
  if (roles) {
    for (const rn of Object.keys(roles)) {
      const hit = roles[rn] != null ? labelIsKeyMaterial(roles[rn]) : null;
      if (hit) refused.push({ field: 'roles.' + rn, kind: hit });
    }
  }
  if (refused.length) {
    compliance_flags.push('MALFORMED_INPUT_REFUSED');
    return {
      output_payload: {
        manual_review_required: true,
        verdict: 'REFUSED',
        reason: 'holder or role values look like an address, public key or private key — this tool accepts role labels only',
        refused,
      },
      compliance_flags,
    };
  }

  const prof = PROFILES[profileName];
  if (profileName !== 'generic') {
    const missingRoles = prof.roles.filter((r) => roles[r] == null);
    if (missingRoles.length > 0) {
      compliance_flags.push('MALFORMED_INPUT_REFUSED');
      return {
        output_payload: {
          manual_review_required: true,
          verdict: 'REFUSED',
          reason: 'partial role map: missing required roles (' + missingRoles.join(', ') + ')',
          findings: [],
        },
        compliance_flags,
      };
    }
  }

  if (profileName === 'generic') {
    const badRoleNames = Object.keys(roles).filter((r) => !r.trim());
    if (badRoleNames.length > 0) {
      compliance_flags.push('MALFORMED_INPUT_REFUSED');
      return {
        output_payload: {
          manual_review_required: true,
          verdict: 'REFUSED',
          reason: 'role names must be non-empty, non-whitespace labels',
          findings: [],
        },
        compliance_flags,
      };
    }
  }

  const holderByLabel = new Map();
  for (const h of holders) holderByLabel.set(String(h.label), h);

  const declaredRoles = profileName === 'generic'
    ? Object.keys(roles).filter((r) => roles[r] != null)
    : prof.roles;
  const criticalSet = new Set(profileName === 'generic' ? declaredRoles : prof.critical);

  const distinctPairs = [];
  const seenPair = new Set();
  const addPair = (a, b, cite) => {
    const k = [a, b].sort().join('|');
    if (!seenPair.has(k)) { seenPair.add(k); distinctPairs.push({ pair: [a, b], cite }); }
  };
  if (profileName !== 'generic') {
    for (const [a, b] of prof.require_distinct) addPair(a, b, prof.cite);
  }
  const policyDistinct = Array.isArray(policy.require_distinct) ? policy.require_distinct : [];
  for (const pair of policyDistinct) {
    if (Array.isArray(pair) && pair.length === 2) addPair(String(pair[0]), String(pair[1]), 'caller-declared policy (require_distinct)');
  }

  const findings = [];
  const pushFinding = (domain, severity, message, cite) => {
    findings.push({ domain, severity, message, cite });
  };

  if (profileName !== 'generic') {
    const unknownRoles = Object.keys(roles).filter((r) => !prof.roles.includes(r));
    for (const ur of unknownRoles) {
      pushFinding('roles', 'warn', 'unknown or misspelled role "' + ur + '" in roles map', prof.cite);
    }
  }

  // ---- separation: distinctness pairs held by the same label ----
  const separation = { checked_pairs: [], violations: [] };
  for (const { pair, cite } of distinctPairs) {
    const a = roles[pair[0]];
    const b = roles[pair[1]];
    if (a == null || b == null) continue; // pair not configured in this token
    const violated = String(a) === String(b);
    separation.checked_pairs.push({ pair, holder: String(a), violated });
    if (violated) {
      pushFinding('separation', 'fail', 'roles "' + pair[0] + '" and "' + pair[1] + '" are held by the same label "' + String(a) + '"', cite);
      separation.violations.push({ pair, holder: String(a), cite });
    }
  }

  // ---- concentration: multi-role labels and single-signer critical holders ----
  const labelRoleCount = new Map();
  for (const rn of declaredRoles) {
    const lbl = roles[rn];
    if (lbl == null) continue;
    const held = labelRoleCount.get(String(lbl)) || [];
    held.push(rn);
    labelRoleCount.set(String(lbl), held);
  }
  const concentration = { multi_role_labels: [], single_signer_critical: [] };
  for (const lbl of labelRoleCount.keys()) {
    const held = labelRoleCount.get(lbl);
    if (held.length > 1 && held.filter((r) => criticalSet.has(r)).length > 1) {
      concentration.multi_role_labels.push({ label: lbl, roles: held });
      const severity = held.length >= 3 ? 'fail' : 'warn';
      pushFinding('concentration', severity, 'label "' + lbl + '" holds ' + held.length + ' critical roles (' + held.join(', ') + ')', prof.cite);
    }
    for (const rn of held) {
      if (!criticalSet.has(rn)) continue;
      const h = holderByLabel.get(lbl);
      const singleSigner = h && (h.kind === 'eoa' || (Number(h.signers_count || 0) === 1 && !h.threshold));
      if (singleSigner) {
        concentration.single_signer_critical.push({ label: lbl, role: rn, kind: h.kind });
        pushFinding('concentration', 'warn', 'critical role "' + rn + '" held by single-signer "' + lbl + '" (kind ' + String(h.kind) + ')', 'caller-declared policy (key concentration)');
      }
    }
  }

  // ---- issuance: allowance breaches ----
  const maxSingle = policy.max_single_minter_allowance_minor;
  const maxTotal = policy.max_total_allowance_minor;
  const issuance = { per_minter: [], total_breach: null };
  let total = 0;
  for (const m of minters) {
    const allow = Number(m && m.allowance_minor || 0);
    total += allow;
    const overSingle = maxSingle != null && allow > Number(maxSingle);
    issuance.per_minter.push({ holder_label: String(m && m.holder_label), allowance_minor: allow, over_single_ceiling: overSingle });
    if (overSingle) {
      pushFinding('issuance', 'fail', 'minter "' + String(m && m.holder_label) + '" allowance ' + allow + ' exceeds single-minter ceiling ' + Number(maxSingle), 'caller-declared policy (max_single_minter_allowance_minor)');
    }
  }
  if (maxTotal != null && total > Number(maxTotal)) {
    issuance.total_breach = { total_allowance_minor: total, ceiling: Number(maxTotal) };
    pushFinding('issuance', 'fail', 'total minter allowance ' + total + ' exceeds policy ceiling ' + Number(maxTotal), 'caller-declared policy (max_total_allowance_minor)');
  }

  // ---- capabilities: pause / freeze / upgrade existence and holders ----
  const capabilities = { pause: null, freeze: null, upgrade: null };
  for (const cap of Object.keys(capabilities)) {
    const roleName = prof.capabilities[cap];
    if (!roleName) { capabilities[cap] = { exists: false }; continue; }
    const present = declaredRoles.indexOf(roleName) !== -1 && roles[roleName] != null;
    capabilities[cap] = { exists: present, role: roleName, holder: present ? String(roles[roleName]) : null };
  }

  // ---- require_multisig_for ----
  const requireMultisig = Array.isArray(policy.require_multisig_for) ? policy.require_multisig_for : [];
  for (const rn of requireMultisig) {
    const lbl = roles[rn];
    if (lbl == null) continue;
    const h = holderByLabel.get(String(lbl));
    if (!isMultisig(h)) {
      pushFinding('multisig', 'fail', 'role "' + rn + '" requires a multisig holder but "' + String(lbl) + '" is kind ' + String(h && h.kind) + ' with threshold ' + String(h && h.threshold) + ' signers ' + String(h && h.signers_count), 'caller-declared policy (require_multisig_for)');
    }
  }

  const failCount = findings.filter((f) => f.severity === 'fail').length;
  const warnCount = findings.filter((f) => f.severity === 'warn').length;
  const verdict = failCount > 0 ? 'FAIL' : warnCount > 0 ? 'PASS_WITH_FINDINGS' : 'PASS';

  if (failCount > 0) compliance_flags.push('FAIL_ADMIN_ROLE_FINDINGS');
  if (warnCount > 0) compliance_flags.push('WARN_ADMIN_ROLE_FINDINGS');
  // The verdict flag is raised only when the lint found something to carry (FAIL or
  // PASS_WITH_FINDINGS); a clean PASS carries no flag. manual_review_required mirrors
  // the flag set into the payload (AUTHORING-STANDARD section 2).
  if (verdict !== 'PASS') compliance_flags.push('VERDICT_' + verdict);

  const output_payload = {
    manual_review_required: verdict !== 'PASS',
    verdict,
    profile: profileName,
    separation,
    concentration,
    issuance,
    capabilities,
    findings,
    fail_count: failCount,
    warn_count: warnCount,
  };

  return { output_payload, compliance_flags };
}

// ── hashability walk (D6) ────────────────────────────────────────────────────────
// Mirrors the classes _hash.mjs assertIJson() refuses before canonicalizing: a non-finite
// number or an integer outside the 2^53 safe range, a BigInt, nesting past its MAX_DEPTH,
// more values than its MAX_ELEMENTS. Reports { reason, detail } with the path and kind only,
// never the value; null when the subtree is safe to hash. The shared _hash.mjs stays untouched.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (typeof v === 'bigint') return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': bigint' };
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  // The object walked below is the exact execution_hash preimage. When the shared
  // canonicalizer would refuse it, mint the artifact with a null execution_hash and the
  // reason beside it instead of letting the hash throw (D6).
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const hash = unhashable === null ? await executionHash(pp, output_payload) : null;
  const artifact = {
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'lint_stablecoin_admin_roles', mandate_type: 'compliance_control', gpu: false };
