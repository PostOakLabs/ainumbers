import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-203-embedded-license-selector';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'select_embedded_license',
  mandate_type: 'compliance_mandate', gpu: false,
};

// SolSea / ALL.ART 4-tier embedded-license menu.
// Maps creator answers to one of four published license tiers.
// Selection only — not legal advice. The published license texts govern.
// Source: SolSea embedded-license docs + ALL.ART license picker.
//
// Tier table (source-of-truth):
//   PRIVATE_NC:               No public use. Private/personal only. No commercial.
//   PERSONAL_PUBLIC_NC:       Personal + public display allowed. No commercial.
//   PUBLIC_DISPLAY_NC:        Public display + non-commercial sharing. No commercial.
//   REPRODUCTION_COMMERCIAL:  Reproduction + commercial use allowed.
//
// Decision tree (priority order):
//   1. commercial_use=true                           → REPRODUCTION_COMMERCIAL
//   2. public_display=true  AND allow_sharing=true  → PUBLIC_DISPLAY_NC
//   3. public_display=true  AND allow_sharing=false → PERSONAL_PUBLIC_NC
//   4. (default / private only)                     → PRIVATE_NC

const TIERS = {
  PRIVATE_NC: {
    tier_id: 'PRIVATE_NC',
    label: 'Private / No Commercial',
    description: 'Private use only. No public display, no sharing, no commercial use.',
    public_display: false,
    allow_sharing: false,
    commercial_use: false,
    source_url: 'https://solsea.io/license',
  },
  PERSONAL_PUBLIC_NC: {
    tier_id: 'PERSONAL_PUBLIC_NC',
    label: 'Personal + Public Display / No Commercial',
    description: 'Personal use and public display permitted. Sharing and commercial use not permitted.',
    public_display: true,
    allow_sharing: false,
    commercial_use: false,
    source_url: 'https://solsea.io/license',
  },
  PUBLIC_DISPLAY_NC: {
    tier_id: 'PUBLIC_DISPLAY_NC',
    label: 'Public Display + Non-Commercial Sharing / No Commercial',
    description: 'Public display and non-commercial sharing permitted. Commercial use not permitted.',
    public_display: true,
    allow_sharing: true,
    commercial_use: false,
    source_url: 'https://solsea.io/license',
  },
  REPRODUCTION_COMMERCIAL: {
    tier_id: 'REPRODUCTION_COMMERCIAL',
    label: 'Reproduction + Commercial Use',
    description: 'Reproduction and commercial use permitted.',
    public_display: true,
    allow_sharing: true,
    commercial_use: true,
    source_url: 'https://solsea.io/license',
  },
};

function toBool(v) {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'yes') return true;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === 'no') return false;
  return false;
}

export function compute(pp) {
  pp = pp || {};

  const commercial_use  = toBool(pp.commercial_use);
  const public_display  = toBool(pp.public_display);
  const allow_sharing   = toBool(pp.allow_sharing);

  let tier_id;
  if (commercial_use) {
    tier_id = 'REPRODUCTION_COMMERCIAL';
  } else if (public_display && allow_sharing) {
    tier_id = 'PUBLIC_DISPLAY_NC';
  } else if (public_display) {
    tier_id = 'PERSONAL_PUBLIC_NC';
  } else {
    tier_id = 'PRIVATE_NC';
  }

  const tier = TIERS[tier_id];

  const decision_path = [];
  if (commercial_use) {
    decision_path.push('commercial_use=true → REPRODUCTION_COMMERCIAL');
  } else if (public_display && allow_sharing) {
    decision_path.push('commercial_use=false, public_display=true, allow_sharing=true → PUBLIC_DISPLAY_NC');
  } else if (public_display) {
    decision_path.push('commercial_use=false, public_display=true, allow_sharing=false → PERSONAL_PUBLIC_NC');
  } else {
    decision_path.push('commercial_use=false, public_display=false → PRIVATE_NC');
  }

  const output_payload = {
    tier_id: tier.tier_id,
    label: tier.label,
    description: tier.description,
    inputs_resolved: {
      commercial_use: commercial_use,
      public_display: public_display,
      allow_sharing: allow_sharing,
    },
    decision_path: decision_path,
    rights: {
      public_display: tier.public_display,
      allow_sharing: tier.allow_sharing,
      commercial_use: tier.commercial_use,
    },
    source_url: tier.source_url,
    source_family: 'SolSea/ALL.ART embedded-license',
    disclaimer: 'Not legal advice. Selection only. The published SolSea/ALL.ART license terms govern. Consult a licensed attorney for your jurisdiction.',
  };

  const compliance_flags = [];
  compliance_flags.push('EMBEDDED_LICENSE_SELECTED');
  compliance_flags.push('UPL_SELECTION_NOT_ADVICE');
  compliance_flags.push('TIER_' + tier_id);

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
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
