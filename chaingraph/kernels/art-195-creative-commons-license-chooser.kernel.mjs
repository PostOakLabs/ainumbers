import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-195-creative-commons-license-chooser';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'choose_cc_license',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Creative Commons 4.0 license table. Source: https://creativecommons.org/choose/
const CC = {
  'CC0-1.0':         { name: 'CC0 1.0 Universal (Public Domain Dedication)',          url: 'https://creativecommons.org/publicdomain/zero/1.0/',   elements: [],                   attribution: false },
  'CC-BY-4.0':       { name: 'CC BY 4.0 (Attribution)',                               url: 'https://creativecommons.org/licenses/by/4.0/',         elements: ['BY'],               attribution: true  },
  'CC-BY-SA-4.0':    { name: 'CC BY-SA 4.0 (Attribution-ShareAlike)',                 url: 'https://creativecommons.org/licenses/by-sa/4.0/',      elements: ['BY', 'SA'],         attribution: true  },
  'CC-BY-ND-4.0':    { name: 'CC BY-ND 4.0 (Attribution-NoDerivatives)',              url: 'https://creativecommons.org/licenses/by-nd/4.0/',      elements: ['BY', 'ND'],         attribution: true  },
  'CC-BY-NC-4.0':    { name: 'CC BY-NC 4.0 (Attribution-NonCommercial)',              url: 'https://creativecommons.org/licenses/by-nc/4.0/',      elements: ['BY', 'NC'],         attribution: true  },
  'CC-BY-NC-SA-4.0': { name: 'CC BY-NC-SA 4.0 (Attribution-NonCommercial-ShareAlike)', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', elements: ['BY', 'NC', 'SA'],   attribution: true  },
  'CC-BY-NC-ND-4.0': { name: 'CC BY-NC-ND 4.0 (Attribution-NonCommercial-NoDerivatives)', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/', elements: ['BY', 'NC', 'ND'], attribution: true },
};

// Truth table from OCG spec §2 / Wave 35 spec §2:
//   waive_all → CC0
//   commercial + yes  + share_alike → BY-SA
//   commercial + yes  + none        → BY-ND
//   commercial + yes  + yes/other   → BY
//   commercial + no   + share_alike → BY-NC-SA
//   commercial + no   + none        → BY-NC-ND
//   commercial + no   + yes/other   → BY-NC
function resolveCC(waiveAll, commercial, adaptations) {
  const waive = waiveAll === true || waiveAll === 'yes';
  if (waive) return 'CC0-1.0';

  const com = commercial === true || commercial === 'yes';
  const adapt = String(adaptations || 'yes').toLowerCase().trim();

  if (com) {
    if (adapt === 'share_alike') return 'CC-BY-SA-4.0';
    if (adapt === 'none')        return 'CC-BY-ND-4.0';
    return 'CC-BY-4.0';
  }
  if (adapt === 'share_alike') return 'CC-BY-NC-SA-4.0';
  if (adapt === 'none')        return 'CC-BY-NC-ND-4.0';
  return 'CC-BY-NC-4.0';
}

export async function compute(pp) {
  const waiveAll    = pp?.waive_all_rights ?? false;
  const commercial  = pp?.allow_commercial ?? true;
  const adaptations = pp?.allow_adaptations ?? 'yes';

  const spdxId = resolveCC(waiveAll, commercial, adaptations);
  const L = CC[spdxId];

  const output_payload = {
    license_id:           spdxId,
    license_name:         L.name,
    license_url:          L.url,
    spdx_id:              spdxId,
    required_elements:    L.elements,
    attribution_required: L.attribution,
    source:               'https://creativecommons.org/choose/',
    disclaimer:           'Selection only. Not legal advice. Verify against the canonical CC deeds before relying on any output for commercial or legal decisions.',
  };

  const compliance_flags = ['CC_LICENSE_SELECTED', 'SELECTION_NOT_ADVICE'];
  if (L.attribution) compliance_flags.push('ATTRIBUTION_REQUIRED');

  return { output_payload, compliance_flags };
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
