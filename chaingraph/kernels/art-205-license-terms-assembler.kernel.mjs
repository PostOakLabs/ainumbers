import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-205-license-terms-assembler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assemble_license_terms',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Deterministic template render for pre-approved license term sheets.
// Substitutes field values into a fixed, pre-approved template.
// NO bespoke legal drafting — only parameter substitution (OpenLaw/Monax boundary).
// Reuses the markdown-render pattern from art-189 convert_markdown_document (inlined).
// Not legal advice. Consult a licensed attorney for your jurisdiction.

// ---- Inline minimal markdown renderer (subset of art-189 convert_markdown_document) ----
// Zero TextEncoder/TextDecoder — only string ops.
function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _mdToHtml(md) {
  const lines = String(md).split('\n');
  const out = [];
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Headings
    if (/^### /.test(line)) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h3>' + _escHtml(line.slice(4)) + '</h3>'); continue; }
    if (/^## /.test(line))  { if (inList) { out.push('</ul>'); inList = false; } out.push('<h2>' + _escHtml(line.slice(3)) + '</h2>'); continue; }
    if (/^# /.test(line))   { if (inList) { out.push('</ul>'); inList = false; } out.push('<h1>' + _escHtml(line.slice(2)) + '</h1>'); continue; }
    // List items
    if (/^[-*] /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + _escHtml(line.slice(2)) + '</li>');
      continue;
    }
    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('<hr>');
      continue;
    }
    // Empty line
    if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('');
      continue;
    }
    // Paragraph
    if (inList) { out.push('</ul>'); inList = false; }
    // Inline bold
    let para = _escHtml(line).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out.push('<p>' + para + '</p>');
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}
// ---- End inline renderer ----

// Pre-approved templates. Only these IDs are accepted.
// Placeholders use {{FIELD_NAME}} syntax (deterministic substitution).
const TEMPLATES = {
  'CC-STANDARD-USE': {
    template_id: 'CC-STANDARD-USE',
    name: 'Creative Commons Standard Use Agreement',
    version: '1.0',
    license_family: 'cc',
    source: 'https://creativecommons.org',
    fields_required: ['licensor_name', 'work_title', 'license_id', 'license_url'],
    fields_optional: ['attribution_text', 'effective_date'],
    body: `# Creative Commons License Agreement

**Work Title:** {{work_title}}
**Licensor:** {{licensor_name}}
**License:** {{license_id}}
**Effective Date:** {{effective_date}}

---

## Grant of Rights

{{licensor_name}} (the "Licensor") grants you a worldwide, royalty-free license to the work titled "{{work_title}}" under the terms of the {{license_id}} license.

The full license text is available at: {{license_url}}

## Attribution

{{attribution_text}}

## Disclaimer

This agreement records the Licensor's stated election of the above Creative Commons license. It does not constitute legal advice. The published Creative Commons license terms govern. Consult a licensed attorney for your jurisdiction.`,
  },
  'IP3-RIGHTS-RECORD': {
    template_id: 'IP3-RIGHTS-RECORD',
    name: 'IP3 Rights Record Term Sheet',
    version: '1.0',
    license_family: 'any',
    source: 'https://ip3.com',
    fields_required: ['licensor_name', 'licensee_name', 'work_title', 'license_id', 'territory', 'term_years'],
    fields_optional: ['royalty_rate', 'effective_date', 'renewal_option'],
    body: `# IP3 Rights Record

**Work:** {{work_title}}
**Licensor:** {{licensor_name}}
**Licensee:** {{licensee_name}}
**License:** {{license_id}}
**Territory:** {{territory}}
**Term:** {{term_years}} year(s)
**Effective Date:** {{effective_date}}

---

## Rights Granted

{{licensor_name}} grants {{licensee_name}} a license to use the work "{{work_title}}" under the {{license_id}} terms for the territory of {{territory}} for a period of {{term_years}} year(s).

## Royalty

{{royalty_rate}}

## Renewal

{{renewal_option}}

## Disclaimer

This term sheet is a pre-approved template record only. It does not constitute legal advice and is not a binding contract without independent legal review. Consult a licensed attorney for your jurisdiction.`,
  },
  'NFT-EMBEDDED-LICENSE': {
    template_id: 'NFT-EMBEDDED-LICENSE',
    name: 'NFT Embedded License Notice',
    version: '1.0',
    license_family: 'embedded',
    source: 'https://solsea.io/license',
    fields_required: ['creator_name', 'nft_title', 'tier_id', 'tier_label'],
    fields_optional: ['collection_name', 'effective_date'],
    body: `# NFT Embedded License Notice

**NFT:** {{nft_title}}
**Collection:** {{collection_name}}
**Creator:** {{creator_name}}
**License Tier:** {{tier_id}} - {{tier_label}}
**Effective Date:** {{effective_date}}

---

## License Election

{{creator_name}} elects the embedded license tier **{{tier_id}}** ({{tier_label}}) for the NFT titled "{{nft_title}}".

The elected tier determines permitted uses as published by SolSea/ALL.ART. The published license terms govern.

## Disclaimer

This notice records the creator's stated license election. It does not constitute legal advice. Consult a licensed attorney for your jurisdiction.`,
  },
};

