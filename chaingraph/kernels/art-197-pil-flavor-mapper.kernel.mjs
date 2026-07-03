import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-197-pil-flavor-mapper';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'map_pil_flavor',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Story Protocol Programmable IP License (PIL) flavor mapper.
// Three standard flavors + the PILTerms struct (§2, Wave 35 spec).
// Source: https://docs.story.foundation/concepts/programmable-ip-license/pil-flavors
//
// licenseTermsId=1 is the protocol constant for NC Social Remixing.
// Carried-as-data fields (address(0)/0/empty): royaltyPolicy, expiration,
// commercializerChecker, commercializerCheckerData, commercialRevCeiling,
// derivativesApproval, derivativeRevCeiling, currency, uri.

const PIL_DOCS = 'https://docs.story.foundation/concepts/programmable-ip-license/pil-flavors';

// Flavor identifiers match the Story PIL documentation slugs.
const FLAVORS = {
  non_commercial_social_remixing: 'Non-Commercial Social Remixing',
  commercial_use:                 'Commercial Use',
  commercial_remix:               'Commercial Remix',
};

// Decision tree from spec §2 table:
//   commercial=no  → non_commercial_social_remixing
//   commercial=yes + derivatives=no  → commercial_use
//   commercial=yes + derivatives=yes → commercial_remix
function resolveFlavor(commercial, derivatives) {
  const com  = commercial  === true || commercial  === 'yes';
  const deriv = derivatives === true || derivatives === 'yes';
  if (!com) return 'non_commercial_social_remixing';
  if (!deriv) return 'commercial_use';
  return 'commercial_remix';
}

// Build the full PILTerms struct for the elected flavor.
// mintingFee and revSharePct are creator-set numbers; clamped to non-negative integers.
function buildPilTerms(flavor, mintingFee, revSharePct) {
  const fee  = Number.isFinite(mintingFee)  && mintingFee  >= 0 ? Math.floor(mintingFee)  : 0;
  const rev  = Number.isFinite(revSharePct) && revSharePct >= 0 ? Math.min(100, Math.floor(revSharePct)) : 0;

  if (flavor === 'non_commercial_social_remixing') {
    return {
      licenseTermsId:        1,
      transferable:          true,
      commercialUse:         false,
      commercialAttribution: false,
      commercialRevShare:    0,
      derivativesAllowed:    true,
      derivativesAttribution: true,
      derivativesReciprocal: true,
      defaultMintingFee:     0,
    };
  }
  if (flavor === 'commercial_use') {
    return {
      transferable:          true,
      commercialUse:         true,
      commercialAttribution: true,
      commercialRevShare:    0,
      derivativesAllowed:    false,
      derivativesAttribution: false,
      derivativesReciprocal: false,
      defaultMintingFee:     fee,
    };
  }
  // commercial_remix
  return {
    transferable:          true,
    commercialUse:         true,
    commercialAttribution: true,
    commercialRevShare:    rev,
    derivativesAllowed:    true,
    derivativesAttribution: true,
    derivativesReciprocal: true,
    defaultMintingFee:     fee,
  };
}

export async function compute(pp) {
  const commercial   = pp?.commercial_use       ?? false;
  const derivatives  = pp?.derivatives_allowed  ?? true;
  const mintingFee   = pp?.minting_fee          ?? 0;
  const revSharePct  = pp?.rev_share_pct        ?? 0;

  const fee = Number.isFinite(Number(mintingFee))  ? Number(mintingFee)  : 0;
  const rev = Number.isFinite(Number(revSharePct)) ? Number(revSharePct) : 0;

  const flavor    = resolveFlavor(commercial, derivatives);
  const pilTerms  = buildPilTerms(flavor, fee, rev);

  const output_payload = {
    flavor,
    flavor_label:     FLAVORS[flavor],
    pil_terms:        pilTerms,
    license_terms_id: pilTerms.licenseTermsId ?? null,
    docs:             PIL_DOCS,
    disclaimer:       'Selection only. Not legal advice. Story PIL documentation and license text govern; consult a licensed attorney before relying on any output.',
  };

  const compliance_flags = {
    PIL_FLAVOR_SELECTED:    true,
    COMMERCIAL_USE:         pilTerms.commercialUse,
    DERIVATIVES_ALLOWED:    pilTerms.derivativesAllowed,
    SELECTION_NOT_ADVICE:   true,
  };

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
