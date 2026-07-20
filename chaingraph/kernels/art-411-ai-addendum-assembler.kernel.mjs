import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-411-ai-addendum-assembler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assemble_ai_addendum',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Assembles a Common Paper AI Addendum (v1.0, CC BY 4.0) from Cover Page Key Terms.
// The Standard Terms body below is the VENDORED, IMMUTABLE fixed body (§3.3) —
// never modified, never spliced. Only the Cover Page varies with user input.
// Party identity, signatures, and notice addresses are EXCLUDED (zero-PII) and
// stay as literal placeholder tokens for the user's own off-platform e-sign flow.
// Not legal advice. Assembly + variable extraction only, never bespoke drafting.

const TEMPLATE_ID = 'common-paper-ai-addendum-v1.0';
const SOURCE_URL = 'https://commonpaper.com/standards/ai-addendum/1.0';
const LICENSE = 'CC-BY-4.0';
const ATTRIBUTION = 'Common Paper AI Addendum, Version 1.0, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)';
// Precomputed SHA-256 of chaingraph/templates/common-paper-ai-addendum/body.md as vendored.
// Recomputed + checked at build time by scripts/check-template-integrity.mjs; a
// mismatch there means the body drifted from the recorded provenance and MUST fail.
const BODY_SHA256 = '192a7dc6d7caea8dd49c519bca7d157c8618a66a8546fdff763d80019598ff16';

// Vendored verbatim — Common Paper AI Addendum Standard Terms v1.0 (CC BY 4.0).
// NEVER edit this text. Any customization lives in the Cover Page above it.
const BODY_MD = `# Standard Terms

1. <span class="header_2" id="1">AI Services</span>
    1. <span class="header_3" id="1.1">Using AI Services.</span>  The AI Services are part of the Product and subject to the Agreement as supplemented by this AI Addendum. <span class="coverpage_link">Customer</span> may use AI Services by providing Input. The AI Services may generate Output in response to Input. <span class="coverpage_link">Provider</span> may copy, display, modify, distribute, and use Input to the extent necessary to provide the AI Services as contemplated by this AI Addendum. <span class="coverpage_link">Customer</span> authorizes <span class="coverpage_link">Provider</span> to process Input for all such purposes.
    2. <span class="header_3" id="1.2">Restrictions.</span>  Without limiting the restrictions contained in the Agreement, <span class="coverpage_link">Customer</span> will not (and will not allow anyone else to): (a) use the AI Services for decision-making in a regulated industry or capacity without proper human oversight and review in compliance with Applicable Laws and applicable professional ethics, guidelines, and rules; (b) use the AI Services to violate, misappropriate, or otherwise infringe the intellectual property or other proprietary rights of others; or (c) falsely state Output was created by a human.
    3. <span class="header_3" id="1.3">Model Training.</span>  Unless the Cover Page identifies <span class="coverpage_link">Training Data</span> and <span class="coverpage_link">Training Purposes</span>, <span class="coverpage_link">Provider</span> may not use <span class="coverpage_link">Customer's</span> Inputs or Outputs to Train any Model. If the Cover Page permits Training, then subject to the <span class="coverpage_link">Training Restrictions</span>, <span class="coverpage_link">Provider</span> may copy, modify, distribute, and use <span class="coverpage_link">Training Data</span> for the <span class="coverpage_link">Training Purposes</span>.
    4. <span class="header_3" id="1.4">Non-Training Improvement.</span>  Subject to the <span class="coverpage_link">Improvement Restrictions</span>, <span class="coverpage_link">Provider</span> may use Input, Output, and <span class="coverpage_link">Training Data</span> to provide, maintain, develop, and improve the AI System, provided that such usage does not constitute Training except to the extent authorized for <span class="coverpage_link">Training Purposes</span>.
2. <span class="header_2" id="2">Intellectual Property and Privacy</span>
    1. <span class="header_3" id="2.1">Ownership.</span>  As between the parties, <span class="coverpage_link">Customer</span> (a) retains all right, title, and interest in and to all Input, and (b) owns all Output. To the extent permitted by Applicable Laws, <span class="coverpage_link">Provider</span> hereby assigns to <span class="coverpage_link">Customer</span> all right, title, and interest, if any, in and to Output.
    2. <span class="header_3" id="2.2">Personal Data.</span>  Nothing in this AI Addendum will reduce or limit <span class="coverpage_link">Provider's</span> obligations under Applicable Data Protection Laws regarding Personal Data that may be contained in Input.
    3. <span class="header_3" id="2.3">Rights to Input.</span>  <span class="coverpage_link">Customer</span> represents and warrants that it, all Users, and anyone submitting Input each have and will continue to have all rights necessary to submit Input to the AI Services.
3. <span class="header_2" id="3">Disclaimers</span>
    1. <span class="header_3" id="3.1">Nature of AI.</span>  Due to the nature of artificial intelligence and machine learning, information generated by the AI Services may be incorrect or inaccurate. The AI Services are not human and are not a substitute for human oversight. Output generated by the AI Services may not be protectable as intellectual property.
    2. <span class="header_3" id="3.2">Similarity of Output.</span>  Output may resemble or be duplicative of data, information, and materials created by the AI Services for others. <span class="coverpage_link">Provider</span> does not provide any representation or warranty that Output (a) does not and will not incorporate or reflect the data, information, prompts, or materials of others, (b) will not violate, misappropriate, or otherwise infringe upon the intellectual property or other proprietary rights of another person or entity, or (c) will not be reproduced in the same or similar way to another user of the AI Services.
4. <span class="header_2" id="4">Definitions</span>
    1. <span id="4.1"></span>**"AI Addendum Standard Terms"** means these Common Paper AI Addendum Standard Terms Version 1.0, which are posted at [https://commonpaper.com/standards/ai-addendum/1.0/](https://commonpaper.com/standards/ai-addendum/1.0/).
    2. <span id="4.2"></span>**"AI Services"** means the artificial intelligence or machine learning components of the Product, including the AI System and underlying Model(s).
    3. <span id="4.3"></span>**"AI System"** means the artificial intelligence or machine learning application, program, and services layers of the AI Services, excluding the underlying Models.
    4. <span id="4.4"></span>**"Input"** means the data, information, prompts, or materials submitted by or on behalf of <span class="coverpage_link">Customer</span> or Users to the AI Services but excludes Feedback.
    5. <span id="4.5"></span>**"Model"** means a large language, machine learning, or artificial intelligence model.
    6. <span id="4.6"></span>**"Output"** means the data, information, or materials created by the AI Services in response to Input.
    7. <span id="4.7"></span>**"Train"** or **"Training"** means the use of data, information, or materials to create or improve a Model.

Common Paper AI Addendum [Version 1.0](https://commonpaper.com/standards/ai-addendum/1.0/) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`;

