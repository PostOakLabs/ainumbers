import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-209-nft-metadata-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_nft_metadata',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Validates ERC-721/ERC-1155 + OpenSea metadata JSON against:
// - Required fields: name, description, image
// - Recommended fields: external_url, animation_url, attributes[] with trait_type+value
// - License field presence (license / license_url / licenseUrl / properties.license)
// Schema check only. No on-chain calls, no minting.
//
// Sources: OpenSea metadata standards; ERC-721 tokenURI convention;
// ERC-1155 metadata URI convention.

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isUrl(v) {
  if (!isNonEmptyString(v)) return false;
  return /^https?:\/\/.+|^ipfs:\/\/.+|^ar:\/\/.+|^data:.+/.test(v.trim());
}

export function compute(pp) {
  pp = pp || {};

  // Parse metadata input
  let meta_obj = null;
  let parseError = null;

  if (typeof pp.metadata === 'string' && pp.metadata.trim()) {
    try {
      meta_obj = JSON.parse(pp.metadata);
    } catch (e) {
      parseError = 'JSON parse error: ' + (e && e.message ? e.message : String(e));
    }
  } else if (pp.metadata && typeof pp.metadata === 'object' && !Array.isArray(pp.metadata)) {
    meta_obj = pp.metadata;
  }

  // Empty-input mode
  if (!meta_obj && !parseError) {
    return {
      output_payload: {
        valid: false,
        required_pass: false,
        all_pass: false,
        fail_count: 0,
        warn_count: 0,
        field_count: 0,
        checks: [],
        disclaimer: 'Not legal advice. Schema check only; no on-chain calls. Consult a licensed attorney for rights and license matters.',
      },
      compliance_flags: { NFT_METADATA_VALIDATED: false, EMPTY_INPUT: true },
    };
  }

  if (parseError || !meta_obj || typeof meta_obj !== 'object' || Array.isArray(meta_obj)) {
    const errMsg = parseError || 'metadata must be a JSON object';
    return {
      output_payload: {
        valid: false,
        required_pass: false,
        all_pass: false,
        fail_count: 1,
        warn_count: 0,
        field_count: 0,
        checks: [{ group: 'required', field: 'parse', pass: false, warn: false, label: 'JSON parse', detail: errMsg }],
        disclaimer: 'Not legal advice. Schema check only; no on-chain calls. Consult a licensed attorney for rights and license matters.',
      },
      compliance_flags: { NFT_METADATA_VALIDATED: false, PARSE_ERROR: true },
    };
  }

  const checks = [];

  // === REQUIRED FIELDS ===

  const nameOk = isNonEmptyString(meta_obj.name);
  checks.push({ group: 'required', field: 'name', pass: nameOk, warn: false,
    label: 'name (string, required)',
    detail: nameOk ? 'Present: "' + String(meta_obj.name).slice(0, 60) + '"' : 'Missing or empty. ERC-721 and OpenSea both require a name field.' });

  const descOk = 'description' in meta_obj && typeof meta_obj.description === 'string';
  checks.push({ group: 'required', field: 'description', pass: descOk, warn: false,
    label: 'description (string, required)',
    detail: descOk ? 'Present (' + String(meta_obj.description).length + ' chars)' : 'Missing or wrong type. Must be a string.' });

  const imageOk = isNonEmptyString(meta_obj.image);
  const imageIsUrl = imageOk && isUrl(meta_obj.image);
  checks.push({ group: 'required', field: 'image', pass: imageOk, warn: !imageIsUrl && imageOk,
    label: 'image (URI, required)',
    detail: imageOk
      ? (imageIsUrl ? 'Present: ' + String(meta_obj.image).slice(0, 80) : 'Present but not a recognized URI scheme (https, ipfs, ar, data): "' + String(meta_obj.image).slice(0, 60) + '"')
      : 'Missing or empty. Must be a URI pointing to the token image.' });

  // === RECOMMENDED FIELDS ===

  const extOk = 'external_url' in meta_obj;
  const extIsUrl = extOk && isUrl(meta_obj.external_url);
  checks.push({ group: 'recommended', field: 'external_url', pass: extOk, warn: extOk && !extIsUrl,
    label: 'external_url (URL, recommended)',
    detail: !extOk ? 'Not present. OpenSea uses this to link from the asset page to your site.'
      : extIsUrl ? 'Present: ' + String(meta_obj.external_url).slice(0, 80)
      : 'Present but not a valid URL: "' + String(meta_obj.external_url).slice(0, 60) + '"' });

  const animOk = 'animation_url' in meta_obj;
  const animIsUrl = animOk && isUrl(meta_obj.animation_url);
  checks.push({ group: 'recommended', field: 'animation_url', pass: true, warn: animOk && !animIsUrl,
    label: 'animation_url (URL, optional)',
    detail: !animOk ? 'Not present (optional). Include for audio, video, or interactive content.'
      : animIsUrl ? 'Present: ' + String(meta_obj.animation_url).slice(0, 80)
      : 'Present but not a valid URL: "' + String(meta_obj.animation_url).slice(0, 60) + '"' });

  const attrPresent = 'attributes' in meta_obj;
  const attrIsArray = attrPresent && Array.isArray(meta_obj.attributes);
  checks.push({ group: 'recommended', field: 'attributes', pass: attrIsArray || !attrPresent, warn: attrPresent && !attrIsArray,
    label: 'attributes (array, recommended)',
    detail: !attrPresent ? 'Not present (recommended). Adds traits visible on OpenSea and most marketplaces.'
      : attrIsArray ? 'Present: ' + meta_obj.attributes.length + ' attribute(s)'
      : 'Present but not an array (type: ' + typeof meta_obj.attributes + ').' });

  if (attrIsArray && meta_obj.attributes.length > 0) {
    const attrErrs = [];
    for (let i = 0; i < meta_obj.attributes.length; i++) {
      const a = meta_obj.attributes[i];
      if (!a || typeof a !== 'object') { attrErrs.push('entry ' + i + ': not an object'); continue; }
      if (!isNonEmptyString(a.trait_type)) attrErrs.push('entry ' + i + ': missing or empty trait_type');
      if (a.value === undefined || a.value === null) attrErrs.push('entry ' + i + ': missing value');
    }
    checks.push({ group: 'recommended', field: 'attributes[].structure', pass: attrErrs.length === 0, warn: false,
      label: 'attributes entry structure (trait_type + value)',
      detail: attrErrs.length === 0
        ? 'All ' + meta_obj.attributes.length + ' attribute entries have trait_type and value'
        : attrErrs.slice(0, 5).join('; ') + (attrErrs.length > 5 ? ' (+' + (attrErrs.length - 5) + ' more)' : '') });
  }

  // === LICENSE FIELD ===

  let licenseFound = false;
  let licenseDetail = '';
  if ('license' in meta_obj) {
    licenseFound = true;
    licenseDetail = 'license field present: "' + String(meta_obj.license).slice(0, 80) + '"';
  } else if ('license_url' in meta_obj) {
    licenseFound = true;
    licenseDetail = 'license_url field present: "' + String(meta_obj.license_url).slice(0, 80) + '"';
  } else if ('licenseUrl' in meta_obj) {
    licenseFound = true;
    licenseDetail = 'licenseUrl field present: "' + String(meta_obj.licenseUrl).slice(0, 80) + '"';
  } else if (meta_obj.properties && typeof meta_obj.properties === 'object' && ('license' in meta_obj.properties)) {
    licenseFound = true;
    licenseDetail = 'properties.license present: "' + String(meta_obj.properties.license).slice(0, 80) + '"';
  }
  checks.push({ group: 'license', field: 'license', pass: licenseFound, warn: !licenseFound,
    label: 'License field presence',
    detail: licenseFound ? licenseDetail : 'No license, license_url, licenseUrl, or properties.license field found. A license field communicates usage rights to buyers and platforms.' });

  // Summary
  const requiredChecks = checks.filter(function(c) { return c.group === 'required'; });
  const requiredPass = requiredChecks.every(function(c) { return c.pass && !c.warn; });
  const allPass = checks.every(function(c) { return c.pass; });
  const failCount = checks.filter(function(c) { return !c.pass; }).length;
  const warnCount = checks.filter(function(c) { return c.warn; }).length;

  const output_payload = {
    valid: requiredPass,
    required_pass: requiredPass,
    all_pass: allPass,
    fail_count: failCount,
    warn_count: warnCount,
    field_count: Object.keys(meta_obj).length,
    checks: checks,
    disclaimer: 'Not legal advice. Schema check only; no on-chain calls. Marketplace acceptance may vary. Consult a licensed attorney for rights and license matters.',
  };

  const compliance_flags = {
    NFT_METADATA_VALIDATED: true,
    SCHEMA_CHECK_ONLY: true,
    NO_ON_CHAIN_ACTION: true,
  };
  if (!requiredPass) compliance_flags.REQUIRED_FIELDS_MISSING = true;

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
