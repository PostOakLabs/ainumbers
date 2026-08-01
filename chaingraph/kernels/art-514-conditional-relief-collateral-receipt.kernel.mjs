import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-514-conditional-relief-collateral-receipt';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_conditional_relief_collateral_receipt',
  mandate_type: 'compliance_control', gpu: false,
};

// Conditional-relief collateral receipt: a firm relying on conditional
// regulatory relief -- no-action, exemptive, or comfort-letter -- to accept
// an asset as collateral can show, per acceptance and per day, that every
// condition of that relief held, and what it costs if the relief is
// withdrawn. Portable to any regime: CFTC, SEC, OCC, FCA, MAS. The regime
// label and every condition are CALLER-SUPPLIED, versioned policy input --
// same pattern art-444-collateral-haircut-engine uses for supervisory
// haircut tables -- never a hardcoded rule set. This kernel names no
// regulator; a second regime runs on the identical shape with only the
// declared inputs changing.
//
// Per-condition verdict is PASS / FAIL / UNDECIDABLE, never a silent PASS
// on absent evidence: a condition with no declared evidence_status is
// UNDECIDABLE by construction.
//
// CRC_RELIEF_VERSION_STALE is the point of the node. The caller declares
// which relief version they relied on (relied_on_version) and separately
// supplies a versioned condition set (condition_set.version) -- both
// caller-supplied, no clock, no network, no fetch. A mismatch means the
// evidence was gathered against a version other than the one currently
// relied upon.
//
// This node does NOT rebuild reserve checking (art-06, art-512, art-280) or
// haircuts/eligibility (art-444, 505, 508, art-320) -- those are reused
// upstream in a chain. It reports whether the CALLER's declared conditions
// were met against the CALLER's declared evidence; it renders no eligibility
// opinion and no investment advice.

const ASSET_CLASSES = ['payment_stablecoin', 'btc', 'eth', 'tokenized_treasury', 'tokenized_mmf', 'other'];
const CONDITION_VERDICTS = ['met', 'not_met', 'undecided'];
const MAX_SAFE = 9007199254740991;

function gz(v) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : 0; }
function gnum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : null; }
function jnum(v) { return Number.isFinite(v) && Math.abs(v) > MAX_SAFE ? String(v) : (Number.isFinite(v) ? v : 0); }
function str(v) { return String(v == null ? '' : v).trim(); }

function verdictOf(rawStatus) {
  const s = str(rawStatus).toLowerCase();
  if (s === 'met') return 'PASS';
  if (s === 'not_met') return 'FAIL';
  return 'UNDECIDABLE';
}

