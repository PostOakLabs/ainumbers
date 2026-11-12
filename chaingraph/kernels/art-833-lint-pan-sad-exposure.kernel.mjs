import { executionHash } from './_hash.mjs';

// art-833-lint-pan-sad-exposure — PAN display-masking and sensitive-authentication-data (SAD)
// retention linter for a synthetic token-record schema. Behavioural rules are taken from the
// pinned PCI DSS v4.0.1 clause excerpts registered under digests listed in the node shard's
// cited_clause_digest (KERNEL-CITATION-CLASS-1: citations live in node metadata, never here).
//
// Rule packs (all vendor-neutral; the kernel names no vendor):
//   A. Display masking - a PAN display may reveal at most the first six digits (BIN) and the
//      last four digits. Applied to field mask expressions, the alias template, and the
//      declared search-index expressions.
//   B. SAD retention - sensitive authentication data (full track data, card verification
//      code, PIN or PIN block) is not stored after authorization, even if encrypted.
//      Non-persistent short-term retention raises a manual-review refusal because the
//      carve-out conditions are facts the caller owns.
//   C. Digest exposure - a hash presented as rendering PAN unreadable must cover the entire
//      PAN and must be keyed; hashed-and-truncated coexistence raises a correlation
//      manual-review because the additional-controls fact is caller-owned.
//
// DETERMINISM: compute() is a pure function of pp - no clock, no randomness, no network,
// no filesystem, and no TextEncoder/atob/btoa/URL (absent in the QuickJS-ng zkVM guest;
// chaingraph/kernels/check-guest-builtin-safety.mjs enforces this over every fixture).

const TOOL_ID = 'art-833-lint-pan-sad-exposure';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_pan_sad_exposure',
  mandate_type: 'compliance_control', gpu: false,
};

// Closed input vocabularies. A value outside its set refuses the whole call (AUTHORING
// STANDARD section 1: refusal-carrying branches are reachable paths, not prose).
const VALUE_CLASSES = [
  'primary_account_number', 'card_verification_code', 'pin_or_pin_block',
  'full_track_data', 'deterministic_digest', 'other',
];
const SAD_CLASSES = ['none', 'full_track_data', 'card_verification_code', 'pin_or_pin_block'];
const RETENTION_STATES = ['before_authorization', 'during_authorization_only', 'after_authorization'];
const STORAGE_CLASSES = ['persistent', 'non_persistent_memory', 'ephemeral_process'];
// SAD subclasses carry their own sub-requirement in the pinned text; the mapping is metadata
// mirrored into per-element verdicts (paragraph paths are carried by the caller-facing report).
const SAD_SUB_RULE = {
  full_track_data: '3.3.1.1',
  card_verification_code: '3.3.1.2',
  pin_or_pin_block: '3.3.1.3',
};

// Display ceiling: the first six digits (BIN) and the last four digits are the maximum a
// display may reveal. These bounds are constants of the checked rule, not caller input.
const MASK_PREFIX_CEILING = 6;
const MASK_SUFFIX_CEILING = 4;

// Parse one mask expression: comma-separated directives, each `name` or `name:N`.
// Recognised: prefix:N, suffix:N, redact:N, redact:all, plain. Anything else is
// unparseable and refuses the call rather than guessing.
function parseMask(expr) {
  const trimmed = String(expr == null ? '' : expr).trim();
  if (trimmed === '') {
    // An absent or empty mask is a recognized no-mask state: the field verdict path reports
    // full_display rather than refusing, because that is the finding the lint exists to catch.
    return { recognized: true, directives: [] };
  }
  if (trimmed.toLowerCase() === 'plain') {
    return { recognized: true, directives: [{ name: 'plain' }] };
  }
  const directives = [];
  for (const part of trimmed.split(',')) {
    const token = part.trim();
    if (token === '') continue;
    const m = /^([a-z_]+)(?::(\d+|all))?$/i.exec(token);
    if (!m) return { recognized: false, directives: [] };
    const name = m[1].toLowerCase();
    const arg = m[2];
    if (name === 'prefix' || name === 'suffix' || name === 'redact') {
      if (arg == null) return { recognized: false, directives: [] };
      if (name !== 'redact' && arg === 'all') return { recognized: false, directives: [] };
      directives.push({ name, count: arg === 'all' ? Infinity : parseInt(arg, 10) });
    } else if (name === 'plain') {
      if (arg != null) return { recognized: false, directives: [] };
      directives.push({ name: 'plain' });
    } else {
      return { recognized: false, directives: [] };
    }
  }
  if (directives.length === 0) return { recognized: false, directives: [] };
  return { recognized: true, directives };
}

