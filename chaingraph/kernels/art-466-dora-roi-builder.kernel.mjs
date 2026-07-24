/**
 * art-466-dora-roi-builder.kernel.mjs
 * Assurance Waves program (DORA-ROI-BUILD-SPEC.md §1, DORA-K-1) — Register of Information
 * (RoI) template-set builder + cross-validator.
 *
 * DORA (EU) 2022/2554 Art. 28 (general principles on management of ICT third-party risk) and
 * Art. 30 (key contractual provisions) require financial entities to maintain and keep updated
 * a Register of Information on all contractual arrangements with ICT third-party service
 * providers (Art. 28(3)). The ESAs' final RTS/ITS on RoI templates (JC 2023 85 / Commission
 * Implementing Regulation on standard templates for the register of information) define ~15
 * structured templates (entity, provider, contractual arrangement, function, etc.) submitted
 * annually (first cycle Q1 2025, second cycle Q1 2026) as xBRL-CSV.
 *
 * DELIBERATE SCOPE LIMIT #1 (format): the RoI's official submission format is xBRL-CSV. This
 * kernel does NOT emit xBRL-CSV. It constructs and cross-validates a form-shaped JSON internal
 * representation of the RoI's core template relationships (entity / providers / functions /
 * contracts) — an OIM-report-model-shaped structure, not a literal xBRL-CSV writer. xBRL-CSV
 * emission is explicitly out of scope for this kernel (DORA-ROI-BUILD-SPEC.md kill-criteria);
 * a later WU handles ESA-format conversion if ever built.
 *
 * DELIBERATE SCOPE LIMIT #2 (judgment boundary): whether a function is "critical or important"
 * and whether an ICT provider is itself "critical" under Art. 31 designation is a HUMAN JUDGMENT
 * call, out of scope for this kernel. `functions[].critical` is a caller-supplied boolean flag
 * this kernel treats as a plain input, never computed or second-guessed here. Criticality
 * sign-off machinery (approval records) is a separate later WU (DORA-K-2), not built here.
 *
 * This kernel validates, deterministically and structurally:
 *   1. LEI format validity (ISO 17442 20-char structure + ISO 7064 Mod 97-10 check digit) on
 *      the entity's own LEI and every provider's LEI — same algorithm as art-246-lei-payment-
 *      binding-linter.kernel.mjs (SPEC.md §9 reuse; re-implemented inline per the kernel-import
 *      rule — kernels may only import `_hash.mjs`, so cross-kernel logic is copied, not imported).
 *   2. Referential integrity: every function.provider_id must resolve to a declared provider;
 *      every contract.function_id must resolve to a declared function; every contract.provider_id
 *      must resolve to a declared provider AND agree with that function's own provider_id (a
 *      contract citing a provider different from its function's provider is flagged, since the
 *      RoI's contractual-arrangement template links function → contract → provider as one chain).
 *   3. Mandatory-field completeness on the entity, and every provider/function/contract record,
 *      against a minimal required-field set per record type (RoI templates carry many more
 *      optional fields in production; this kernel checks the load-bearing linkage + identity
 *      fields only, not the full ESA field catalog).
 *
 * LEIs and contract metadata are treated as PUBLIC/structural registry-style data, not PII.
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: DORA-ROI-BUILD-SPEC.md §1 (DORA-K-1, art-466).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-466-dora-roi-builder';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'build_dora_roi_register', mandate_type: 'compliance_mandate', gpu: false };

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

// --- ISO 17442 LEI check-digit validation (ISO 7064 Mod 97-10) ---
// Re-implemented inline from art-246-lei-payment-binding-linter.kernel.mjs (SPEC.md §9 reuse);
// kernels may only import `_hash.mjs`, so the pure-function logic is copied, not imported.
function charToDigits(c) {
  const code = c.charCodeAt(0);
  if (code >= 48 && code <= 57) return c;
  if (code >= 65 && code <= 90) return String(code - 55);
  return '';
}
function mod97(numStr) {
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) remainder = (remainder * 10 + Number(numStr[i])) % 97;
  return remainder;
}
function validateLEI(lei) {
  const clean = safeStr(lei).toUpperCase();
  if (clean.length === 0) return { valid: null, error: 'Not provided' };
  if (!/^[A-Z0-9]{20}$/.test(clean)) return { valid: false, error: `LEI must be exactly 20 alphanumeric characters (ISO 17442 format). Got ${clean.length} chars.` };
  const numericStr = clean.split('').map(charToDigits).join('');
  const rem = mod97(numericStr);
  if (rem !== 1) return { valid: false, error: `ISO 17442 mod-97 check failed (remainder ${rem}, expected 1). LEI has invalid check digits.` };
  return { valid: true, error: null };
}

const ENTITY_REQUIRED = ['entity_name', 'entity_lei'];
const PROVIDER_REQUIRED = ['provider_id', 'name', 'lei'];
const FUNCTION_REQUIRED = ['function_id', 'provider_id', 'name'];
const CONTRACT_REQUIRED = ['contract_id', 'function_id', 'provider_id', 'contract_reference', 'start_date', 'governing_law'];

function checkMandatory(record, requiredFields) {
  const missing = requiredFields.filter((f) => {
    const v = record[f];
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  });
  return { complete: missing.length === 0, missing };
}

function normArray(v) { return Array.isArray(v) ? v : []; }

export function compute(pp) {
  pp = pp || {};
  const entityIn = pp.entity && typeof pp.entity === 'object' ? pp.entity : {};
  const providersIn = normArray(pp.providers);
  const functionsIn = normArray(pp.functions);
  const contractsIn = normArray(pp.contracts);

  const findings = [];
  const compliance_flags = [];

  const counters = {
    lei_validity: { pass: 0, fail: 0 },
    referential_integrity: { pass: 0, fail: 0 },
    mandatory_fields: { pass: 0, fail: 0 },
  };

  function record(record_type, record_id, check, status, message) {
    findings.push({ record_type, record_id, check, status, message });
    counters[check][status === 'pass' ? 'pass' : 'fail'] += 1;
  }

  // --- Entity ---
  const entity_name = safeStr(entityIn.entity_name);
  const entity_lei = safeStr(entityIn.entity_lei).toUpperCase();
  const entityMandatory = checkMandatory({ entity_name, entity_lei }, ENTITY_REQUIRED);
  record('entity', 'entity', 'mandatory_fields', entityMandatory.complete ? 'pass' : 'fail',
    entityMandatory.complete ? 'Entity mandatory fields present.' : `Entity missing: ${entityMandatory.missing.join(', ')}.`);
  if (!entityMandatory.complete) compliance_flags.push('MANDATORY_FIELD_MISSING');

  const entityLeiResult = validateLEI(entity_lei);
  if (entityLeiResult.valid === true) {
    record('entity', 'entity', 'lei_validity', 'pass', 'Entity LEI passes ISO 17442 format + mod-97 check.');
  } else if (entityLeiResult.valid === false) {
    record('entity', 'entity', 'lei_validity', 'fail', `Entity LEI invalid: ${entityLeiResult.error}`);
    compliance_flags.push('LEI_INVALID');
  } else {
    record('entity', 'entity', 'lei_validity', 'fail', 'Entity LEI not provided.');
    compliance_flags.push('LEI_INVALID');
  }

  // --- Providers ---
  const providerIds = new Set();
  const providers = providersIn.map((p, idx) => {
    p = p && typeof p === 'object' ? p : {};
    const provider_id = safeStr(p.provider_id) || `provider-${idx}`;
    const name = safeStr(p.name);
    const lei = safeStr(p.lei).toUpperCase();
    const country = safeStr(p.country) || null;
    const service_type = safeStr(p.service_type) || null;
    providerIds.add(provider_id);

    const mand = checkMandatory({ provider_id, name, lei }, PROVIDER_REQUIRED);
    record('provider', provider_id, 'mandatory_fields', mand.complete ? 'pass' : 'fail',
      mand.complete ? 'Provider mandatory fields present.' : `Provider ${provider_id} missing: ${mand.missing.join(', ')}.`);
    if (!mand.complete) compliance_flags.push('MANDATORY_FIELD_MISSING');

    const leiResult = validateLEI(lei);
    if (leiResult.valid === true) {
      record('provider', provider_id, 'lei_validity', 'pass', `Provider ${provider_id} LEI passes ISO 17442 format + mod-97 check.`);
    } else {
      record('provider', provider_id, 'lei_validity', 'fail', `Provider ${provider_id} LEI invalid: ${leiResult.error || 'not provided'}.`);
      compliance_flags.push('LEI_INVALID');
    }

    return { provider_id, name, lei: lei || null, country, service_type };
  });

  // --- Functions ---
  const functionIds = new Set();
  const functionProviderById = new Map();
  const functions = functionsIn.map((f, idx) => {
    f = f && typeof f === 'object' ? f : {};
    const function_id = safeStr(f.function_id) || `function-${idx}`;
    const provider_id = safeStr(f.provider_id);
    const name = safeStr(f.name);
    const critical = f.critical === true;
    const function_type = safeStr(f.function_type) || null;
    functionIds.add(function_id);
    functionProviderById.set(function_id, provider_id);

    const mand = checkMandatory({ function_id, provider_id, name }, FUNCTION_REQUIRED);
    record('function', function_id, 'mandatory_fields', mand.complete ? 'pass' : 'fail',
      mand.complete ? 'Function mandatory fields present.' : `Function ${function_id} missing: ${mand.missing.join(', ')}.`);
    if (!mand.complete) compliance_flags.push('MANDATORY_FIELD_MISSING');

    const providerResolves = provider_id !== '' && providerIds.has(provider_id);
    record('function', function_id, 'referential_integrity', providerResolves ? 'pass' : 'fail',
      providerResolves ? `Function ${function_id} provider_id resolves.` : `Function ${function_id} provider_id "${provider_id}" does not resolve to a declared provider.`);
    if (!providerResolves) compliance_flags.push('DANGLING_FUNCTION_REFERENCE');

    return { function_id, provider_id: provider_id || null, name, critical, function_type };
  });

  // --- Contracts ---
  const contracts = contractsIn.map((c, idx) => {
    c = c && typeof c === 'object' ? c : {};
    const contract_id = safeStr(c.contract_id) || `contract-${idx}`;
    const function_id = safeStr(c.function_id);
    const provider_id = safeStr(c.provider_id);
    const contract_reference = safeStr(c.contract_reference);
    const start_date = safeStr(c.start_date);
    const end_date = safeStr(c.end_date) || null;
    const governing_law = safeStr(c.governing_law);

    const mand = checkMandatory(
      { contract_id, function_id, provider_id, contract_reference, start_date, governing_law },
      CONTRACT_REQUIRED,
    );
    record('contract', contract_id, 'mandatory_fields', mand.complete ? 'pass' : 'fail',
      mand.complete ? 'Contract mandatory fields present.' : `Contract ${contract_id} missing: ${mand.missing.join(', ')}.`);
    if (!mand.complete) compliance_flags.push('MANDATORY_FIELD_MISSING');

    const functionResolves = function_id !== '' && functionIds.has(function_id);
    record('contract', contract_id, 'referential_integrity', functionResolves ? 'pass' : 'fail',
      functionResolves ? `Contract ${contract_id} function_id resolves.` : `Contract ${contract_id} function_id "${function_id}" does not resolve to a declared function.`);
    if (!functionResolves) compliance_flags.push('DANGLING_CONTRACT_REFERENCE');

    const providerResolves = provider_id !== '' && providerIds.has(provider_id);
    record('contract', contract_id, 'referential_integrity', providerResolves ? 'pass' : 'fail',
      providerResolves ? `Contract ${contract_id} provider_id resolves.` : `Contract ${contract_id} provider_id "${provider_id}" does not resolve to a declared provider.`);
    if (!providerResolves) compliance_flags.push('DANGLING_CONTRACT_REFERENCE');

    if (functionResolves && providerResolves) {
      const linkedProvider = functionProviderById.get(function_id);
      const consistent = linkedProvider === provider_id;
      record('contract', contract_id, 'referential_integrity', consistent ? 'pass' : 'fail',
        consistent
          ? `Contract ${contract_id} provider_id agrees with function ${function_id}'s provider.`
          : `Contract ${contract_id} declares provider_id "${provider_id}" but its function ${function_id} links to provider "${linkedProvider}".`);
      if (!consistent) compliance_flags.push('CONTRACT_FUNCTION_PROVIDER_MISMATCH');
    }

    return { contract_id, function_id: function_id || null, provider_id: provider_id || null, contract_reference, start_date, end_date, governing_law };
  });

  const summary = {
    entity_count: 1,
    provider_count: providers.length,
    function_count: functions.length,
    contract_count: contracts.length,
    checks: {
      lei_validity: { ...counters.lei_validity },
      referential_integrity: { ...counters.referential_integrity },
      mandatory_fields: { ...counters.mandatory_fields },
    },
    overall_pass: findings.every((f) => f.status === 'pass'),
  };

  // De-duplicate compliance_flags while preserving first-seen order.
  const seen = new Set();
  const flags = [];
  for (const f of compliance_flags) { if (!seen.has(f)) { seen.add(f); flags.push(f); } }

  const validation_report = {
    summary,
    findings,
    compliance_flags: flags,
    table_version: 'DORA-ROI-TEMPLATES-STRUCTURAL-2026',
    table_source: 'DORA (EU) 2022/2554 Art. 28/30 (Register of Information); ESAs final RTS/ITS on standard templates for the register of information (JC 2023 85); ISO 17442:2020 + ISO 7064:2003 Mod 97-10 for LEI check-digit validation.',
  };

  const output_payload = {
    entity: { entity_name: entity_name || null, entity_lei: entity_lei || null },
    providers,
    functions,
    contracts,
    validation_report,
    note: 'Form-shaped internal representation of the DORA Register of Information core template relationships (entity / ICT third-party providers / functions / contractual arrangements), OIM-report-model-shaped. This kernel does NOT emit xBRL-CSV (the RoI\'s official submission format); it validates LEI format, referential integrity across templates, and mandatory-field completeness only. Criticality designation of functions/providers is a caller-supplied input, not computed here, and is not an approval or sign-off record.',
  };

  return { output_payload, compliance_flags: flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
