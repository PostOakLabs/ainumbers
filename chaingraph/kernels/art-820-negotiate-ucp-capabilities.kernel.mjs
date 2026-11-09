import { executionHash } from './_hash.mjs';

// art-820-negotiate-ucp-capabilities — UCP capability negotiation (verify-only).
// compute(pp) takes two PASTED UCP profiles (business + platform) and decides which
// capabilities the two parties can agree on: intersect by name, select the highest
// mutual dated version per capability, apply extension `requires` bounds, prune
// orphaned extensions to a fixpoint, and report profile-shape findings. Verify-only:
// it never fetches profiles, leaf documents, or schemas — every decision comes from
// the two pasted objects, so discovery, schema fetch, and schema-composition steps
// are out of scope by input.
//
// DETERMINISM: compute() is a pure function of pp — no Date.now()/Math.random(), no
// network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, which
// is a STRICT SUBSET of a browser/Node global environment: TextEncoder/atob/btoa/URL
// are ALL ABSENT (chaingraph/kernels/check-guest-builtin-safety.mjs enforces this per
// kernel). Every iteration walks sorted keys, so object key order never affects the
// output (asserted by this kernel's proptest).

const TOOL_ID = 'art-820-negotiate-ucp-capabilities';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'negotiate_ucp_capabilities',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Protocol releases this kernel has semantics for. Dated release strings sort
// lexicographically in release order, so "highest version" is a plain string compare.
export const KNOWN_UCP_VERSIONS = ['2026-01-11', '2026-01-23', '2026-04-08', '2026-08-25'];

function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function isNonEmptyString(v) { return typeof v === 'string' && v.length > 0; }