export function compute(pp) {
  pp = pp || {};
  const exceptions = [];
  const compliance_flags = [];

  const relief_regime = str(pp.relief_regime) || null;
  if (!relief_regime) exceptions.push('RELIEF_REGIME_MISSING');

  const relied_on_version = str(pp.relied_on_version) || null;
  if (!relied_on_version) exceptions.push('RELIED_ON_VERSION_MISSING');

  const rawConditionSet = pp.condition_set && typeof pp.condition_set === 'object' ? pp.condition_set : {};
  const condition_set_version = str(rawConditionSet.version) || null;
  if (!condition_set_version) exceptions.push('CONDITION_SET_VERSION_MISSING');

  const rawConditions = Array.isArray(rawConditionSet.conditions) ? rawConditionSet.conditions : [];
  const conditions = rawConditions.map((c) => {
    c = c || {};
    const condition_id = str(c.condition_id) || null;
    const description = str(c.description) || null;
    const rawStatus = str(c.evidence_status).toLowerCase();
    const evidence_status_valid = CONDITION_VERDICTS.indexOf(rawStatus) >= 0;
    const verdict = verdictOf(rawStatus);
    return { condition_id, description, evidence_status: evidence_status_valid ? rawStatus : (rawStatus || null), verdict };
  });
  if (conditions.length === 0) exceptions.push('CONDITION_SET_EMPTY');
  conditions.forEach((c) => {
    if (!c.condition_id) exceptions.push('CONDITION_ID_MISSING');
    if (c.verdict === 'FAIL') exceptions.push('CONDITION_BREACH:' + (c.condition_id || 'unnamed'));
    if (c.verdict === 'UNDECIDABLE') exceptions.push('CONDITION_EVIDENCE_ABSENT:' + (c.condition_id || 'unnamed'));
  });

  const all_conditions_met = conditions.length > 0 && conditions.every((c) => c.verdict === 'PASS');
  const any_breach = conditions.some((c) => c.verdict === 'FAIL');
  const any_undecidable = conditions.some((c) => c.verdict === 'UNDECIDABLE');

  const rawAssetClass = str(pp.asset_class);
  const asset_class_valid = ASSET_CLASSES.indexOf(rawAssetClass) >= 0;
  const asset_class = asset_class_valid ? rawAssetClass : (rawAssetClass || 'unstated');
  if (!asset_class_valid) exceptions.push('UNKNOWN_ASSET_CLASS');

  const issuer_permitted_status = pp.issuer_permitted_status === true;
  const issuer_permitted_status_declared = pp.issuer_permitted_status === true || pp.issuer_permitted_status === false;
  if (!issuer_permitted_status_declared) exceptions.push('ISSUER_PERMITTED_STATUS_UNDECLARED');

  const declared_valuation = gnum(pp.declared_valuation);
  if (declared_valuation === null || declared_valuation <= 0) exceptions.push('DECLARED_VALUATION_ZERO_OR_ABSENT');

  const declared_haircut_pct = gnum(pp.declared_haircut_pct);
  if (declared_haircut_pct === null) exceptions.push('DECLARED_HAIRCUT_MISSING');

  const declared_reporting_cadence = str(pp.declared_reporting_cadence) || null;
  if (!declared_reporting_cadence) exceptions.push('REPORTING_CADENCE_MISSING');

  const last_report_ref = str(pp.last_report_ref) || null;
  if (!last_report_ref) exceptions.push('LAST_REPORT_REF_MISSING');

  const position_size = gz(pp.position_size);
  if (position_size <= 0) exceptions.push('POSITION_SIZE_ZERO_OR_ABSENT');

  const capital_charge_table = Array.isArray(pp.capital_charge_table)
    ? pp.capital_charge_table.map((r) => ({ asset_class: str((r && r.asset_class) || ''), charge_pct: gnum(r && r.charge_pct) })).filter((r) => r.asset_class)
    : [];
  if (capital_charge_table.length === 0) exceptions.push('CAPITAL_CHARGE_TABLE_EMPTY');

  const matchedCharge = capital_charge_table.find((r) => r.asset_class === asset_class);
  const applicable_charge_pct = matchedCharge && matchedCharge.charge_pct !== null ? matchedCharge.charge_pct : null;
  if (applicable_charge_pct === null) exceptions.push('CAPITAL_CHARGE_TABLE_NO_MATCH');

  const applicable_capital_charge = applicable_charge_pct !== null
    ? r2(position_size * (applicable_charge_pct / 100))
    : null;

  const revocation_charge_pct = gnum(pp.revocation_charge_pct);
  if (revocation_charge_pct === null) exceptions.push('REVOCATION_CHARGE_PCT_MISSING');

  const revocation_eligible_without_relief_declared = pp.revocation_eligible_without_relief === true || pp.revocation_eligible_without_relief === false;
  const revocation_eligible_without_relief = pp.revocation_eligible_without_relief === true;
  if (!revocation_eligible_without_relief_declared) exceptions.push('REVOCATION_ELIGIBILITY_UNDECLARED');

  const revocation_capital_charge = revocation_charge_pct !== null
    ? r2(position_size * (revocation_charge_pct / 100))
    : null;

  const revocation_capital_delta = (applicable_capital_charge !== null && revocation_capital_charge !== null)
    ? r2(revocation_capital_charge - applicable_capital_charge)
    : null;

  const eligibility_lost_on_revocation = revocation_eligible_without_relief_declared && revocation_eligible_without_relief === false;

  const revocation_exposure_material =
    (revocation_capital_delta !== null && revocation_capital_delta > 0) || eligibility_lost_on_revocation;

  const as_of = str(pp.as_of) || null;

  const version_stale = !!(relied_on_version && condition_set_version && relied_on_version !== condition_set_version);
  if (version_stale) exceptions.push('RELIEF_VERSION_STALE');

  if (all_conditions_met) compliance_flags.push('CRC_ALL_CONDITIONS_MET');
  if (any_breach) compliance_flags.push('CRC_CONDITION_BREACH');
  if (any_undecidable) compliance_flags.push('CRC_EVIDENCE_INCOMPLETE');
  if (version_stale) compliance_flags.push('CRC_RELIEF_VERSION_STALE');
  if (revocation_exposure_material) compliance_flags.push('CRC_REVOCATION_EXPOSURE_MATERIAL');

  return {
    output_payload: {
      relief_regime,
      relied_on_version,
      condition_set_version,
      conditions,
      all_conditions_met,
      asset_class,
      asset_class_valid,
      issuer_permitted_status,
      issuer_permitted_status_declared,
      declared_valuation: jnum(declared_valuation),
      declared_haircut_pct: jnum(declared_haircut_pct),
      declared_reporting_cadence,
      last_report_ref,
      position_size: jnum(position_size),
      applicable_charge_pct: applicable_charge_pct === null ? null : jnum(applicable_charge_pct),
      applicable_capital_charge: applicable_capital_charge === null ? null : jnum(applicable_capital_charge),
      revocation_charge_pct: revocation_charge_pct === null ? null : jnum(revocation_charge_pct),
      revocation_capital_charge: revocation_capital_charge === null ? null : jnum(revocation_capital_charge),
      revocation_capital_delta: revocation_capital_delta === null ? null : jnum(revocation_capital_delta),
      revocation_eligible_without_relief_declared,
      revocation_eligible_without_relief,
      eligibility_lost_on_revocation,
      revocation_exposure_material,
      version_stale,
      as_of,
      exceptions,
    },
    compliance_flags,
  };
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
