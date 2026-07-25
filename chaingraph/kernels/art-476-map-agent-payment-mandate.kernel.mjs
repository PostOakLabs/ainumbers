import { executionHash, policyParametersHash } from './_hash.mjs';

const TOOL_ID = 'art-476-map-agent-payment-mandate';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'map_agent_payment_mandate',
  mandate_type: 'compliance_control',
  gpu: false,
};

// AGENTPAY-INTEROP-BUILD-SPEC §AI-2: cross-protocol translation receipt.
// Verify/translate-only -- this kernel moves no value and settles nothing. It re-expresses a
// payment mandate declared under one agentic-payment protocol (AP2 / x402 / ACP) in the field
// vocabulary of another, pivoting through one internal canonical schema so every protocol pair
// needs only one mapping direction in and one out (a "rosetta row"), not N^2 pairwise tables.
// Field-name sourcing: AP2 fields verified against art-01/art-62 (AP2 v0.2 mandate-chain
// validator + payment-receipt verifier, both live). x402 fields verified against art-26 (x402
// payload decoder). ACP's public checkout-session schema was NOT independently confirmed at
// build time (2026-07-24) -- its profile is marked DRAFT-GENERIC per the same disclosure
// discipline as art-288's ISO-20022-to-EVM binding table; re-verify before any conformance claim.

const ALL_CANONICAL_FIELDS = [
  'mandate_id', 'payer_ref', 'payee_ref', 'amount', 'currency',
  'max_amount', 'issued_at', 'expires_at', 'human_not_present', 'purpose',
];

const MAPPING_TABLE_VERSION = 'AI2-MAP-V1-2026-07-24';

function n(v) { return v === undefined ? null : v; }

const PROTOCOL_PROFILES = {
  ap2: {
    protocol_version: 'AP2 v0.2 (per art-01/art-62 field usage, live 2026-07-18)',
    // AP2 payment mandate -> canonical pivot.
    to_canonical(m) {
      const scope = (m.scope && typeof m.scope === 'object') ? m.scope : {};
      return {
        mandate_id: n(m.mandate_id),
        payer_ref: null, // AP2 payment mandates do not carry an explicit payer identifier field.
        payee_ref: n(m.merchant_id),
        amount: n(m.amount),
        currency: n(m.currency),
        max_amount: n(scope.max_amount),
        issued_at: n(m.issued_at),
        expires_at: n(m.expires_at),
        human_not_present: (m.human_not_present === true || m.human_not_present === false) ? m.human_not_present : null,
        purpose: Array.isArray(scope.merchant_ids) ? scope.merchant_ids.join(',') : null,
      };
    },
    // canonical pivot -> AP2 payment mandate.
    from_canonical(c) {
      return {
        mandate_id: c.mandate_id,
        mandate_type: 'payment',
        merchant_id: c.payee_ref,
        amount: c.amount,
        currency: c.currency,
        issued_at: c.issued_at,
        expires_at: c.expires_at,
        human_not_present: c.human_not_present,
        scope: { max_amount: c.max_amount },
      };
    },
    required_canonical_fields: ['mandate_id', 'amount', 'currency', 'issued_at', 'expires_at'],
    // Canonical fields this protocol's schema can actually carry (matches from_canonical above).
    supported_canonical_fields: ['mandate_id', 'payee_ref', 'amount', 'currency', 'max_amount', 'issued_at', 'expires_at', 'human_not_present'],
  },
  x402: {
    protocol_version: 'x402 (Coinbase, scheme=exact; per art-26 field usage, live 2026-07-18)',
    // x402 PaymentPayload (scheme:exact) -> canonical pivot.
    to_canonical(m) {
      const auth = (m.payload && m.payload.authorization && typeof m.payload.authorization === 'object') ? m.payload.authorization : {};
      return {
        mandate_id: n(auth.nonce),
        payer_ref: n(auth.from),
        payee_ref: n(auth.to !== undefined ? auth.to : m.payTo),
        amount: n(auth.value !== undefined ? auth.value : m.maxAmountRequired),
        currency: n(m.asset),
        max_amount: n(m.maxAmountRequired),
        issued_at: n(auth.validAfter),
        expires_at: n(auth.validBefore),
        human_not_present: null, // x402 carries no human-presence flag.
        purpose: n(m.resource),
      };
    },
    // canonical pivot -> x402 PaymentPayload (scheme:exact).
    from_canonical(c) {
      return {
        x402Version: 1,
        scheme: 'exact',
        maxAmountRequired: c.max_amount !== null ? c.max_amount : c.amount,
        resource: c.purpose,
        payTo: c.payee_ref,
        asset: c.currency,
        payload: {
          authorization: {
            from: c.payer_ref,
            to: c.payee_ref,
            value: c.amount,
            validAfter: c.issued_at,
            validBefore: c.expires_at,
            nonce: c.mandate_id,
          },
        },
      };
    },
    required_canonical_fields: ['payer_ref', 'payee_ref', 'amount', 'expires_at'],
    supported_canonical_fields: ['mandate_id', 'payer_ref', 'payee_ref', 'amount', 'currency', 'max_amount', 'issued_at', 'expires_at', 'purpose'],
  },
  acp: {
    // DRAFT-GENERIC: ACP's public checkout-session field shape was not independently confirmed
    // at build time -- this is a draft generic profile, not a claim of ACP spec conformance.
    protocol_version: 'ACP DRAFT-GENERIC-2026-07-24 (unconfirmed public schema; re-verify before conformance claims)',
    to_canonical(m) {
      return {
        mandate_id: n(m.checkout_session_id),
        payer_ref: n(m.buyer_id),
        payee_ref: n(m.merchant_id),
        amount: n(m.total_amount),
        currency: n(m.currency),
        max_amount: null,
        issued_at: n(m.created_at),
        expires_at: n(m.expires_at),
        human_not_present: null,
        purpose: n(m.line_item_summary),
      };
    },
    from_canonical(c) {
      return {
        checkout_session_id: c.mandate_id,
        buyer_id: c.payer_ref,
        merchant_id: c.payee_ref,
        total_amount: c.amount,
        currency: c.currency,
        created_at: c.issued_at,
        expires_at: c.expires_at,
      };
    },
    required_canonical_fields: ['mandate_id', 'amount', 'currency'],
    supported_canonical_fields: ['mandate_id', 'payer_ref', 'payee_ref', 'amount', 'currency', 'issued_at', 'expires_at'],
  },
};