// Shape gate for a dated release string (YYYY-MM-DD). Calendar-loose (month 01-12,
// day 01-31): every version this kernel compares has passed the same gate, so a
// per-month day table would not change any decision compute() makes.
function isWellFormedDate(s) {
  if (!isNonEmptyString(s) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const month = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function finding(code, severity, path, message) {
  return { code, severity, path, message };
}

// ---------- namespace authority binding ----------
// Deterministic ASCII host derivation from a schema URL: https scheme only, no
// userinfo, no IP-literal or single-label host, normalized (lower case, one
// trailing dot stripped, port dropped), labels reversed. A strict subset of full
// WHATWG parsing — hosts outside the A-label alphabet are REJECTED rather than
// punycoded, so the check can only over-reject, never silently accept a host that
// full parsing would have normalized differently. No URL constructor (absent in
// the zkVM guest).
function authorityPrefixFromSchemaUrl(url) {
  if (!isNonEmptyString(url)) return { ok: false, reason: 'schema_url_not_a_string' };
  if (!/^https:\/\//i.test(url)) return { ok: false, reason: 'schema_url_not_https' };
  let rest = url.slice(8);
  const authorityEnd = rest.search(/[/?#]/);
  if (authorityEnd !== -1) rest = rest.slice(0, authorityEnd);
  if (rest.includes('@')) return { ok: false, reason: 'schema_url_userinfo' };
  if (rest.startsWith('[')) return { ok: false, reason: 'schema_url_ip_literal' };
  const colon = rest.lastIndexOf(':');
  if (colon !== -1) rest = rest.slice(0, colon);
  const host = rest.toLowerCase().replace(/\.$/, '');
  if (host.length === 0) return { ok: false, reason: 'schema_url_empty_host' };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { ok: false, reason: 'schema_url_ip_literal' };
  const labels = host.split('.');
  if (labels.length < 2) return { ok: false, reason: 'schema_url_single_label_host' };
  const labelRe = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  for (const label of labels) {
    if (!labelRe.test(label)) return { ok: false, reason: 'schema_url_invalid_host_label' };
  }
  return { ok: true, prefix: labels.slice().reverse().join('.') };
}

// The name binds iff it equals the reversed-host prefix or extends it by whole
// labels (label-aligned prefix).
function namespaceBindingOk(name, prefix) {
  return name === prefix || name.startsWith(prefix + '.');
}

// ---------- profile shape ----------
// Refusal-grade violations (the object does not meet the profile contract) push an
// issue and stop; issues drive verdict INDETERMINATE + INPUT_REFUSED. Warning-grade
// shape findings (keys[] placement) ride along without changing the verdict.
function validateProfile(side, profile, findings, issues) {
  const path = side; // 'business_profile' | 'platform_profile'
  if (!isPlainObject(profile)) {
    issues.push({ code: 'profile_not_an_object', path, message: side + ' must be a JSON object' });
    return null;
  }
  if (!isPlainObject(profile.ucp)) {
    issues.push({ code: 'ucp_member_missing', path: path + '.ucp', message: 'a UCP profile requires a ucp object member' });
    return null;
  }
  const ucp = profile.ucp;
  for (const member of ['services', 'payment_handlers']) {
    if (!isPlainObject(ucp[member])) {
      issues.push({ code: 'ucp_member_not_an_object', path: `${path}.ucp.${member}`, message: `ucp.${member} must be present and an object (it may be empty)` });
      return null;
    }
  }
  if (!isNonEmptyString(ucp.version)) {
    issues.push({ code: 'ucp_version_missing', path: `${path}.ucp.version`, message: 'ucp.version must be a non-empty string' });
    return null;
  }
  if (!isWellFormedDate(ucp.version)) {
    issues.push({ code: 'version_not_well_formed', path: `${path}.ucp.version`, message: 'ucp.version must be a dated release in YYYY-MM-DD format; non-date version strings must not be advertised' });
    return null;
  }
  if (ucp.supported_versions !== undefined) {
    if (!isPlainObject(ucp.supported_versions)) {
      issues.push({ code: 'supported_versions_not_an_object', path: `${path}.ucp.supported_versions`, message: 'supported_versions must be an object mapping older protocol versions to leaf profile locations' });
      return null;
    }
    for (const key of Object.keys(ucp.supported_versions).sort()) {
      if (!isWellFormedDate(key)) {
        issues.push({ code: 'version_not_well_formed', path: `${path}.ucp.supported_versions.${key}`, message: 'supported_versions keys must be dated releases in YYYY-MM-DD format' });
        return null;
      }
    }
  }
  if (ucp.capabilities !== undefined && !isPlainObject(ucp.capabilities)) {
    issues.push({ code: 'capabilities_not_an_object', path: `${path}.ucp.capabilities`, message: 'ucp.capabilities must be an object mapping capability names to entry arrays' });
    return null;
  }
  // keys[] placement: the canonical key field is a top-level JWK Set array.
  // Negotiation never consumes keys, so placement problems are warning findings only.
  if (profile.keys !== undefined && !Array.isArray(profile.keys)) {
    findings.push(finding('keys_not_canonical_jwk_set', 'warning', `${path}.keys`, 'the canonical key field is a top-level keys array (JWK Set); this top-level keys member is not an array'));
  }
  if (ucp.keys !== undefined) {
    findings.push(finding('keys_outside_canonical_jwk_set', 'warning', `${path}.ucp.keys`, 'keys carried inside ucp are not the canonical top-level keys JWK Set field'));
  }
  if (profile.jwks !== undefined) {
    findings.push(finding('keys_outside_canonical_jwk_set', 'warning', `${path}.jwks`, 'keys carried in a jwks member are not the canonical top-level keys JWK Set field'));
  }
  return ucp;
}

// ---------- per-profile capability entries ----------
// Validates every entry and returns the usable ones. A rejected entry never
// participates in negotiation; its finding code is recorded per name so a name that
// ends up unusable reports the real cause instead of a bare "only in one profile".
function usableEntries(side, ucp, findings) {
  const path = side;
  const byName = new Map(); // name -> Map(version -> entry)
  const failures = new Map(); // name -> first finding code recorded for it
  const caps = ucp.capabilities || {};
  for (const name of Object.keys(caps).sort()) {
    const entries = caps[name];
    if (!Array.isArray(entries)) {
      const f = finding('capability_entries_not_an_array', 'error', `${path}.ucp.capabilities.${name}`, 'capability entries must be an array of version entries');
      findings.push(f);
      if (!failures.has(name)) failures.set(name, f.code);
      continue;
    }
    // Walk entries in version order (ties by original index) so finding order and
    // duplicate detection never depend on the pasted array order.
    const ordered = entries.map((e, i) => ({ e, i })).sort((a, b) => {
      const av = isPlainObject(a.e) && isNonEmptyString(a.e.version) ? a.e.version : '';
      const bv = isPlainObject(b.e) && isNonEmptyString(b.e.version) ? b.e.version : '';
      return av === bv ? a.i - b.i : (av < bv ? -1 : 1);
    });
    const seenVersions = new Map();
    let structurallyBroken = false;
    for (const { e } of ordered) {
      if (!isPlainObject(e) || !isNonEmptyString(e.version)) {
        const f = finding('capability_entry_malformed', 'error', `${path}.ucp.capabilities.${name}`, 'each capability entry must be an object carrying a version string');
        findings.push(f);
        if (!failures.has(name)) failures.set(name, f.code);
        structurallyBroken = true;
        continue;
      }
      if (!isWellFormedDate(e.version)) {
        const f = finding('capability_version_not_well_formed', 'error', `${path}.ucp.capabilities.${name}`, 'capability entry versions must be dated releases in YYYY-MM-DD format');
        findings.push(f);
        if (!failures.has(name)) failures.set(name, f.code);
        continue;
      }
      // Release-pinned namespace: a dev.ucp.* entry must declare the same version as
      // the profile's ucp.version, else it is treated as not present.
      if (name.startsWith('dev.ucp.') && e.version !== ucp.version) {
        const f = finding('dev_ucp_entry_version_mismatch', 'error', `${path}.ucp.capabilities.${name}`, 'a dev.ucp.* entry must declare the same version as the profile ucp.version; the entry is treated as not present');
        findings.push(f);
        if (!failures.has(name)) failures.set(name, f.code);
        continue;
      }
      if (e.schema !== undefined) {
        if (!isNonEmptyString(e.schema)) {
          const f = finding('schema_url_not_a_string', 'error', `${path}.ucp.capabilities.${name}`, 'the schema member must be a URL string');
          findings.push(f);
          if (!failures.has(name)) failures.set(name, f.code);
          continue;
        }
        const binding = authorityPrefixFromSchemaUrl(e.schema);
        if (!binding.ok) {
          const f = finding('namespace_authority_binding_failed', 'error', `${path}.ucp.capabilities.${name}`, `schema authority check failed (${binding.reason}); the entity is treated as not present`);
          findings.push(f);
          if (!failures.has(name)) failures.set(name, f.code);
          continue;
        }
        if (!namespaceBindingOk(name, binding.prefix)) {
          const f = finding('namespace_authority_binding_failed', 'error', `${path}.ucp.capabilities.${name}`, `reversed schema host "${binding.prefix}" is neither equal to nor a label-aligned prefix of the name "${name}"; the entity is treated as not present`);
          findings.push(f);
          if (!failures.has(name)) failures.set(name, f.code);
          continue;
        }
      }
      if (seenVersions.has(e.version)) {
        const f = finding('duplicate_capability_version_conflict', 'error', `${path}.ucp.capabilities.${name}`, `two entries declare version ${e.version}; the name is unusable in this profile`);
        findings.push(f);
        if (!failures.has(name)) failures.set(name, f.code);
        structurallyBroken = true;
        continue;
      }
      seenVersions.set(e.version, e);
    }
    if (!structurallyBroken && seenVersions.size > 0) byName.set(name, seenVersions);
  }
  return { byName, failures };
}

// Union of both profiles' extends declarations for a name's selected entries —
// a parent named by either side must survive for the extension to stay active.
function parentNames(pair, sideBiz, sidePlat, name, findings) {
  const out = [];
  const sources = [
    [pair.bizEntry, `${sideBiz}.ucp.capabilities.${name}`],
    [pair.platEntry, `${sidePlat}.ucp.capabilities.${name}`],
  ];
  for (const [entry, path] of sources) {
    const ex = entry ? entry.extends : undefined;
    if (ex === undefined) continue;
    if (typeof ex === 'string') {
      if (ex.length > 0) out.push(ex);
      else findings.push(finding('extends_malformed', 'warning', path, 'an extends member must be a non-empty capability name or an array of them'));
    } else if (Array.isArray(ex)) {
      for (const p of ex) {
        if (typeof p === 'string' && p.length > 0) out.push(p);
        else findings.push(finding('extends_malformed', 'warning', path, 'an extends member must be a non-empty capability name or an array of them'));
      }
    } else {
      findings.push(finding('extends_malformed', 'warning', path, 'an extends member must be a non-empty capability name or an array of them'));
    }
  }
  return out.length > 0 ? out : null;
}

// Verify-only requires check: bounds are read from the pasted entries (the spec
// carries requires in the extension schema, which a verify-only node cannot fetch;
// where an entry declares requires it is honored, and an absent requires means the
// extension is assumed compatible). Returns the first violating reason code, or null.
function requiresViolation(pair, protocolVersion, active) {
  const declarations = [pair.bizEntry ? pair.bizEntry.requires : undefined, pair.platEntry ? pair.platEntry.requires : undefined];
  for (const req of declarations) {
    if (req === undefined) continue;
    if (!isPlainObject(req)) return 'requires_malformed';
    const rp = req.protocol;
    if (rp !== undefined) {
      if (!isPlainObject(rp)) return 'requires_protocol_violation';
      const min = rp.min;
      const max = rp.max;
      if ((min !== undefined && (!isWellFormedDate(min) || protocolVersion < min))
        || (max !== undefined && (!isWellFormedDate(max) || protocolVersion > max))) {
        return 'requires_protocol_violation';
      }
    }
    const rc = req.capabilities;
    if (rc !== undefined) {
      if (!isPlainObject(rc)) return 'requires_capability_violation';
      for (const target of Object.keys(rc).sort()) {
        const bound = rc[target];
        if (!isPlainObject(bound)) return 'requires_capability_violation';
        if (!active.has(target)) return 'requires_capability_violation';
        const targetVersion = active.get(target).version;
        const min = bound.min;
        const max = bound.max;
        if ((min !== undefined && (!isWellFormedDate(min) || targetVersion < min))
          || (max !== undefined && (!isWellFormedDate(max) || targetVersion > max))) {
          return 'requires_capability_violation';
        }
      }
    }
  }
  return null;
}

/**
 * compute(pp) — decide the UCP capability set two pasted profiles agree on.
 * @param {object} pp { business_profile, platform_profile }
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const findings = [];
  const issues = [];
  let verdict = 'AGREED';
  let protocolVersion = null;
  let primaryReason = 'capabilities_agreed';
  const agreed = {};
  const dropped = [];

  const sideBiz = 'business_profile';
  const sidePlat = 'platform_profile';
  const biz = validateProfile(sideBiz, pp.business_profile, findings, issues);
  const plat = validateProfile(sidePlat, pp.platform_profile, findings, issues);

  if (issues.length > 0) {
    verdict = 'INDETERMINATE';
    primaryReason = 'input_refused';
  } else {
    // Protocol phase: each side offers its ucp.version plus, when it advertises a
    // supported_versions map, the older releases mapped there. Highest mutual wins.
    const bizOffered = [biz.version].concat(biz.supported_versions ? Object.keys(biz.supported_versions) : []);
    const platOffered = [plat.version].concat(plat.supported_versions ? Object.keys(plat.supported_versions) : []);
    const mutual = [...new Set(bizOffered)].filter((v) => platOffered.includes(v)).sort();
    const unknownOffered = [...new Set(bizOffered.concat(platOffered))]
      .filter((v) => isWellFormedDate(v) && !KNOWN_UCP_VERSIONS.includes(v))
      .sort();
    if (mutual.length === 0) {
      if (unknownOffered.length > 0) {
        verdict = 'INDETERMINATE';
        primaryReason = 'unknown_protocol_version_offered';
        findings.push(finding('unknown_protocol_version', 'warning', 'policy_parameters', `offered protocol version(s) ${unknownOffered.join(', ')} are not releases this kernel has semantics for`));
      } else {
        verdict = 'NO_COMMON_CAPABILITY';
        primaryReason = 'protocol_version_no_overlap';
      }
    } else {
      const selected = mutual[mutual.length - 1];
      if (!KNOWN_UCP_VERSIONS.includes(selected)) {
        verdict = 'INDETERMINATE';
        primaryReason = 'unknown_protocol_version_selected';
        findings.push(finding('unknown_protocol_version', 'warning', 'policy_parameters', `selected protocol version ${selected} is not a release this kernel has semantics for`));
      } else {
        protocolVersion = selected;
        // Entity phase.
        const bizU = usableEntries(sideBiz, biz, findings);
        const platU = usableEntries(sidePlat, plat, findings);
        const names = [...new Set([
          ...bizU.byName.keys(), ...platU.byName.keys(),
          ...bizU.failures.keys(), ...platU.failures.keys(),
        ])].sort();
        const active = new Map(); // name -> { version, bizEntry, platEntry, parents }
        for (const name of names) {
          const b = bizU.byName.get(name);
          const p = platU.byName.get(name);
          if (b && p) {
            const mutualVersions = [...b.keys()].filter((v) => p.has(v)).sort();
            if (mutualVersions.length > 0) {
              const version = mutualVersions[mutualVersions.length - 1];
              active.set(name, {
                version,
                bizEntry: b.get(version),
                platEntry: p.get(version),
                parents: parentNames({ bizEntry: b.get(version), platEntry: p.get(version) }, sideBiz, sidePlat, name, findings),
              });
            } else {
              dropped.push({ name, reason: 'no_common_version' });
            }
          } else if (b || p) {
            const rejectedOnOtherSide = b ? platU.failures.get(name) : bizU.failures.get(name);
            dropped.push({ name, reason: rejectedOnOtherSide || 'only_in_one_profile' });
          } else {
            const codes = [bizU.failures.get(name), platU.failures.get(name)].filter(Boolean).sort();
            dropped.push({ name, reason: codes[0] });
          }
        }
        // Prune to a fixpoint: orphaned extensions first (removal decisions against
        // the pass-start set, so a chain loses one link per pass regardless of key
        // order), then requires bounds with re-pruning until stable.
        let changed = true;
        while (changed) {
          changed = false;
          const start = new Set(active.keys());
          for (const name of [...active.keys()].sort()) {
            const parents = active.get(name).parents;
            if (parents !== null && !parents.some((p) => start.has(p))) {
              active.delete(name);
              dropped.push({ name, reason: 'orphaned_extension' });
              changed = true;
            }
          }
          if (changed) continue;
          for (const name of [...active.keys()].sort()) {
            const violation = requiresViolation(active.get(name), protocolVersion, active);
            if (violation !== null) {
              active.delete(name);
              dropped.push({ name, reason: violation });
              changed = true;
            }
          }
        }
        if (active.size === 0) {
          verdict = 'NO_COMMON_CAPABILITY';
          primaryReason = dropped.length > 0 ? 'capability_intersection_empty' : 'no_capabilities_advertised';
        } else {
          for (const name of [...active.keys()].sort()) {
            agreed[name] = { version: active.get(name).version };
          }
        }
      }
    }
  }

  const output_payload = {
    verdict,
    protocol_version: protocolVersion,
    primary_reason: primaryReason,
    agreed_capabilities: agreed,
    dropped,
    findings,
    issues,
  };
  const compliance_flags = issues.length > 0 ? ['INPUT_REFUSED'] : [];
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