const DEFAULT_FIELDS = {
  effective_date: 'See execution hash timestamp',
  attribution_text: 'Attribution required per license terms.',
  royalty_rate: 'As negotiated between parties.',
  renewal_option: 'No automatic renewal unless separately agreed.',
  collection_name: 'N/A',
};

function fillTemplate(body, fields) {
  return body.replace(/\{\{([A-Z_a-z0-9]+)\}\}/g, function(match, key) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) return String(fields[key]);
    if (Object.prototype.hasOwnProperty.call(DEFAULT_FIELDS, key)) return DEFAULT_FIELDS[key];
    return '[' + key + ': not provided]';
  });
}

export function compute(pp) {
  pp = pp || {};

  const template_id = typeof pp.template_id === 'string' ? pp.template_id.trim() : '';
  const fields = (pp.fields && typeof pp.fields === 'object' && !Array.isArray(pp.fields)) ? pp.fields : {};

  const template = template_id ? TEMPLATES[template_id] : null;
  const checks = [];

  if (!template_id) {
    return {
      output_payload: {
        template_id: null,
        rendered_text: null,
        rendered_html: null,
        fields_used: {},
        fields_missing: [],
        checks: [{ check: 'template_id_present', pass: false, detail: 'template_id is required. Available: ' + Object.keys(TEMPLATES).join(', ') }],
        available_templates: Object.keys(TEMPLATES),
        disclaimer: 'Not legal advice. Fixed templates only. Consult a licensed attorney for your jurisdiction.',
      },
      compliance_flags: ['LICENSE_TERMS_ASSEMBLED', 'INPUTS_MISSING'],
    };
  }

  const templateKnown = !!template;
  checks.push({ check: 'template_known', pass: templateKnown,
    detail: templateKnown ? 'template: ' + template_id + ' (' + template.name + ')' : 'unknown template_id: ' + template_id + '. Available: ' + Object.keys(TEMPLATES).join(', ') });

  if (!templateKnown) {
    return {
      output_payload: {
        template_id: template_id,
        rendered_text: null,
        rendered_html: null,
        fields_used: {},
        fields_missing: [],
        checks: checks,
        available_templates: Object.keys(TEMPLATES),
        disclaimer: 'Not legal advice. Fixed templates only. Consult a licensed attorney for your jurisdiction.',
      },
      compliance_flags: ['LICENSE_TERMS_ASSEMBLED', 'TEMPLATE_UNKNOWN'],
    };
  }

  // Validate required fields
  const missing = [];
  for (let i = 0; i < template.fields_required.length; i++) {
    const f = template.fields_required[i];
    if (!Object.prototype.hasOwnProperty.call(fields, f) || String(fields[f]).trim() === '') {
      missing.push(f);
    }
  }

  const fieldsMet = missing.length === 0;
  checks.push({ check: 'required_fields_present', pass: fieldsMet,
    detail: fieldsMet ? 'All required fields present' : 'Missing required fields: ' + missing.join(', ') });

  // Render with whatever fields are available (partial render on missing fields)
  const merged_fields = {};
  for (let i = 0; i < template.fields_required.length; i++) {
    const f = template.fields_required[i];
    merged_fields[f] = Object.prototype.hasOwnProperty.call(fields, f) ? String(fields[f]) : '[' + f + ': required]';
  }
  for (let i = 0; i < template.fields_optional.length; i++) {
    const f = template.fields_optional[i];
    if (Object.prototype.hasOwnProperty.call(fields, f)) merged_fields[f] = String(fields[f]);
  }

  const rendered_text = fillTemplate(template.body, merged_fields);
  const rendered_html = _mdToHtml(rendered_text);

  const output_payload = {
    template_id: template.template_id,
    template_name: template.name,
    template_version: template.version,
    license_family: template.license_family,
    template_source: template.source,
    rendered_text: rendered_text,
    rendered_html: rendered_html,
    fields_used: merged_fields,
    fields_missing: missing,
    checks: checks,
    available_templates: Object.keys(TEMPLATES),
    disclaimer: 'Not legal advice. Substitution into pre-approved templates only. No novel legal drafting. The published license terms govern. Consult a licensed attorney for your jurisdiction.',
  };

  const compliance_flags = [];
  compliance_flags.push('LICENSE_TERMS_ASSEMBLED');
  compliance_flags.push('FIXED_TEMPLATE_ONLY');
  compliance_flags.push('UPL_NO_BESPOKE_DRAFTING');
  if (!fieldsMet) compliance_flags.push('FIELDS_INCOMPLETE');

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
