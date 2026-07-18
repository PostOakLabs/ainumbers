import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-387-pqc-deadline-ladder-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_pqc_deadline_ladder',
  mandate_type: 'compliance_mandate', gpu: false,
};

// CNSA-2.0 deadline ladder calculator. Every regulatory date is DECLARED in
// policy_parameters.policy_deadlines (with a source citation) and read from
// there -- never compared against a literal inside this function. The
// DEFAULT_POLICY_DEADLINES object below exists only to pre-fill a caller
// that omits policy_deadlines; a caller who supplies its own dates changes
// behavior with zero code change (a re-pin is a data bump, per PQ-2 spec).
//
// Per-row logic: firmware/software signing carries an exclusive-use deadline
// identical to the new-NSS-deployment deadline (both effective 2027-01-01
// per the same NSA advisory); a new NSS deployment (deployment_date on/after
// reference_date) is held to that same near-term deadline; everything else
// rides the key-establishment/signature ladder (2030-12-31 / 2031-12-31).
// FIPS 140-2 exposure is a separate flag: a certified module is exposed once
// reference_date reaches the FIPS 140-2 Historical-list transition date.
// Fixed-point day-count math (UTC midnight, no DST ambiguity). Finite gate:
// malformed dates never propagate NaN -- they resolve to 0 with a flag.
// Findings `asserted`: not legal advice, not a compliance determination.

const DEFAULT_POLICY_DEADLINES = {
  new_deployment_signing_deadline: {
    date: '2027-01-01',
    source: 'NSA CNSSP-15 / CNSA 2.0 Advisory: new NSS deployments and exclusive-use software/firmware signing must adopt CNSA 2.0 by 2027-01-01.',
  },
  key_establishment_deadline: {
    date: '2030-12-31',
    source: 'NSA CNSA 2.0 migration timeline: NSS key-establishment transition to be complete by 2030-12-31.',
  },
  signature_deadline: {
    date: '2031-12-31',
    source: 'NSA CNSA 2.0 migration timeline: NSS signature transition to be complete by 2031-12-31.',
  },
  cnsa_exclusive_deadline: {
    date: '2033-12-31',
    source: 'NSA CNSA 2.0 migration timeline: NSS systems CNSA-2.0-exclusive by 2033.',
  },
  fips_140_2_historical_date: {
    date: '2026-09-21',
    source: 'NIST: FIPS 140-2 validated-module certificates move to the Historical list on 2026-09-21.',
  },
};

const IMMINENT_WINDOW_DAYS = 180;

function toUtcMidnight(iso) {
  if (typeof iso !== 'string') return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return NaN;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : NaN;
}

function daysBetween(fromISO, toISO) {
  const a = toUtcMidnight(fromISO);
  const b = toUtcMidnight(toISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

function deadlineDate(deadlines, key) {
  const d = deadlines && deadlines[key] && deadlines[key].date;
  return typeof d === 'string' ? d : DEFAULT_POLICY_DEADLINES[key].date;
}

export function compute(pp) {
  pp = pp || {};
  const reference_date = typeof pp.reference_date === 'string' ? pp.reference_date : '';
  const policy_deadlines = Object.assign({}, DEFAULT_POLICY_DEADLINES, pp.policy_deadlines || {});
  const inventory = Array.isArray(pp.inventory) ? pp.inventory : [];
  const compliance_flags = [];

  const rows = inventory.map((raw, idx) => {
    const row = raw || {};
    const row_id = typeof row.row_id === 'string' && row.row_id ? row.row_id : `ROW-${idx + 1}`;
    const system_class = String(row.system_class || '').trim();
    const asset_type = String(row.asset_type || '').trim();
    const deployment_date = typeof row.deployment_date === 'string' ? row.deployment_date : '';
    const fips_140_2_certified = row.fips_140_2_certified === true;

    const refValid = toUtcMidnight(reference_date);
    const depValid = deployment_date ? toUtcMidnight(deployment_date) : null;
    const invalid_date = !Number.isFinite(refValid) || (deployment_date !== '' && !Number.isFinite(depValid));

    const is_new_deployment = depValid !== null && Number.isFinite(depValid) && Number.isFinite(refValid) && depValid >= refValid;

    let applicable_deadline_key;
    if (invalid_date) {
      applicable_deadline_key = null;
    } else if (asset_type === 'firmware') {
      applicable_deadline_key = 'new_deployment_signing_deadline';
    } else if (system_class === 'nss' && is_new_deployment) {
      applicable_deadline_key = 'new_deployment_signing_deadline';
    } else if (asset_type === 'key-establishment') {
      applicable_deadline_key = 'key_establishment_deadline';
    } else {
      applicable_deadline_key = 'signature_deadline';
    }

    const applicable_deadline = applicable_deadline_key ? deadlineDate(policy_deadlines, applicable_deadline_key) : null;
    const days_remaining = (!invalid_date && applicable_deadline) ? daysBetween(reference_date, applicable_deadline) : null;

    const fips_date = deadlineDate(policy_deadlines, 'fips_140_2_historical_date');
    const fips_days = !invalid_date ? daysBetween(reference_date, fips_date) : null;
    const fips_140_2_historical_exposure = fips_140_2_certified && fips_days !== null && fips_days <= 0;

    const row_flags = [];
    if (invalid_date) row_flags.push('INVALID_DATE');
    if (days_remaining !== null && days_remaining < 0) row_flags.push('DEADLINE_PAST_DUE');
    else if (days_remaining !== null && days_remaining <= IMMINENT_WINDOW_DAYS) row_flags.push('DEADLINE_IMMINENT');
    if (fips_140_2_historical_exposure) row_flags.push('FIPS_140_2_HISTORICAL_EXPOSURE');
    row_flags.forEach((f) => { if (!compliance_flags.includes(f)) compliance_flags.push(f); });

    return {
      row_id,
      system_class,
      asset_type,
      deployment_date: deployment_date || null,
      applicable_deadline,
      earliest_binding_constraint: applicable_deadline_key,
      days_remaining,
      fips_140_2_certified,
      fips_140_2_historical_exposure,
      flags: row_flags,
    };
  });

  const summary = {
    row_count: rows.length,
    past_due_count: rows.filter((r) => r.flags.includes('DEADLINE_PAST_DUE')).length,
    imminent_count: rows.filter((r) => r.flags.includes('DEADLINE_IMMINENT')).length,
    fips_exposure_count: rows.filter((r) => r.fips_140_2_historical_exposure).length,
    invalid_row_count: rows.filter((r) => r.flags.includes('INVALID_DATE')).length,
  };

  const output_payload = {
    reference_date,
    rows,
    summary,
    policy_deadlines_used: policy_deadlines,
    note: 'DECISION-SUPPORT DRAFT, findings asserted. Not legal advice, not a compliance determination, not an audit. Computes what the declared deadlines imply for the supplied inventory only.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
