import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-300-aca-226j-response-evidence-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_226j_response_evidence_pack',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Response-window length: Letter 226J traditionally carries a 30-day response period; some
// 2026 practitioner sources report the IRS extending this to 90 days for certain tax years.
// DRAFT-PIN at 30 days (the long-standing documented figure) pending a confirmed Rev. Proc.
// or Letter 226J instructions citation — re-verify before relying on the computed deadline.
const RESPONSE_WINDOW_DAYS = 30;
const RESPONSE_WINDOW_SOURCE = 'DRAFT-PIN 30 days (traditional Letter 226J response period; unconfirmed 90-day reports as of 2026-07-13 not yet reconciled to a cited Rev. Proc.)';

// Pure-arithmetic proleptic Gregorian civil-date <-> day-count (Howard Hinnant's
// days_from_civil / civil_from_days algorithm). No Date object, no clock read, fully
// deterministic and exec-check-friendly for the zkVM guest (riders ban Date() in compute()).
function daysFromCivil(y, m, d) {
  y = m <= 2 ? y - 1 : y;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function civilFromDays(z) {
  z += 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: m <= 2 ? y + 1 : y, m, d };
}
function pad2(n) { return String(n).padStart(2, '0'); }

function parseIsoDate(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}
function addDaysIso(isoDate, days) {
  const civil = parseIsoDate(isoDate);
  if (!civil) return null;
  const jd = daysFromCivil(civil.y, civil.m, civil.d) + days;
  const out = civilFromDays(jd);
  return out.y + '-' + pad2(out.m) + '-' + pad2(out.d);
}

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

// Named-human attestation closure — mirrors the shipped ML-2 escalation -> named-human
// closure pattern (reference, not restate): a resume/closure is only recorded once a real
// named human + role + timestamp signs off, never an anonymous or auto-generated actor.
function attestationVerdict(attestation) {
  if (!isObj(attestation)) return { status: 'pending_named_human_closure', signer_name: null, signer_title: null, signed_at: null };
  const name = typeof attestation.name === 'string' && attestation.name.trim() ? attestation.name.trim() : null;
  const title = typeof attestation.title === 'string' && attestation.title.trim() ? attestation.title.trim() : null;
  const signedAt = typeof attestation.timestamp === 'string' && attestation.timestamp.trim() ? attestation.timestamp.trim() : null;
  if (!name || !title || !signedAt) return { status: 'pending_named_human_closure', signer_name: name, signer_title: title, signed_at: signedAt };
  return { status: 'closed', signer_name: name, signer_title: title, signed_at: signedAt };
}

export function compute(pp) {
  const letterDateIso = typeof pp.letter_date === 'string' ? pp.letter_date : null;
  const irsAssertedEsrp = num(pp.irs_asserted_esrp_annual);
  const affordability = isObj(pp.affordability_result) ? pp.affordability_result : null;
  const esrp = isObj(pp.esrp_result) ? pp.esrp_result : null;
  const disputedIds = Array.isArray(pp.disputed_employee_ids) ? pp.disputed_employee_ids : [];

  const responseDeadline = letterDateIso ? addDaysIso(letterDateIso, RESPONSE_WINDOW_DAYS) : null;

  if (!letterDateIso || !responseDeadline || irsAssertedEsrp === null || !affordability || !esrp) {
    return {
      output_payload: {
        letter_date: letterDateIso,
        response_window_days: RESPONSE_WINDOW_DAYS,
        response_window_source: RESPONSE_WINDOW_SOURCE,
        response_deadline: null,
        recomputed_exposure_annual: null,
        irs_asserted_esrp_annual: irsAssertedEsrp,
        exposure_delta: null,
        disputed_employee_count: disputedIds.length,
        attestation: attestationVerdict(pp.attestation),
        error: !letterDateIso || !responseDeadline ? 'missing_or_malformed_letter_date' : irsAssertedEsrp === null ? 'missing_irs_asserted_esrp_annual' : 'missing_upstream_affordability_or_esrp_result',
      },
      compliance_flags: ['ACA_226J_EVIDENCE_PACK_PARAMETER_NOT_SUPPLIED'],
    };
  }

  const recomputedExposure = num(esrp.controlling_exposure_annual) ?? 0;
  const exposureDelta = recomputedExposure - irsAssertedEsrp;
  const attestation = attestationVerdict(pp.attestation);

  const compliance_flags = ['ACA_226J_EVIDENCE_PACK_ASSEMBLED'];
  compliance_flags.push(exposureDelta === 0 ? 'ACA_226J_RECOMPUTATION_MATCHES_ASSERTED' : 'ACA_226J_RECOMPUTATION_DISPUTES_ASSERTED');
  compliance_flags.push(attestation.status === 'closed' ? 'ACA_226J_ATTESTATION_CLOSED' : 'ACA_226J_ATTESTATION_PENDING');

  return {
    output_payload: {
      letter_date: letterDateIso,
      response_window_days: RESPONSE_WINDOW_DAYS,
      response_window_source: RESPONSE_WINDOW_SOURCE,
      response_deadline: responseDeadline,
      recomputed_exposure_annual: recomputedExposure,
      irs_asserted_esrp_annual: irsAssertedEsrp,
      exposure_delta: exposureDelta,
      disputed_employee_count: disputedIds.length,
      attestation,
      error: null,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