function _str(v) { return typeof v === 'string' ? v : ''; }
function _bool(v) { return typeof v === 'boolean' ? v : null; }

export function compute(pp) {
  pp = pp || {};
  const checks = [];

  const train_on_customer_data = _bool(pp.train_on_customer_data);
  const model_improvement = _bool(pp.model_improvement);
  const training_data = _str(pp.training_data).trim();
  const training_purposes = _str(pp.training_purposes).trim();
  const training_restrictions = _str(pp.training_restrictions).trim() || 'None.';
  const improvement_restrictions = _str(pp.improvement_restrictions).trim() || 'None.';
  const retention_window = _str(pp.retention_window).trim();
  const output_ownership = _str(pp.output_ownership).trim();
  const subprocessor_ai = _str(pp.subprocessor_ai).trim();
  const effective_date = _str(pp.effective_date).trim();

  const required = { retention_window, output_ownership, subprocessor_ai, effective_date };
  const missing = Object.keys(required).filter(k => !required[k]);
  checks.push({ check: 'required_fields_present', pass: missing.length === 0,
    detail: missing.length === 0 ? 'All required Key Terms present' : 'Missing required Key Terms: ' + missing.join(', ') });

  const booleansValid = train_on_customer_data !== null && model_improvement !== null;
  checks.push({ check: 'boolean_fields_valid', pass: booleansValid,
    detail: booleansValid ? 'train_on_customer_data and model_improvement are booleans' : 'train_on_customer_data and model_improvement must both be true/false' });

  const trainingFieldsOk = train_on_customer_data !== true || (training_data.length > 0 && training_purposes.length > 0);
  checks.push({ check: 'training_fields_present_if_needed', pass: trainingFieldsOk,
    detail: trainingFieldsOk ? 'ok' : 'training_data and training_purposes required when train_on_customer_data is true' });

  const allValid = checks.every(c => c.pass);

  const trainingLine = train_on_customer_data === true
    ? 'Permitted. Training Data: ' + (training_data || '[not provided]') + ' Training Purposes: ' + (training_purposes || '[not provided]')
    : 'Not permitted. Provider may not Train any Model on Customer Input or Output.';
  const improvementLine = model_improvement === true
    ? 'Permitted, subject to the Improvement Restrictions below.'
    : 'Not permitted. Provider may not use Input, Output, or Training Data to improve the AI System outside of authorized Training.';

  const variable_map = {
    train_on_customer_data, training_data, training_purposes, training_restrictions,
    model_improvement, improvement_restrictions, retention_window, output_ownership,
    subprocessor_ai, effective_date,
  };

  const cover_page_markdown = allValid ? [
    '# AI Addendum',
    '',
    'This AI Addendum consists of: (1) this Cover Page and (2) the Common Paper AI Addendum Standard Terms Version 1.0 identical to those posted at ' + SOURCE_URL + '. This AI Addendum supplements and is incorporated into the parties\' underlying Agreement.',
    '',
    '### Model Training',
    trainingLine,
    'Training Restrictions: ' + training_restrictions,
    '',
    '### Non-Training Improvement',
    improvementLine,
    'Improvement Restrictions: ' + improvement_restrictions,
    '',
    '### Data Retention',
    retention_window,
    '',
    '### Output Ownership',
    output_ownership,
    '',
    '### AI Sub-processors',
    subprocessor_ai,
    '',
    '### Effective Date',
    effective_date,
    '',
    'By signing this Cover Page, each party agrees to enter into this AI Addendum as of the Effective Date.',
    '',
    '| | CUSTOMER | PROVIDER |',
    '|---|---|---|',
    '| Signature | {{customer_signature}} | {{provider_signature}} |',
    '| Print Name | {{customer_print_name}} | {{provider_print_name}} |',
    '| Title | {{customer_title}} | {{provider_title}} |',
    '| Company | {{customer_legal_name}} | {{provider_legal_name}} |',
    '| Notice Address | {{customer_notice_address}} | {{provider_notice_address}} |',
    '| Date | {{customer_signed_date}} | {{provider_signed_date}} |',
    '',
    'Common Paper AI Addendum (Version 1.0) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).',
  ].join('\n') : null;

  const assembled_markdown = cover_page_markdown ? cover_page_markdown + '\n\n---\n\n' + BODY_MD : null;

  const contract_api = {
    template_id: TEMPLATE_ID,
    body_sha256: BODY_SHA256,
    variable_map,
    selected_clause_ids: [],
    attribution: ATTRIBUTION,
  };

  const output_payload = {
    template_id: TEMPLATE_ID,
    source_url: SOURCE_URL,
    license: LICENSE,
    attribution: ATTRIBUTION,
    body_sha256: BODY_SHA256,
    checks,
    cover_page_markdown,
    assembled_markdown,
    contract_api,
    zero_pii_notice: 'Party identity, signatures, and notice addresses are never filled by this tool and remain literal {{placeholder}} tokens for your own off-platform e-sign flow.',
    disclaimer: 'Not legal advice. This tool assembles a fixed, vendored Standard Terms body with your Cover Page Key Terms; it does not draft, modify, or advise on the agreement. Consult a licensed attorney for your jurisdiction.',
  };

  const compliance_flags = ['AGREEMENT_TEMPLATE_ASSEMBLED', 'FIXED_BODY_VERBATIM', 'ZERO_PII_COVER_PAGE_ONLY', 'NOT_LEGAL_ADVICE'];
  compliance_flags.push(train_on_customer_data === true ? 'AI_TRAINING_PERMITTED' : 'AI_TRAINING_NOT_PERMITTED');
  if (!allValid) compliance_flags.push('KEY_TERMS_INCOMPLETE');

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
