// exporters/vc.mjs — chaingraph_export:vc — W3C Verifiable Credentials 2.0 profile (OCG Standard §13.11).
//
// Re-expresses an already-verified OpenChainGraph v0.4 artifact as a W3C VC 2.0
// *credential* (data-model conformant). This is a §13 export profile: a generated
// VIEW produced AFTER execution_hash and EXCLUDED from the hash preimage. It does
// NOT mint a new execution_hash and does NOT add a new cryptographic proof — the
// canonical fact stays the JSON artifact + its execution_hash. The credential
// carries an `ocg:hashAnchor` that re-states that hash so a verifier routes back
// to the canonical artifact. A deployer who needs a *secured* VC adds an enveloping
// JOSE/COSE or Data Integrity proof downstream; that is out of scope for the view.
//
// Deterministic: every field is derived from the artifact only (no Date.now / no
// UUID / no random), so the same artifact always renders byte-identical bytes.

import { metaBlock, exportFilename } from './_meta.mjs';

const MEDIA_TYPE = 'application/vc+json';
const enc = (s) => new TextEncoder().encode(s);

// W3C VC 2.0 base context + the AINumbers OCG term context (defines OpenChainGraphCredential,
// ocg:hashAnchor, mandate_type, etc.). The OCG context URL is intentionally version-pinned to the
// envelope (v0.4), NOT to spec_version — the credential shape tracks the artifact envelope.
const VC_CONTEXT_V2 = 'https://www.w3.org/ns/credentials/v2';
const OCG_VC_CONTEXT = 'https://ainumbers.co/chaingraph/context/vc/v0.4';

// agent-receipts (Obsigna) `AgentReceipt` credential context — OCG Standard §13.11.1.
// https://github.com/agent-receipts/obsigna, spec/context/v3, verified 2026-07-19.
const AGENT_RECEIPTS_CONTEXT = 'https://agentreceipts.ai/context/v1';

// OCG tool_id/chain-slug -> agent-receipts dotted action taxonomy (spec/spec/taxonomy/action-types.json,
// verified 2026-07-19). Every published domain there (filesystem/system/network/communication/document/
// financial/data) names an agent acting ON a system, not a compliance CALCULATION — none currently fits
// an OCG node, so this table starts EMPTY by design. Populate an entry only after confirming a real match
// against that file; never guess (SPEC §13.11.1).
const AGENT_RECEIPTS_ACTION_TYPE_ALIASES = {};

function agentReceiptsActionType(artifact) {
  const slug = artifact?.policy_parameters?.chain ?? artifact?.tool_id ?? null;
  if (slug && AGENT_RECEIPTS_ACTION_TYPE_ALIASES[slug]) return AGENT_RECEIPTS_ACTION_TYPE_ALIASES[slug];
  return `x-ocg.${slug ?? artifact?.mandate_type ?? 'unknown'}`;
}

function sha256Prefixed(h) {
  if (!h) return null;
  return String(h).startsWith('sha256:') ? String(h) : `sha256:${h}`;
}

export function buildVc(artifact) {
  const m = metaBlock(artifact);
  const hash = artifact?.execution_hash ?? null;
  const bareHash = String(hash ?? '').replace(/^sha256:/, '');

  // Issuance window — derived ONLY from artifact fields (deterministic; §13: no wall-clock).
  const validFrom = artifact?.valid_from ?? artifact?.issued_at ?? null;
  const validUntil = artifact?.valid_until ?? null;

  // agent-receipts §13.11.1 extension fields — derived ONLY from the artifact (§13 determinism).
  const chainDepth = artifact?.chain?.chain_depth ?? 0;
  const parentHash = artifact?.chain?.parent_hashes?.[0] ?? null;
  const chainSlug = artifact?.policy_parameters?.chain ?? null;
  const pph = artifact?.policy_parameters_hash ?? null;
  const hasMandate = artifact?.policy_parameters?.mandate_hash != null;

  const credential = {
    '@context': [VC_CONTEXT_V2, OCG_VC_CONTEXT, AGENT_RECEIPTS_CONTEXT],
    // Stable id derived from the canonical hash (no UUID/random — §13 determinism).
    id: bareHash ? `urn:ocg:artifact:${bareHash}` : 'urn:ocg:artifact:nohash',
    type: ['VerifiableCredential', 'OpenChainGraphCredential'],
    issuer: artifact?.issued_by ?? 'https://ainumbers.co',
    ...(validFrom ? { validFrom } : {}),
    ...(validUntil ? { validUntil } : {}),
    credentialSubject: {
      ...(artifact?.tool_id ? { id: `urn:ocg:tool:${artifact.tool_id}` } : {}),
      ...(artifact?.mandate_type ? { mandate_type: artifact.mandate_type } : {}),
      policy_parameters: artifact?.policy_parameters ?? {},
      output_payload: artifact?.output_payload ?? {},
      // agent-receipts (Obsigna) consumability — SPEC §13.11.1, PARTIAL mapping (see spec text for
      // which of their required action/principal fields are NOT populated, and why).
      action: {
        type: agentReceiptsActionType(artifact),
        ...(pph ? { parameters_hash: sha256Prefixed(pph) } : {}),
      },
      outcome: {
        status: (artifact?.compliance_flags?.length ?? 0) > 0 ? 'failure' : 'success',
      },
      chain: {
        sequence: chainDepth + 1,
        previous_receipt_hash: parentHash ? sha256Prefixed(parentHash) : null,
        chain_id: chainSlug ? `x-ocg:chain:${chainSlug}` : `x-ocg:tool:${artifact?.tool_id ?? 'unknown'}`,
      },
      ...(hasMandate && m.keyid ? { principal: { id: m.keyid } } : {}),
    },
    // Hash anchor — NOT a new execution_hash and NOT a registered VC proof suite.
    // It re-states the canonical hash so verification routes back to the JSON artifact.
    'ocg:hashAnchor': {
      type: 'OpenChainGraphHashAnchor2026',
      digestMethod: 'sha-256',
      executionHash: hash,
      chaingraph_version: artifact?.chaingraph_version ?? null,
      compute_mode: artifact?.compute_mode ?? null,
      verify_url: m.verify_url,
      ...(m.keyid ? { keyid: m.keyid } : {}),
    },
    'ocg:metadata': m,
  };

  const bytes = enc(JSON.stringify(credential, null, 2));
  return {
    bytes,
    filename: exportFilename(artifact, 'vc.json'),
    media_type: MEDIA_TYPE,
  };
}