// Digits of a PAN a mask expression reveals, against the display ceiling.
function maskExposure(parsed) {
  let prefix = 0;
  let suffix = 0;
  let full = false;
  for (const d of parsed.directives) {
    if (d.name === 'plain') full = true;
    if (d.name === 'prefix') prefix += d.count;
    if (d.name === 'suffix') suffix += d.count;
  }
  return { prefix, suffix, full };
}

// Apply the same grammar to an alias template or search-index expression: recognised
// directives inside the string count toward the ceiling; a string with none is reported
// as not analyzable (manual review), never silently clean.
function analyzeDisplayExpression(raw) {
  const text = String(raw == null ? '' : raw);
  const found = text.matchAll(/(prefix|suffix):(\d+)|\bplain\b/gi);
  let prefix = 0;
  let suffix = 0;
  let hits = 0;
  let full = false;
  for (const m of found) {
    hits += 1;
    if (!m[1]) full = true;
    if (m[1] === 'prefix') prefix += parseInt(m[2], 10);
    if (m[1] === 'suffix') suffix += parseInt(m[2], 10);
  }
  return { expression: text, recognized_directives: hits, prefix_digits: prefix, suffix_digits: suffix, full, analyzable: hits > 0 };
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

export function compute(pp) {
  pp = pp || {};
  const refusalReasons = [];
  const record = isPlainObject(pp.record) ? pp.record : null;
  const storedElements = Array.isArray(pp.stored_elements) ? pp.stored_elements : null;
  if (!record) refusalReasons.push('record object missing');
  if (!storedElements) refusalReasons.push('stored_elements array missing');
  if (refusalReasons.length > 0) {
    return {
      output_payload: {
        verdict: 'input_refused',
        refusal_reasons: refusalReasons,
        findings: [], manual_review: [],
        issues: ['input refused: ' + refusalReasons.join('; ')],
        manual_review_required: false,
        findings_count: 0, manual_review_count: 0,
      },
      compliance_flags: ['INPUT_REFUSED'],
    };
  }

  const fields = Array.isArray(record.fields) ? record.fields : [];
  if (fields.length === 0) refusalReasons.push('record.fields empty');
  for (const f of fields) {
    if (!isPlainObject(f) || typeof f.name !== 'string' || f.name === '') {
      refusalReasons.push('field without a name');
      continue;
    }
    if (!VALUE_CLASSES.includes(f.value_class)) {
      refusalReasons.push('field "' + f.name + '" has unknown value_class "' + String(f.value_class) + '"');
    }
    if (f.value_class === 'primary_account_number') {
      const parsed = parseMask(f.mask_expression);
      if (!parsed.recognized) {
        refusalReasons.push('field "' + f.name + '" mask_expression unparseable: "' + String(f.mask_expression) + '"');
      }
    }
    if (f.value_class === 'deterministic_digest') {
      if (typeof f.digest_target !== 'string' || f.digest_target === '') {
        refusalReasons.push('field "' + f.name + '" deterministic_digest missing digest_target');
      }
      if (typeof f.digest_keyed !== 'boolean') {
        refusalReasons.push('field "' + f.name + '" deterministic_digest missing boolean digest_keyed');
      }
    }
  }
  for (const e of storedElements) {
    if (!isPlainObject(e) || typeof e.name !== 'string' || e.name === '') {
      refusalReasons.push('stored element without a name');
      continue;
    }
    if (!SAD_CLASSES.includes(e.sad_class)) {
      refusalReasons.push('stored element "' + e.name + '" has unknown sad_class "' + String(e.sad_class) + '"');
    }
    if (!RETENTION_STATES.includes(e.retention)) {
      refusalReasons.push('stored element "' + e.name + '" has unknown retention "' + String(e.retention) + '"');
    }
    if (!STORAGE_CLASSES.includes(e.storage_location_class)) {
      refusalReasons.push('stored element "' + e.name + '" has unknown storage_location_class "' + String(e.storage_location_class) + '"');
    }
    if (typeof e.encrypted !== 'boolean') {
      refusalReasons.push('stored element "' + e.name + '" missing boolean encrypted');
    }
  }

  if (refusalReasons.length > 0) {
    return {
      output_payload: {
        verdict: 'input_refused',
        refusal_reasons: refusalReasons,
        findings: [], manual_review: [],
        issues: refusalReasons.map((r) => 'input refused: ' + r),
        manual_review_required: false,
        findings_count: 0, manual_review_count: 0,
      },
      compliance_flags: ['INPUT_REFUSED'],
    };
  }

  const findings = [];
  const manualReview = [];

  // Rule pack A: display masking, per field (PAN fields only; the masking rule governs PAN
  // displays, not other field types).
  const fieldExposure = [];
  for (const f of fields) {
    if (f.value_class !== 'primary_account_number') continue;
    const parsed = parseMask(f.mask_expression);
    const exp = maskExposure(parsed);
    let verdict;
    if (exp.full || (!exp.full && exp.prefix === 0 && exp.suffix === 0 && parsed.directives.length === 0)) {
      verdict = 'full_display';
    } else if (exp.prefix > MASK_PREFIX_CEILING || exp.suffix > MASK_SUFFIX_CEILING) {
      verdict = 'exceeds_ceiling';
    } else {
      verdict = 'within_ceiling';
    }
    if (verdict === 'exceeds_ceiling') {
      findings.push({
        code: 'MASK_DISPLAY_EXCEEDS_CEILING',
        subject: f.name,
        message: 'mask reveals prefix=' + exp.prefix + ' suffix=' + exp.suffix
          + ' digits; the display ceiling is the first ' + MASK_PREFIX_CEILING
          + ' (BIN) and last ' + MASK_SUFFIX_CEILING + ' digits',
        paragraph: 'Requirement 3.4.1',
      });
    }
    if (verdict === 'full_display') {
      findings.push({
        code: 'MASK_DISPLAY_FULL_PAN',
        subject: f.name,
        message: 'no recognized mask directive: the field displays the full PAN',
        paragraph: 'Requirement 3.4.1',
      });
    }
    fieldExposure.push({
      field: f.name,
      prefix_digits: exp.prefix,
      suffix_digits: exp.suffix,
      ceiling: { prefix: MASK_PREFIX_CEILING, suffix: MASK_SUFFIX_CEILING },
      verdict,
    });
  }

  // Rule pack A applied to the alias template and each declared search-index expression.
  // Undeclared surfaces are not demanded: only an expression the caller declares is analyzed,
  // and a declared expression that carries no recognizable directive is a manual review, not
  // a silent pass.
  const hasAlias = typeof record.alias_template === 'string' && record.alias_template !== '';
  const searchInputs = (Array.isArray(record.search_index_expressions) ? record.search_index_expressions : [])
    .filter((e) => typeof e === 'string' && e !== '');
  const aliasAnalysis = hasAlias ? analyzeDisplayExpression(record.alias_template) : { expression: null, recognized_directives: 0, prefix_digits: 0, suffix_digits: 0, analyzable: false, declared: false };
  if (hasAlias) aliasAnalysis.declared = true;
  if (aliasAnalysis.analyzable
    && (aliasAnalysis.prefix_digits > MASK_PREFIX_CEILING || aliasAnalysis.suffix_digits > MASK_SUFFIX_CEILING)) {
    findings.push({
      code: 'ALIAS_DISPLAY_EXCEEDS_CEILING',
      subject: 'alias_template',
      message: 'alias template reveals prefix=' + aliasAnalysis.prefix_digits + ' suffix='
        + aliasAnalysis.suffix_digits + ' digits, above the display ceiling',
      paragraph: 'Requirement 3.4.1',
    });
  }
  const searchIndexAnalysis = searchInputs.map((e) => analyzeDisplayExpression(e));
  for (const s of searchIndexAnalysis) {
    if (s.analyzable && (s.prefix_digits > MASK_PREFIX_CEILING || s.suffix_digits > MASK_SUFFIX_CEILING)) {
      findings.push({
        code: 'SEARCH_INDEX_DISPLAY_EXCEEDS_CEILING',
        subject: 'search_index_expressions',
        message: 'search index expression reveals prefix=' + s.prefix_digits + ' suffix='
          + s.suffix_digits + ' digits, above the display ceiling',
        paragraph: 'Requirement 3.4.1',
      });
    }
  }
  const fullSurfaces = [{ a: aliasAnalysis, subject: 'alias_template' }]
    .concat(searchIndexAnalysis.map((a) => ({ a, subject: 'search_index_expressions' })));
  for (const s of fullSurfaces) {
    if (s.a.full) {
      findings.push({
        code: 'MASK_DISPLAY_FULL_PAN',
        subject: s.subject,
        message: 'the expression declares plain display: it shows the full PAN',
        paragraph: 'Requirement 3.4.1',
      });
    }
  }
  const aliasUnanalyzed = (hasAlias && !aliasAnalysis.analyzable) || searchIndexAnalysis.some((s) => !s.analyzable);

  // Rule pack B: SAD retention.
  const retentionVerdicts = [];
  for (const e of storedElements) {
    if (e.sad_class === 'none') {
      retentionVerdicts.push({
        element: e.name, sad_class: e.sad_class, retention: e.retention,
        storage_location_class: e.storage_location_class, encrypted: e.encrypted,
        verdict: 'no_sad_element',
      });
      continue;
    }
    let verdict;
    if (e.retention === 'after_authorization' && e.storage_location_class === 'persistent') {
      verdict = 'sad_stored_after_authorization';
      findings.push({
        code: 'SAD_STORED_AFTER_AUTHORIZATION',
        subject: e.name,
        message: 'stores ' + e.sad_class + ' after authorization in persistent storage'
          + (e.encrypted ? ' (stored encrypted, which the rule does not except)' : ''),
        paragraph: 'Requirement 3.3.1' + (SAD_SUB_RULE[e.sad_class] ? ' / ' + SAD_SUB_RULE[e.sad_class] : ''),
      });
    } else if (e.retention === 'after_authorization') {
      verdict = 'manual_review_required';
      manualReview.push({
        code: 'SAD_NONPERSISTENT_MANUAL_REVIEW',
        subject: e.name,
        message: 'holds ' + e.sad_class + ' after authorization in ' + e.storage_location_class
          + '; the carve-out conditions (business need, non-persistent state controls, prompt removal)'
          + ' are caller-owned facts this check cannot verify',
        paragraph: 'Requirement 3.3.1 (non-persistent memory guidance)',
      });
    } else {
      verdict = 'not_after_authorization';
    }
    retentionVerdicts.push({
      element: e.name, sad_class: e.sad_class, retention: e.retention,
      storage_location_class: e.storage_location_class, encrypted: e.encrypted,
      verdict,
    });
  }

  // Rule pack C: digest fields.
  const digestVerdicts = [];
  let digestOverFullPan = false;
  let truncatedPanDisplayed = fieldExposure.some((x) => x.verdict === 'within_ceiling');
  for (const f of fields) {
    if (f.value_class !== 'deterministic_digest') continue;
    const entire = f.digest_target === 'entire_pan';
    let verdict = 'entire_pan_keyed';
    if (!entire) {
      verdict = 'digest_target_not_entire_pan';
      findings.push({
        code: 'DIGEST_TARGET_NOT_ENTIRE_PAN',
        subject: f.name,
        message: 'digest target "' + f.digest_target
          + '" is a PAN fragment or a low-entropy value; a hash used to render PAN unreadable'
          + ' must be of the entire PAN, and a short keyspace is recoverable by brute force',
        paragraph: 'Requirement 3.5.1 (one-way hashes of the entire PAN; truncation bullet)',
      });
    } else if (!f.digest_keyed) {
      verdict = 'digest_unkeyed';
      digestOverFullPan = true;
      findings.push({
        code: 'DIGEST_UNKEYED_ENTIRE_PAN',
        subject: f.name,
        message: 'unkeyed hash of the entire PAN; hashes used to render PAN unreadable must be'
          + ' keyed cryptographic hashes',
        paragraph: 'Requirement 3.5.1.1',
      });
    } else {
      digestOverFullPan = true;
    }
    digestVerdicts.push({
      field: f.name, digest_target: f.digest_target, keyed: f.digest_keyed, verdict,
    });
  }

  // Hashed and truncated versions of the same PAN coexisting: the additional-controls fact
  // is caller-owned, so the check refuses to answer and asks for review instead.
  if (digestOverFullPan && truncatedPanDisplayed) {
    manualReview.push({
      code: 'DIGEST_TRUNCATION_CORRELATION_REVIEW',
      subject: 'record',
      message: 'a keyed digest of the entire PAN and a truncated PAN display coexist in one'
        + ' record; whether additional controls prevent correlation is a caller-owned fact'
        + ' this check cannot verify',
      paragraph: 'Requirement 3.5.1.c',
    });
  }

  const flags = [];
  for (const f of findings) flags.push(f.code);
  for (const m of manualReview) flags.push(m.code);
  if (aliasUnanalyzed) {
    flags.push('DISPLAY_EXPRESSION_NOT_ANALYZED');
    manualReview.push({
      code: 'DISPLAY_EXPRESSION_NOT_ANALYZED',
      subject: 'alias_template/search_index_expressions',
      message: 'an alias template or search index expression carries no recognizable display'
        + ' directive, so its revealed digit count is unknown',
      paragraph: 'Requirement 3.4.1',
    });
  }

  const verdict = findings.length > 0 ? 'findings_present' : (manualReview.length > 0 ? 'manual_review_required' : 'no_findings');
  const issues = [];
  for (const f of findings) issues.push(f.code + ': ' + f.message);
  for (const m of manualReview) issues.push(m.code + ': ' + m.message);

  return {
    output_payload: {
      verdict,
      ceilings: { display_prefix: MASK_PREFIX_CEILING, display_suffix: MASK_SUFFIX_CEILING },
      field_exposure: fieldExposure,
      alias_analysis: aliasAnalysis,
      search_index_analysis: searchIndexAnalysis,
      retention_verdicts: retentionVerdicts,
      digest_verdicts: digestVerdicts,
      findings,
      manual_review: manualReview,
      issues,
      manual_review_required: manualReview.length > 0,
      findings_count: findings.length,
      manual_review_count: manualReview.length,
      container_path: typeof record.container_path === 'string' ? record.container_path : null,
      record_type: typeof record.record_type === 'string' ? record.record_type : null,
    },
    compliance_flags: flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
