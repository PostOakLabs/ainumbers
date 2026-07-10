import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-207-attribution-string-generator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'generate_attribution_string',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Generates a canonical TASL (Title/Author/Source/License) attribution line
// plus machine-readable ccREL JSON-LD and RDFa blocks for any CC-licensed work.
// Source of truth: Creative Commons Rights Expression Language (ccREL) specification
// https://wiki.creativecommons.org/wiki/CcREL
// Pure-deterministic: no Date, no Math.random, no TextEncoder, no crypto.subtle.

const CC_LICENSES = {
  'CC0-1.0':        { name: 'CC0 1.0 Universal',                                               url: 'https://creativecommons.org/publicdomain/zero/1.0/',   spdx: 'CC0-1.0',        short: 'CC0 1.0' },
  'CC-BY-4.0':      { name: 'Creative Commons Attribution 4.0 International',                  url: 'https://creativecommons.org/licenses/by/4.0/',         spdx: 'CC-BY-4.0',      short: 'CC BY 4.0' },
  'CC-BY-SA-4.0':   { name: 'Creative Commons Attribution-ShareAlike 4.0 International',       url: 'https://creativecommons.org/licenses/by-sa/4.0/',      spdx: 'CC-BY-SA-4.0',   short: 'CC BY-SA 4.0' },
  'CC-BY-ND-4.0':   { name: 'Creative Commons Attribution-NoDerivatives 4.0 International',    url: 'https://creativecommons.org/licenses/by-nd/4.0/',      spdx: 'CC-BY-ND-4.0',   short: 'CC BY-ND 4.0' },
  'CC-BY-NC-4.0':   { name: 'Creative Commons Attribution-NonCommercial 4.0 International',    url: 'https://creativecommons.org/licenses/by-nc/4.0/',      spdx: 'CC-BY-NC-4.0',   short: 'CC BY-NC 4.0' },
  'CC-BY-NC-SA-4.0':{ name: 'Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', spdx: 'CC-BY-NC-SA-4.0', short: 'CC BY-NC-SA 4.0' },
  'CC-BY-NC-ND-4.0':{ name: 'Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/', spdx: 'CC-BY-NC-ND-4.0', short: 'CC BY-NC-ND 4.0' },
};

function sanitize(v) {
  if (typeof v !== 'string') return '';
  return v.trim();
}

export function compute(pp) {
  pp = pp || {};

  const title     = sanitize(pp.title);
  const creator   = sanitize(pp.creator);
  const sourceUrl = sanitize(pp.source_url);
  const licenseId = sanitize(pp.license);
  const workUrl   = sanitize(pp.work_url);
  const attrUrl   = workUrl || sourceUrl;

  const lic = CC_LICENSES[licenseId] || null;

  const errors = [];
  if (!title)     errors.push('title is required');
  if (!creator)   errors.push('creator is required');
  if (!sourceUrl) errors.push('source_url is required');
  if (!lic)       errors.push('license must be one of: ' + Object.keys(CC_LICENSES).join(', '));

  if (errors.length > 0 || !lic) {
    return {
      output_payload: {
        tasl_line: '',
        json_ld: null,
        rdfa_html: '',
        valid: false,
        errors: errors,
        disclaimer: 'Not legal advice. This output formats attribution metadata only. Consult a licensed attorney for your jurisdiction.',
      },
      compliance_flags: [],
    };
  }

  // (a) Human-readable TASL line
  let tasl;
  if (licenseId === 'CC0-1.0') {
    if (attrUrl) {
      tasl = '"' + title + '" (' + attrUrl + ') by ' + creator + ' is marked with ' + lic.short + ' (' + lic.url + ').';
    } else {
      tasl = '"' + title + '" by ' + creator + ' is marked with ' + lic.short + '.';
    }
  } else {
    tasl = '"' + title + '" by ' + creator;
    if (attrUrl) tasl += ' (' + attrUrl + ')';
    tasl += ' is licensed under ' + lic.short + ' (' + lic.url + ').';
  }

  // (b) ccREL JSON-LD block
  const jsonLd = {
    '@context': {
      'cc': 'https://creativecommons.org/ns#',
      'dc': 'http://purl.org/dc/elements/1.1/',
      'dct': 'http://purl.org/dc/terms/',
    },
    '@type': 'cc:Work',
  };
  if (attrUrl)   jsonLd['@id'] = attrUrl;
  jsonLd['dc:title']           = title;
  jsonLd['dc:creator']         = creator;
  if (sourceUrl) jsonLd['dc:source']          = sourceUrl;
  jsonLd['cc:license']         = lic.url;
  if (attrUrl)   jsonLd['cc:attributionURL']  = attrUrl;
  jsonLd['cc:attributionName'] = creator;

  // (c) RDFa snippet
  const about = attrUrl ? ' about="' + attrUrl + '"' : '';
  let rdfa;
  if (licenseId === 'CC0-1.0') {
    rdfa = '<p xmlns:cc="https://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"' + about + '>\n' +
      '  <span property="dct:title">' + title + '</span>\n' +
      '  by <span property="cc:attributionName">' + creator + '</span>\n' +
      '  is marked with\n' +
      '  <a rel="license" href="' + lic.url + '">' + lic.short + '</a>.\n' +
      '</p>';
  } else {
    rdfa = '<p xmlns:cc="https://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"' + about + '>\n' +
      '  <span property="dct:title">' + title + '</span> by\n' +
      '  <a rel="cc:attributionURL" href="' + (attrUrl || sourceUrl) + '" property="cc:attributionName">' + creator + '</a>\n' +
      '  is licensed under\n' +
      '  <a rel="license" href="' + lic.url + '">' + lic.short + '</a>.\n' +
      '</p>';
  }

  const output_payload = {
    tasl_line: tasl,
    json_ld: jsonLd,
    rdfa_html: rdfa,
    license_name: lic.name,
    license_spdx: lic.spdx,
    license_url: lic.url,
    valid: true,
    errors: [],
    disclaimer: 'Not legal advice. This output formats attribution metadata only. Verify against the current CC ccREL specification before relying on it for commercial or legal purposes. Consult a licensed attorney for your jurisdiction.',
  };

  const compliance_flags = [];
  compliance_flags.push('ATTRIBUTION_GENERATED');
  compliance_flags.push('CCREL_VALID');
  compliance_flags.push('TASL_FORMATTED');
  compliance_flags.push('JSON_LD_EMITTED');
  compliance_flags.push('RDFA_EMITTED');

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
