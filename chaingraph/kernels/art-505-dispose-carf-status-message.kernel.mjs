/**
 * art-505-dispose-carf-status-message.kernel.mjs
 * Assurance Waves program (CARF-DAC8-BUILD-SPEC.md §2, CARF-K-1) — CARF / DAC8
 * status-message disposition: turns a returned status message into a dispositioned break list.
 *
 * This is art-491's shape (ro-remediation-closure) applied to a second regime where the same
 * file-comes-back mechanic exists. The differentiator is not the break list: it is that a
 * SIGNED disposition is carried across cycles, so the answer to "why is this error still here"
 * survives from one reporting cycle to the next with a named person attached to it.
 *
 * ⛔ THE RETURN PATH IS NOT ASSUMED — STEP-0 FINDING, verified 2026-07-30.
 * The OECD Crypto-Asset Reporting Framework Status Message XML Schema (user guide published
 * 2 June 2025) is normatively a Competent-Authority-to-Competent-Authority instrument: it lets
 * a receiving Competent Authority report file-level and record-level errors back to the sending
 * Competent Authority. The OECD states the schema may ALSO be used for domestic reporting of
 * CARF information, to the extent permitted under the domestic law of the relevant jurisdiction.
 * That is a permission, not a guarantee, and it is jurisdiction-specific. It is therefore NOT
 * the same standing guarantee as the IRS ICMM notifications that art-491 consumes.
 * Consequence, enforced in this kernel rather than merely documented: the operator must DECLARE
 * that its jurisdiction returns a status message to it, and name the channel. Absent that
 * declaration the kernel returns a defined status_message_return_not_declared verdict and
 * produces NO break list. It does not build past an undeclared return path.
 *
 * WHAT IS POLICY INPUT AND WHAT IS KERNEL SOURCE
 * No CARF error-code table is hardcoded. The status message's own error codes and field paths
 * arrive as data; the caller supplies schema_version and a suppressed_error_codes deactivation
 * list. The kernel is a deterministic evaluator over what it is given.
 *
 * DEACTIVATION / SUPPRESSION (F3, CARF-DAC8-BUILD-SPEC.md §3 — BLOCKING design rule)
 * A suppressed error_code produces NO break at all, and every suppression applied is echoed
 * (suppressed_error_codes + suppressed_break_count) so the exclusion is visible in the artifact.
 * The input exists and defaults empty even though no CARF deactivation list is published yet.
 *
 * ⛔ POSITIONING (F6): free CARF and CRS XML validators exist and they validate and stop.
 * This is not a better validator. It starts where they stop: after the authority has already
 * answered, tying each returned error to the record and field that caused it and carrying a
 * named, signed disposition forward.
 *
 * ⛔ PII: records are identified by opaque caller-supplied refs (doc_ref_id, record_ref) only.
 * No name, TIN, address or date of birth is taken. Fixtures are SYNTHETIC (CONTRACT §1.3).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute(). There is no clock:
 * cycle_ref and prior cycle refs are caller-declared strings, never compared against "now".
 *
 * Spec: CARF-DAC8-BUILD-SPEC.md §0 + §2 + §3 (CARF-K-1, art-505).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-505-dispose-carf-status-message';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'dispose_carf_status_message', mandate_type: 'compliance_mandate', gpu: false };

const FILE_LEVEL = '(file-level)';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function strArray(v) {
  return Array.isArray(v) ? v.filter(isNonEmptyString) : [];
}

// A disposition is countable evidence only when it carries a signature bound to a named
// signer. An unsigned disposition is a note, not an accountable decision, and is rejected
// with its reason rather than silently counted.
function signatureOf(d) {
  const sig = d && typeof d.signature === 'object' && d.signature !== null ? d.signature : null;
  if (!sig) return { ok: false, reason: 'No signature block is present on the disposition.' };
  if (!isNonEmptyString(sig.signer_identity_id)) return { ok: false, reason: 'The signature names no signer_identity_id.' };
  if (!isNonEmptyString(sig.signature_value)) return { ok: false, reason: 'The signature carries no signature_value bound to the named signer.' };
  return { ok: true, signer_identity_id: sig.signer_identity_id, verification_method: isNonEmptyString(sig.verification_method) ? sig.verification_method : null };
}

export function compute(pp) {
  pp = pp || {};
  const submission_ref = isNonEmptyString(pp.submission_ref) ? pp.submission_ref : '';
  const reporting_jurisdiction = isNonEmptyString(pp.reporting_jurisdiction) ? pp.reporting_jurisdiction : '';
  const schema_version = isNonEmptyString(pp.schema_version) ? pp.schema_version : '';
  const cycle_ref = isNonEmptyString(pp.cycle_ref) ? pp.cycle_ref : '';
  const status_message_return_declared = pp.status_message_return_declared === true;
  const status_message_channel = isNonEmptyString(pp.status_message_channel) ? pp.status_message_channel : '';

  const suppressed_error_codes = strArray(pp.suppressed_error_codes);
  const suppressedSet = new Set(suppressed_error_codes);

  const sm = pp.status_message && typeof pp.status_message === 'object' ? pp.status_message : {};
  const message_ref = isNonEmptyString(sm.message_ref) ? sm.message_ref : '';
  const file_errors = Array.isArray(sm.file_errors) ? sm.file_errors : [];
  const record_errors = Array.isArray(sm.record_errors) ? sm.record_errors : [];

  const submitted_records = Array.isArray(pp.submitted_records) ? pp.submitted_records : [];
  const dispositions = Array.isArray(pp.dispositions) ? pp.dispositions : [];
  const prior_dispositions = Array.isArray(pp.prior_dispositions) ? pp.prior_dispositions : [];

  // ── The blocking boundary. An undeclared return path is a stated verdict, not a guess. ──
  if (!status_message_return_declared || !status_message_channel) {
    const output_payload = {
      submission_ref: submission_ref,
      reporting_jurisdiction: reporting_jurisdiction,
      schema_version: schema_version,
      cycle_ref: cycle_ref,
      status_message_return_declared: status_message_return_declared,
      status_message_channel: status_message_channel,
      verdict: 'status_message_return_not_declared',
      verdict_reason: 'No status-message return path was declared for this reporting jurisdiction. The OECD CARF Status Message XML Schema is a Competent-Authority-to-Competent-Authority instrument that a jurisdiction may also make available domestically to the extent its own law permits. Whether this operator receives one is therefore a fact about this jurisdiction that the operator must declare. No break list is produced from an undeclared return path.',
      resolving_input: 'status_message_return_declared set true together with status_message_channel naming how the status message reaches this operator.',
      message_ref: message_ref,
      breaks: [],
      break_count: 0,
      open_break_count: 0,
      dispositioned_break_count: 0,
      carried_forward_count: 0,
      unresolved_record_reference_count: 0,
      unsigned_dispositions_rejected: [],
      suppressed_error_codes: suppressed_error_codes,
      suppressed_break_count: 0,
      note: 'This tool consumes a status message the operator already holds. It does not fetch, submit or transmit anything, it makes no claim that any output is submittable, and it is not legal or tax advice.',
    };
    return { output_payload, compliance_flags: ['CARF_STATUS_MESSAGE_RETURN_NOT_DECLARED'] };
  }

  // Index the submitted records so every returned error can be tied back to a record.
  const recordByDocRef = new Map();
  submitted_records.forEach((raw) => {
    const rec = raw && typeof raw === 'object' ? raw : {};
    if (isNonEmptyString(rec.doc_ref_id)) recordByDocRef.set(rec.doc_ref_id, rec);
  });

  const dispositionByBreak = new Map();
  dispositions.forEach((raw) => {
    const d = raw && typeof raw === 'object' ? raw : {};
    if (isNonEmptyString(d.break_ref)) dispositionByBreak.set(d.break_ref, d);
  });
  const priorByBreak = new Map();
  prior_dispositions.forEach((raw) => {
    const d = raw && typeof raw === 'object' ? raw : {};
    if (isNonEmptyString(d.break_ref)) priorByBreak.set(d.break_ref, d);
  });

  const breaks = [];
  const unsigned_dispositions_rejected = [];
  let suppressed_break_count = 0;

  function breakRef(error_code, doc_ref_id, field_path) {
    return `${error_code}:${doc_ref_id || FILE_LEVEL}:${field_path || FILE_LEVEL}`;
  }

  function addBreak(level, rawErr, idx) {
    const e = rawErr && typeof rawErr === 'object' ? rawErr : {};
    const error_code = isNonEmptyString(e.error_code) ? e.error_code : `(unnamed-${level}-error-${idx})`;
    if (suppressedSet.has(error_code)) { suppressed_break_count += 1; return; }

    const doc_ref_id = isNonEmptyString(e.doc_ref_id) ? e.doc_ref_id : null;
    const field_path = isNonEmptyString(e.field_path) ? e.field_path : null;
    const break_ref = breakRef(error_code, doc_ref_id, field_path);

    const rec = doc_ref_id ? recordByDocRef.get(doc_ref_id) : null;
    const record_ref = rec && isNonEmptyString(rec.record_ref) ? rec.record_ref : null;
    // A record-level error whose DocRefId matches nothing the operator submitted is itself a
    // finding: it means the operator cannot show which record the authority is complaining about.
    const unresolved_record_reference = level === 'record' && !rec;

    // Disposition resolution: this cycle wins, otherwise a prior cycle's disposition is carried
    // forward and marked as carried, otherwise the break is open.
    const current = dispositionByBreak.get(break_ref) || null;
    const prior = priorByBreak.get(break_ref) || null;
    const source = current || prior;

    let disposition = null;
    let disposition_reason = null;
    let decided_by = null;
    let decided_in_cycle = null;
    let carried_from_cycle = null;
    let signature_verification_method = null;
    let status;

    if (source) {
      const sig = signatureOf(source);
      if (!sig.ok) {
        unsigned_dispositions_rejected.push({
          break_ref: break_ref,
          declared_disposition: isNonEmptyString(source.disposition) ? source.disposition : null,
          rejected_because: sig.reason,
          carried: current ? false : true,
        });
        status = 'open';
      } else if (!isNonEmptyString(source.disposition)) {
        unsigned_dispositions_rejected.push({
          break_ref: break_ref,
          declared_disposition: null,
          rejected_because: 'The record is signed but states no disposition.',
          carried: current ? false : true,
        });
        status = 'open';
      } else {
        disposition = source.disposition;
        disposition_reason = isNonEmptyString(source.disposition_reason) ? source.disposition_reason : null;
        decided_by = sig.signer_identity_id;
        signature_verification_method = sig.verification_method;
        decided_in_cycle = isNonEmptyString(source.decided_in_cycle) ? source.decided_in_cycle : (current ? cycle_ref : null);
        if (!current) carried_from_cycle = decided_in_cycle;
        status = 'dispositioned';
      }
    } else {
      status = 'open';
    }

    breaks.push({
      break_ref: break_ref,
      level: level,
      error_code: error_code,
      error_detail: isNonEmptyString(e.error_detail) ? e.error_detail : null,
      doc_ref_id: doc_ref_id,
      field_path: field_path,
      record_ref: record_ref,
      unresolved_record_reference: unresolved_record_reference,
      status: status,
      disposition: disposition,
      disposition_reason: disposition_reason,
      decided_by: decided_by,
      signature_verification_method: signature_verification_method,
      decided_in_cycle: decided_in_cycle,
      carried_from_cycle: carried_from_cycle,
    });
  }

  file_errors.forEach((e, i) => addBreak('file', e, i));
  record_errors.forEach((e, i) => addBreak('record', e, i));

  const open_break_count = breaks.filter((b) => b.status === 'open').length;
  const dispositioned_break_count = breaks.filter((b) => b.status === 'dispositioned').length;
  const carried_forward_count = breaks.filter((b) => b.carried_from_cycle !== null).length;
  const unresolved_record_reference_count = breaks.filter((b) => b.unresolved_record_reference).length;

  const compliance_flags = [];
  if (breaks.length === 0) compliance_flags.push('CARF_STATUS_MESSAGE_CLEAN');
  if (open_break_count > 0) compliance_flags.push('CARF_BREAKS_OPEN');
  if (breaks.length > 0 && open_break_count === 0) compliance_flags.push('CARF_ALL_BREAKS_DISPOSITIONED');
  if (carried_forward_count > 0) compliance_flags.push('CARF_DISPOSITIONS_CARRIED_FORWARD');
  if (unsigned_dispositions_rejected.length > 0) compliance_flags.push('CARF_UNSIGNED_DISPOSITIONS_REJECTED');
  if (unresolved_record_reference_count > 0) compliance_flags.push('CARF_UNRESOLVED_RECORD_REFERENCES');
  if (suppressed_break_count > 0) compliance_flags.push('CARF_SUPPRESSED_ERROR_CODES_APPLIED');
  if (!schema_version) compliance_flags.push('CARF_SCHEMA_VERSION_UNPINNED');

  const output_payload = {
    submission_ref: submission_ref,
    reporting_jurisdiction: reporting_jurisdiction,
    schema_version: schema_version,
    cycle_ref: cycle_ref,
    status_message_return_declared: status_message_return_declared,
    status_message_channel: status_message_channel,
    verdict: breaks.length === 0 ? 'no_breaks_returned' : (open_break_count > 0 ? 'breaks_open' : 'all_breaks_dispositioned'),
    verdict_reason: breaks.length === 0
      ? 'The status message returned no error this run reports, after any suppressions were applied.'
      : (open_break_count > 0
        ? `${open_break_count} break(s) carry no signed disposition.`
        : 'Every break carries a signed disposition, either taken this cycle or carried forward from a prior one.'),
    resolving_input: null,
    message_ref: message_ref,
    breaks: breaks,
    break_count: breaks.length,
    open_break_count: open_break_count,
    dispositioned_break_count: dispositioned_break_count,
    carried_forward_count: carried_forward_count,
    unresolved_record_reference_count: unresolved_record_reference_count,
    unsigned_dispositions_rejected: unsigned_dispositions_rejected,
    suppressed_error_codes: suppressed_error_codes,
    suppressed_break_count: suppressed_break_count,
    note: 'Deterministic disposition of a returned CARF or DAC8 status message the operator already holds. Each returned file-level and record-level error is tied to the record and field that caused it, and each disposition is countable only when signed by a named signer, whether taken this cycle or carried forward from a prior one. Error codes arrive as data and the schema version is a pinned policy input, never kernel source. A suppressed error_code produces no break at all. This tool does not fetch, submit or transmit anything, it makes no claim that any output is submittable, and it is not legal or tax advice.',
  };

  return { output_payload, compliance_flags };
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
