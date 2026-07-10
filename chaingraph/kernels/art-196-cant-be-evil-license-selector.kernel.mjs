import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-196-cant-be-evil-license-selector';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'select_cbe_license',
  mandate_type: 'compliance_mandate', gpu: false,
};

// a16z Can't Be Evil license matrix — verified 2026-07-02 against canonical Arweave PDFs.
// Enum order: 0=PUBLIC(CBE_CC0) 1=EXCLUSIVE(CBE_ECR) 2=COMMERCIAL(CBE_NECR)
//             3=COMMERCIAL_NO_HATE(CBE_NECR_HS) 4=PERSONAL(CBE_PR) 5=PERSONAL_NO_HATE(CBE_PR_HS)
// Names renamed in-place Oct 2022; order unchanged. Both manifests are equivalent per index.
// Sources: https://github.com/a16z/cant-be-evil/
//          ar://zmc1WTspIhFyVY82bwfAIcIExLFH5lUcHHUN0wXg4W8/<idx>  (current)
//          ar://_D9kN1WrNWbCq55BSAGRbTB4bS3v8QAPTYmBThSbX3A/<idx>  (legacy)

const AR_CURRENT = 'ar://zmc1WTspIhFyVY82bwfAIcIExLFH5lUcHHUN0wXg4W8/';
const AR_LEGACY  = 'ar://_D9kN1WrNWbCq55BSAGRbTB4bS3v8QAPTYmBThSbX3A/';
const CBE_REF    = 'https://github.com/a16z/cant-be-evil/';

const CBE = {
  CBE_CC0: {
    ord: 0,
    current_enum: 'PUBLIC',
    launch_alias: 'CBE_CC0',
    commercial: true,
    exclusivity: null,
    derivatives: true,
    sublicense: null,
    objectionable_use_restriction: false,
    creator_retains: false,
    caveats: [
      'CC0 waives all rights. No copyright, no conditions. The general public receives the grant, not only the NFT holder.',
      'No §2/§3 apparatus applies. There are no sublicensing conditions, exclusivity terms, or breach-termination provisions.',
    ],
  },
  CBE_ECR: {
    ord: 1,
    current_enum: 'EXCLUSIVE',
    launch_alias: 'CBE_ECR',
    commercial: true,
    exclusivity: 'Exclusive (qualified: no trademark rights §1.3; creator retains copyright ownership and all unlicensed rights §1.1)',
    derivatives: true,
    sublicense: 'Yes (conditions in §1.4)',
    objectionable_use_restriction: false,
    creator_retains: true,
    caveats: [
      '"No Creator Retention" in this license means the creator gives up retained commercial exploitation only, via a pre-grant covenant (§1.2(a)). The creator still OWNS the copyright; this is a license, not an assignment.',
      'Exclusivity is qualified: no trademark rights transfer (§1.3), and the creator may continue pre-grant uses; other media owners may create derivatives of their own media (§1.2).',
      'Auto-transfer on NFT sale (§1.4); sublicenses from prior holder terminate on transfer. OFAC check applies.',
    ],
  },
  CBE_NECR: {
    ord: 2,
    current_enum: 'COMMERCIAL',
    launch_alias: 'CBE_NECR',
    commercial: true,
    exclusivity: 'Non-exclusive',
    derivatives: true,
    sublicense: 'Yes (conditions in §1.4)',
    objectionable_use_restriction: false,
    creator_retains: true,
    caveats: [
      'Creator retains copyright and the right to exploit and create future derivatives (§1.2(a)).',
      'Auto-transfer on NFT sale (§1.4); sublicenses from prior holder terminate on transfer. OFAC check applies.',
      'No revenue cap in this license. Revenue caps belong to other license families; do not import them here.',
    ],
  },
  CBE_NECR_HS: {
    ord: 3,
    current_enum: 'COMMERCIAL_NO_HATE',
    launch_alias: 'CBE_NECR_HS',
    commercial: true,
    exclusivity: 'Non-exclusive',
    derivatives: true,
    sublicense: 'Yes (conditions in §1.4)',
    objectionable_use_restriction: true,
    creator_retains: true,
    caveats: [
      '§1.6 is a broad objectionable-use restriction (11 categories, wider than hate speech), enforced at Creator sole discretion (DAO-delegable) via ordinary §3.2 material-breach termination. It is NOT automatic termination.',
      'Creator retains copyright and the right to exploit and create future derivatives (§1.2(a)).',
      'No revenue cap in this license.',
    ],
  },
  CBE_PR: {
    ord: 4,
    current_enum: 'PERSONAL',
    launch_alias: 'CBE_PR',
    commercial: false,
    exclusivity: null,
    derivatives: false,
    sublicense: 'Limited (display-enablement only, §1.1 and §1.4)',
    objectionable_use_restriction: false,
    creator_retains: true,
    caveats: [
      'Use and display permitted; modification is NOT permitted (§1.1).',
      'Sublicensing is limited to display-enablement only (§1.1 and §1.4); not a general sublicense.',
      'Auto-transfer on NFT sale (§1.4). OFAC check applies.',
    ],
  },
  CBE_PR_HS: {
    ord: 5,
    current_enum: 'PERSONAL_NO_HATE',
    launch_alias: 'CBE_PR_HS',
    commercial: false,
    exclusivity: null,
    derivatives: false,
    sublicense: 'Limited (display-enablement only, §1.1 and §1.4)',
    objectionable_use_restriction: true,
    creator_retains: true,
    caveats: [
      '§1.6 is a broad objectionable-use restriction (11 categories), enforced via ordinary §3.2 material-breach termination. It is NOT automatic termination.',
      'Use and display permitted; modification is NOT permitted (§1.1).',
      'Sublicensing is limited to display-enablement only (§1.1 and §1.4).',
    ],
  },
};

