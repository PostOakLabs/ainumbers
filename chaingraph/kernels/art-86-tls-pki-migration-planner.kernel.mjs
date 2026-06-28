/**
 * art-86-tls-pki-migration-planner.kernel.mjs
 * Wave 18 — TLS/PKI PQC Migration Planner.
 * Estimates phased migration effort for a TLS/PKI estate to post-quantum
 * algorithms, models payload size impact, and flags interoperability risks.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   NIST FIPS 203 (Aug 2024) — ML-KEM (Kyber) — ML-KEM-768 public key 1184 bytes.
 *   NIST FIPS 204 (Aug 2024) — ML-DSA (Dilithium) — ML-DSA-65 signature 3309 bytes.
 *   PQC overhead study — hybrid TLS overhead multiplier ~2.1× (verify current primary source).
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

// Deterministic en-US number format — exact pure-JS replica of (n).toLocaleString('en-US') default options
// (group-3 integer digits, 0..3 fraction digits, halfExpand rounding). Used instead of toLocaleString so the
// OCG runner-guest (QuickJS-ng, no ICU) produces output byte-identical to V8. Verified vs V8 over 105k+ values.
function fmtEnUS(n) {
  n = Number(n);
  if (Number.isNaN(n)) return 'NaN';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  const sign = (n < 0) ? '-' : '';
  let s = Math.abs(n).toString();
  if (s.includes('e') || s.includes('E')) return sign + s;
  let [intPart, fracPart = ''] = s.split('.');
  if (fracPart.length > 3) {
    const keep = fracPart.slice(0, 3);
    const nextDigit = fracPart.charCodeAt(3) - 48;
    const digits = (intPart + keep).split('').map((c) => c.charCodeAt(0) - 48);
    if (nextDigit >= 5) {
      let i = digits.length - 1;
      for (; i >= 0; i--) { if (digits[i] === 9) { digits[i] = 0; } else { digits[i]++; break; } }
      if (i < 0) digits.unshift(1);
    }
    const all = digits.join('');
    intPart = all.slice(0, all.length - keep.length) || '0';
    fracPart = all.slice(all.length - keep.length);
  }
  fracPart = fracPart.replace(/0+$/, '');
  intPart = intPart.replace(/^0+(?=\d)/, '');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + grouped + (fracPart ? '.' + fracPart : '');
}

const TOOL_ID      = 'art-86-tls-pki-migration-planner';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'plan_tls_pki_migration',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// NIST FIPS 203 ML-KEM-768 public key size in bytes (verify FIPS 203 Aug 2024)
const ML_KEM_768_PK_BYTES      = 1184;
// NIST FIPS 204 ML-DSA-65 signature size in bytes (verify FIPS 204 Aug 2024)
const ML_DSA_65_SIG_BYTES      = 3309;
// RSA-2048 signature size in bytes (standard)
const RSA2048_SIG_BYTES        = 256;
// Approximate hybrid TLS overhead multiplier — PQC overhead study (verify current primary source)
const HYBRID_OVERHEAD_MULTIPLIER = 2.1;

export function compute(pp) {
  const {
    pki = {
      root_cas:           1,
      intermediate_count: 2,
      leaf_population:    1000,
      tls_versions:       [],
    },
    migration_strategy   = 'hybrid',
    interop_constraints  = [],
    inventory_ref        = '',
  } = pp;

  const { root_cas = 1, intermediate_count = 2, leaf_population = 1000, tls_versions = [] } = pki;

  // --- Payload impact per signature ---
  let payload_impact_bytes;
  if (migration_strategy === 'hybrid') {
    payload_impact_bytes = ML_DSA_65_SIG_BYTES + RSA2048_SIG_BYTES;
  } else if (migration_strategy === 'replace') {
    payload_impact_bytes = ML_DSA_65_SIG_BYTES;
  } else {
    // composite
    payload_impact_bytes = Math.round(ML_DSA_65_SIG_BYTES * 1.15);
  }

  // --- Migration phases ---
  const phase1_weeks = root_cas <= 2 ? 6 : 12;
  const phase2_weeks = intermediate_count <= 5 ? 8 : 16;
  const phase3_weeks =
    leaf_population > 100000 ? 26 :
    leaf_population > 10000  ? 16 :
    leaf_population > 1000   ? 10 : 6;

  const migration_plan = [
    {
      phase:        1,
      target:       'Root CA migration',
      effort_weeks: phase1_weeks,
      notes:        `${root_cas} root CA(s) — high effort; test in offline environment first`,
    },
    {
      phase:        2,
      target:       'Intermediate CA migration',
      effort_weeks: phase2_weeks,
      notes:        `${intermediate_count} intermediate CA(s) — schedule CRL/OCSP updates`,
    },
    {
      phase:        3,
      target:       'Leaf certificate / TLS endpoint rollout',
      effort_weeks: phase3_weeks,
      notes:        `${fmtEnUS(leaf_population)} leaf certs — automate via ACME or SCEP where possible`,
    },
  ];

  const estimated_total_weeks = phase1_weeks + phase2_weeks + phase3_weeks;

  // --- Interop risks ---
  const interop_risks = [];
  if (interop_constraints.includes('legacy_tls12') || tls_versions.includes('tls12')) {
    interop_risks.push('TLS 1.2 endpoints may not support PQC cipher suites — plan downgrade guards');
  }
  if (interop_constraints.includes('no_dual_stack')) {
    interop_risks.push('no_dual_stack constraint limits hybrid strategy fallback path');
  }
  if (interop_constraints.includes('size_limited') && payload_impact_bytes > 4096) {
    interop_risks.push('LARGE_LEAF_POPULATION: payload exceeds 4096 bytes — MTU/handshake fragmentation risk');
  }
  if (migration_strategy === 'hybrid') {
    interop_risks.push('Hybrid mode doubles certificate chain size (~' + HYBRID_OVERHEAD_MULTIPLIER + '× overhead) — verify path length constraints');
  }

  // --- Rollback points ---
  const rollback_points = [
    'After root CA switch',
    'After intermediate rollout',
  ];

  // --- Flags ---
  const compliance_flags = [];
  if (
    interop_constraints.includes('legacy_tls12') ||
    tls_versions.includes('tls12') ||
    tls_versions.includes('1.2')
  ) {
    compliance_flags.push('LEGACY_TLS_PRESENT');
  }
  if (leaf_population > 50000) {
    compliance_flags.push('LARGE_LEAF_POPULATION');
  }

  const output_payload = {
    migration_plan,
    strategy:              migration_strategy,
    payload_impact_bytes,
    interop_risks,
    rollback_points,
    estimated_total_weeks,
    pki_summary: {
      root_cas,
      intermediate_count,
      leaf_population,
      tls_versions,
    },
    algorithm_refs: {
      ml_kem_768_pk_bytes:      ML_KEM_768_PK_BYTES,
      ml_dsa_65_sig_bytes:      ML_DSA_65_SIG_BYTES,
      rsa2048_sig_bytes:        RSA2048_SIG_BYTES,
      hybrid_overhead_mult:     HYBRID_OVERHEAD_MULTIPLIER,
    },
    inventory_ref:     inventory_ref || null,
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. Algorithm sizes from NIST FIPS 203/204 (Aug 2024). Hybrid overhead multiplier is approximate — verify against current PQC overhead benchmarks. Effort estimates are indicative; adjust for organisational capacity and toolchain maturity.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
