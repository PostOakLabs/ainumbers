/**
 * art-386-lint-cbom-structure.kernel.mjs
 * CBOM structural lint — validates a pasted CycloneDX 1.6 Cryptography Bill
 * of Materials against a hand-derived field subset, then classifies each
 * declared algorithm asset against a fixed CNSA-2.0 target list.
 *
 * NOT a scanner, NOT discovery, NOT a cryptographic audit: the input is the
 * user's own pasted CBOM and every classification below is labeled
 * `asserted` — it reflects what the CBOM declares, not what was observed
 * running anywhere. Structural checks + string-pattern classification only.
 *
 * Pure decision kernel — no DOM, no window, no Date.now(), no network.
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'art-386-lint-cbom-structure',
  mcp_name:     'lint_cbom_structure',
  mandate_type: 'compliance_mandate',
  version:      '1.0.0',
};

const TOOL_ID      = 'art-386-lint-cbom-structure';
const TOOL_VERSION = '1.0.0';

// ── declared data snapshot — re-pin this string when CISA/NIST CBOM minimum
// elements publish, or when the CNSA-2.0 target list changes. A future
// re-pin is a data bump, not a code change. ──────────────────────────────────
const DATA_VERSION = 'cnsa2-targets-2026-07-18';

// Hand-derived CycloneDX 1.6 cryptography-extension field subset (NOT the
// full vendored schema — cite: CycloneDX 1.6 spec, `cryptoProperties` /
// `algorithmProperties` object). Required for every `assetType:"algorithm"`
// component: the "algorithm" (component.name), "keySize" proxy
// (algorithmProperties.parameterSetIdentifier), "certification level"
// (algorithmProperties.certificationLevel[]), and "crypto functions"
// (algorithmProperties.cryptoFunctions[]).
const REQUIRED_ALGORITHM_FIELDS = [
  'name',
  'cryptoProperties.algorithmProperties.primitive',
  'cryptoProperties.algorithmProperties.parameterSetIdentifier',
  'cryptoProperties.algorithmProperties.certificationLevel',
  'cryptoProperties.algorithmProperties.cryptoFunctions',
];

// Quantum-vulnerable primitives (structural pattern match, uppercased).
const QUANTUM_VULNERABLE = ['RSA', 'ECDSA', 'ECDH', 'DH', 'SHA-1', 'SHA1'];

// CNSA-2.0 target primitives (structural pattern match, uppercased).
const CNSA2_TARGETS = ['ML-KEM-1024', 'ML-DSA-87', 'AES-256', 'SHA-384', 'SHA-512'];

// ── built-in default CBOM (deterministic fixture) ─────────────────────────────
const DEFAULT_CBOM = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  components: [
    {
      type: 'cryptographic-asset',
      name: 'RSA-2048',
      cryptoProperties: {
        assetType: 'algorithm',
        algorithmProperties: {
          primitive: 'signature',
          parameterSetIdentifier: '2048',
          certificationLevel: ['none'],
          cryptoFunctions: ['sign', 'verify'],
        },
      },
    },
    {
      type: 'cryptographic-asset',
      name: 'ML-KEM-1024',
      cryptoProperties: {
        assetType: 'algorithm',
        algorithmProperties: {
          primitive: 'key-encapsulation',
          parameterSetIdentifier: 'ML-KEM-1024',
          certificationLevel: ['fips140-3'],
          cryptoFunctions: ['encapsulate', 'decapsulate'],
        },
      },
    },
    {
      type: 'cryptographic-asset',
      name: 'SHA-1',
      cryptoProperties: {
        assetType: 'algorithm',
        algorithmProperties: {
          primitive: 'hash',
          parameterSetIdentifier: 'SHA-1',
          certificationLevel: ['none'],
          cryptoFunctions: ['digest'],
        },
      },
    },
    {
      type: 'cryptographic-asset',
      name: 'AES-256-GCM',
      cryptoProperties: {
        assetType: 'algorithm',
        algorithmProperties: {
          primitive: 'ae',
          parameterSetIdentifier: 'AES-256',
          // certificationLevel intentionally omitted — demonstrates a
          // structurally-invalid component in the default fixture.
          cryptoFunctions: ['encrypt', 'decrypt'],
        },
      },
    },
  ],
};

function getField(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function classifyComponent(component) {
  const cp = component.cryptoProperties ?? {};
  const ap = cp.algorithmProperties ?? {};

  const missing_fields = REQUIRED_ALGORITHM_FIELDS.filter((path) => {
    const val = getField(component, path);
    if (path.endsWith('certificationLevel') || path.endsWith('cryptoFunctions')) return !Array.isArray(val);
    return val == null || val === '';
  });

  if (missing_fields.length > 0) {
    return { structurally_valid: false, missing_fields, classification: 'unclassified' };
  }

  const haystack = [component.name, ap.primitive, ap.parameterSetIdentifier]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  const vuln_match = QUANTUM_VULNERABLE.find((pattern) => haystack.includes(pattern)) ?? null;
  const cnsa2_match = CNSA2_TARGETS.find((pattern) => haystack.includes(pattern)) ?? null;

  let classification = 'unclassified';
  if (vuln_match) classification = 'quantum_vulnerable';
  else if (cnsa2_match) classification = 'cnsa2_ready';

  return {
    structurally_valid: true,
    missing_fields: [],
    classification,
    matched_pattern: vuln_match ?? cnsa2_match ?? null,
    primitive: ap.primitive,
    parameter_set_identifier: ap.parameterSetIdentifier,
  };
}

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  let cbom = pp.cbom ?? DEFAULT_CBOM;
  const structural_issues = [];

  if (typeof cbom === 'string') {
    try {
      cbom = JSON.parse(cbom);
    } catch (e) {
      return {
        verdict: 'INVALID_CBOM',
        data_version: DATA_VERSION,
        cbom_structurally_valid: false,
        structural_issues: ['CBOM_NOT_VALID_JSON'],
        total_components: 0,
        total_algorithm_assets: 0,
        vulnerable_count: 0,
        cnsa2_ready_count: 0,
        unclassified_count: 0,
        structurally_invalid_count: 0,
        findings: [],
        compliance_flags: ['CBOM_STRUCTURAL_ISSUES_FOUND', 'STRUCTURAL_LINT_ONLY_NOT_A_SCANNER'],
      };
    }
  }

  if (!cbom || typeof cbom !== 'object' || Array.isArray(cbom)) {
    structural_issues.push('CBOM_NOT_AN_OBJECT');
  } else {
    if (cbom.bomFormat !== 'CycloneDX') structural_issues.push('MISSING_OR_INVALID_bomFormat');
    if (cbom.specVersion !== '1.6') structural_issues.push('MISSING_OR_UNEXPECTED_specVersion');
  }

  const components = (cbom && Array.isArray(cbom.components)) ? cbom.components : [];
  if (components.length === 0) structural_issues.push('NO_COMPONENTS_FOUND');

  const findings = [];
  let vulnerable_count = 0, cnsa2_ready_count = 0, unclassified_count = 0, structurally_invalid_count = 0;
  let total_algorithm_assets = 0;

  for (let i = 0; i < components.length; i++) {
    const component = components[i];
    const asset_type = component?.cryptoProperties?.assetType;
    if (asset_type !== 'algorithm') continue; // out of scope for this lint (certificate/related-material/protocol)

    total_algorithm_assets++;
    const result = classifyComponent(component);

    if (!result.structurally_valid) {
      structurally_invalid_count++;
      findings.push({
        index: i,
        name: component.name ?? '(unnamed)',
        status: 'STRUCTURAL_INVALID',
        missing_fields: result.missing_fields,
        classification: 'asserted:unclassified',
      });
      continue;
    }

    if (result.classification === 'quantum_vulnerable') vulnerable_count++;
    else if (result.classification === 'cnsa2_ready') cnsa2_ready_count++;
    else unclassified_count++;

    findings.push({
      index: i,
      name: component.name,
      primitive: result.primitive,
      parameter_set_identifier: result.parameter_set_identifier,
      status: 'STRUCTURAL_VALID',
      classification: `asserted:${result.classification}`,
      matched_pattern: result.matched_pattern,
    });
  }

  const cbom_structurally_valid = structural_issues.length === 0 && structurally_invalid_count === 0;

  const compliance_flags = ['STRUCTURAL_LINT_ONLY_NOT_A_SCANNER'];
  if (!cbom_structurally_valid) compliance_flags.push('CBOM_STRUCTURAL_ISSUES_FOUND');
  if (vulnerable_count > 0) compliance_flags.push('QUANTUM_VULNERABLE_PRIMITIVES_ASSERTED');
  if (total_algorithm_assets > 0 && cnsa2_ready_count === total_algorithm_assets) compliance_flags.push('ALL_ASSERTED_CNSA2_READY');

  const verdict = !cbom_structurally_valid
    ? 'INVALID_CBOM'
    : total_algorithm_assets === 0
      ? 'NO_ALGORITHM_ASSETS_FOUND'
      : vulnerable_count > 0
        ? 'QUANTUM_VULNERABLE_PRIMITIVES_ASSERTED'
        : 'NO_VULNERABLE_PRIMITIVES_ASSERTED';

  return {
    verdict,
    data_version: DATA_VERSION,
    cbom_structurally_valid,
    structural_issues,
    total_components: components.length,
    total_algorithm_assets,
    vulnerable_count,
    cnsa2_ready_count,
    unclassified_count,
    structurally_invalid_count,
    findings: findings.slice(0, 50),
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const result = compute(pp);
  const { compliance_flags = [] } = result;
  const output_payload = result;
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
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