// Decision tree — matches T521 resolveCBE() exactly.
// Note: creator_retains is not a decision input (rows 1-5 all retain; only CC0 waives).
function resolveCBE(waiveAll, commercial, exclusive, hateRestriction) {
  const waive = waiveAll === true || waiveAll === 'yes';
  if (waive) return 'CBE_CC0';

  const com  = commercial === true || commercial === 'yes';
  const excl = exclusive  === true || exclusive  === 'yes';
  const hate = hateRestriction === true || hateRestriction === 'yes';

  if (!com) return hate ? 'CBE_PR_HS' : 'CBE_PR';
  if (excl) return 'CBE_ECR';
  return hate ? 'CBE_NECR_HS' : 'CBE_NECR';
}

export async function compute(pp) {
  const waiveAll        = pp?.waive_all           ?? false;
  const commercial      = pp?.commercial           ?? true;
  const exclusive       = pp?.exclusive            ?? false;
  const hateRestriction = pp?.hate_speech_termination ?? false;

  const id = resolveCBE(waiveAll, commercial, exclusive, hateRestriction);
  const L  = CBE[id];

  const output_payload = {
    cbe_id:                 id,
    current_enum_name:      L.current_enum,
    launch_alias:           L.launch_alias,
    license_version_index:  L.ord,
    arweave_uri:            AR_CURRENT + L.ord,
    arweave_uri_legacy:     AR_LEGACY  + L.ord,
    commercial:             L.commercial,
    exclusivity:            L.exclusivity,
    derivatives:            L.derivatives,
    sublicense:             L.sublicense,
    objectionable_use_restriction: L.objectionable_use_restriction,
    creator_retains:        L.creator_retains,
    caveats:                L.caveats,
    reference_url:          CBE_REF,
    matrix_verified:        '2026-07-02',
    disclaimer:             'Selection only. Not legal advice. The canonical Arweave license texts govern; verify before relying on any output for commercial or legal decisions.',
  };

  const compliance_flags = ['CBE_LICENSE_SELECTED', 'SELECTION_NOT_ADVICE'];
  if (L.commercial) compliance_flags.push('COMMERCIAL_GRANTED');
  if (L.objectionable_use_restriction) compliance_flags.push('OBJECTIONABLE_USE_RESTRICTION');

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