const VALID_PROTOCOLS = Object.keys(PROTOCOL_PROFILES);

// Pure structural transform: source-protocol mandate -> canonical pivot -> target-protocol mandate.
// Digests (source_digest/target_digest) use the same JCS-SHA-256 path as every other kernel's
// execution_hash, via _hash.mjs's policyParametersHash -- never an ad-hoc canonicalization.
export async function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const sourceProtocol = pp.source_protocol;
  const targetProtocol = pp.target_protocol;
  const sourceMandate = (pp.source_mandate !== null && typeof pp.source_mandate === 'object') ? pp.source_mandate : {};

  if (!VALID_PROTOCOLS.includes(sourceProtocol) || !VALID_PROTOCOLS.includes(targetProtocol)) {
    return {
      output_payload: {
        error: 'unknown_protocol',
        detail: `source_protocol and target_protocol must each be one of ${VALID_PROTOCOLS.join(', ')}.`,
        source_protocol: sourceProtocol,
        target_protocol: targetProtocol,
      },
      compliance_flags: ['MAPPING_REJECTED'],
    };
  }
  if (sourceProtocol === targetProtocol) {
    return {
      output_payload: {
        error: 'same_protocol_mapping',
        detail: 'source_protocol and target_protocol are the same protocol -- no translation to perform.',
        source_protocol: sourceProtocol,
        target_protocol: targetProtocol,
      },
      compliance_flags: ['MAPPING_REJECTED'],
    };
  }

  const source = PROTOCOL_PROFILES[sourceProtocol];
  const target = PROTOCOL_PROFILES[targetProtocol];

  const canonical_pivot = source.to_canonical(sourceMandate);
  const translated_mandate = target.from_canonical(canonical_pivot);

  const missing_required_target_fields = target.required_canonical_fields.filter((f) => canonical_pivot[f] === null || canonical_pivot[f] === undefined);
  const lossy_fields = ALL_CANONICAL_FIELDS.filter((f) => canonical_pivot[f] !== null && canonical_pivot[f] !== undefined && !target.supported_canonical_fields.includes(f));
  const mapping_ok = missing_required_target_fields.length === 0;

  const source_digest = await policyParametersHash(sourceMandate);
  const target_digest = await policyParametersHash(translated_mandate);

  const output_payload = {
    source_protocol: sourceProtocol,
    target_protocol: targetProtocol,
    mapping_table_version: MAPPING_TABLE_VERSION,
    protocol_versions: { [sourceProtocol]: source.protocol_version, [targetProtocol]: target.protocol_version },
    canonical_pivot,
    translated_mandate,
    mapping_receipt: {
      source_digest,
      target_digest,
      mapping_table_version: MAPPING_TABLE_VERSION,
      lossy_fields,
    },
    missing_required_target_fields,
    mapping_ok,
  };

  const compliance_flags = [];
  compliance_flags.push(mapping_ok ? 'MAPPING_COMPLETE' : 'MAPPING_INCOMPLETE');
  if (lossy_fields.length > 0) compliance_flags.push('FIELDS_DROPPED_NOT_SILENT');
  if (!mapping_ok) compliance_flags.push('ESCALATION_RAISED');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
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
