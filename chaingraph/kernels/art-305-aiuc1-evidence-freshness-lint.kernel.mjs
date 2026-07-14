import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-305-aiuc1-evidence-freshness-lint';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_insurance_evidence_freshness',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Honesty guard (INSURANCE-EVIDENCE-SPEC.md §GUARDS): freshness/expiry flags only, never a
// certification claim. Pure civil-calendar day-count arithmetic (Howard Hinnant's
// days_from_civil algorithm) -- NEVER a `Date` object, per the deterministic-kernel rule
// (SPEC.md §18.5): `Date` is locale/timezone-sensitive and breaks byte-identical proving
// across browser V8, Worker V8, QuickJS, and the RV32IM zkVM guest.
// Cadence: AIUC-1 quarterly re-test window (90 days). Cert-expiring warning window: 30 days.

export const STALE_AFTER_DAYS = 90;
export const CERT_EXPIRY_WARNING_DAYS = 30;

// Days since the civil epoch (0000-03-01), proleptic Gregorian. Pure integer arithmetic.
export function daysFromCivil(y, m, d) {
  y = m <= 2 ? y - 1 : y;
  const era = (y >= 0 ? y : y - 399) / 400 | 0;
  const yoe = y - era * 400;
  const doy = ((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 | 0) + d - 1;
  const doe = yoe * 365 + (yoe / 4 | 0) - (yoe / 100 | 0) + doy;
  return era * 146097 + doe - 719468;
}

export function parseIsoDate(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

// Civil calendar +N months, day clamped to the target month's length.
export function addCivilMonths(parts, months) {
  const totalMonths = (parts.y * 12 + (parts.m - 1)) + months;
  const y = Math.floor(totalMonths / 12);
  const m = (totalMonths % 12) + 1;
  const daysInMonth = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  const d = Math.min(parts.d, daysInMonth);
  return { y, m, d };
}

export function fmtIsoDate(parts) {
  if (!parts) return null;
  const p2 = (n) => String(n).padStart(2, '0');
  return `${String(parts.y).padStart(4, '0')}-${p2(parts.m)}-${p2(parts.d)}`;
}

export function compute(pp) {
  const asOfParts = parseIsoDate(pp && pp.as_of);
  const anniversaryParts = parseIsoDate(pp && pp.cert_anniversary);
  const controls = Array.isArray(pp && pp.controls) ? pp.controls : [];

  const as_of = asOfParts ? fmtIsoDate(asOfParts) : null;
  const asOfDays = asOfParts ? daysFromCivil(asOfParts.y, asOfParts.m, asOfParts.d) : null;

  const stale_controls = [];
  for (const c of controls) {
    const control_id = typeof c?.control_id === 'string' ? c.control_id : null;
    const receiptParts = parseIsoDate(c && c.newest_receipt_at);
    if (asOfDays === null || !receiptParts || !control_id) continue;
    const receiptDays = daysFromCivil(receiptParts.y, receiptParts.m, receiptParts.d);
    const age_days = asOfDays - receiptDays;
    if (age_days > STALE_AFTER_DAYS) stale_controls.push({ control_id, age_days });
  }

  let cert_expiry = null, cert_expired = false, cert_expiring_within_days = false;
  if (anniversaryParts) {
    const expiryParts = addCivilMonths(anniversaryParts, 12);
    cert_expiry = fmtIsoDate(expiryParts);
    if (asOfDays !== null) {
      const expiryDays = daysFromCivil(expiryParts.y, expiryParts.m, expiryParts.d);
      cert_expired = asOfDays > expiryDays;
      cert_expiring_within_days = !cert_expired && (expiryDays - asOfDays) <= CERT_EXPIRY_WARNING_DAYS;
    }
  }

  const insufficient_evidence = controls.length === 0 && asOfParts === null;
  const compliance_flags = ['INSURANCE_EVIDENCE_FRESHNESS_LINT_RUN', cert_expired ? 'CERT_EXPIRED' : (stale_controls.length > 0 ? 'CONTROLS_STALE' : 'FRESHNESS_OK')];

  return {
    output_payload: {
      as_of, stale_controls, stale_count: stale_controls.length,
      cert_expiry, cert_expired, cert_expiring_within_days, insufficient_evidence,
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
