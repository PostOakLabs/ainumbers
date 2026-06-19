import { executionHash } from './_hash.mjs';

const TOOL_ID = '512-tokenized-security-lifecycle-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_tokenized_security_lifecycle',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const REQUIRED_EVENTS = {
  ust:             ['issuance','coupon_payment','maturity_redemption'],
  govt_bond:       ['issuance','coupon_payment','maturity_redemption'],
  corporate_bond:  ['issuance','coupon_payment','maturity_redemption','default_handling'],
  equity:          ['issuance','corporate_action','transfer'],
  fund_unit:       ['issuance','transfer','maturity_redemption'],
  structured_note: ['issuance','coupon_payment','maturity_redemption','default_handling'],
};

const CRITICAL_EVENTS = {
  ust:             ['issuance','maturity_redemption'],
  govt_bond:       ['issuance','maturity_redemption'],
  corporate_bond:  ['issuance','maturity_redemption'],
  equity:          ['issuance','transfer'],
  fund_unit:       ['issuance','maturity_redemption'],
  structured_note: ['issuance','maturity_redemption'],
};

export function compute(pp) {
  const {
    security_type,
    jurisdiction,
    issuance_amount,
    isin_assigned,
    daml_lifecycle_defined,
    custodian_type,
    covered_events = [],
    prospectus_filed,
  } = pp;

  const required = REQUIRED_EVENTS[security_type] ?? [];
  const critical = CRITICAL_EVENTS[security_type] ?? [];

  // Event matrix — union of all known events
  const allKnown = new Set([...required, ...covered_events]);
  const event_matrix = {};
  for (const ev of allKnown) {
    const isRequired = required.includes(ev);
    const isCovered = covered_events.includes(ev);
    if (isRequired && isCovered) {
      event_matrix[ev] = 'ok';
    } else if (isRequired && !isCovered) {
      event_matrix[ev] = 'gap';
    } else {
      event_matrix[ev] = 'na';
    }
  }

  // Verdict
  let verdict, badge;
  let criticalGaps = [];
  let allGaps = [];

  if (!daml_lifecycle_defined) {
    verdict = 'critical';
    badge = 'LIFECYCLE_CRITICAL_GAP';
    criticalGaps = critical.filter(e => !covered_events.includes(e));
    allGaps = required.filter(e => !covered_events.includes(e));
  } else {
    criticalGaps = critical.filter(e => !covered_events.includes(e));
    if (criticalGaps.length > 0) {
      verdict = 'critical';
      badge = 'LIFECYCLE_CRITICAL_GAP';
    } else {
      allGaps = required.filter(e => !covered_events.includes(e));
      if (allGaps.length > 0) {
        verdict = 'gaps';
        badge = 'LIFECYCLE_GAPS_PRESENT';
      } else {
        verdict = 'compliant';
        badge = 'LIFECYCLE_COMPLIANT';
      }
    }
    if (verdict !== 'critical') {
      allGaps = required.filter(e => !covered_events.includes(e));
    }
  }

  const compliance_flags = {
    LIFECYCLE_COMPLIANT: badge === 'LIFECYCLE_COMPLIANT',
    LIFECYCLE_GAPS_PRESENT: badge === 'LIFECYCLE_GAPS_PRESENT',
    LIFECYCLE_CRITICAL_GAP: badge === 'LIFECYCLE_CRITICAL_GAP',
  };

  // Gap flags
  for (const ev of allGaps) {
    compliance_flags['DAML_LIFECYCLE_GAP_' + ev.toUpperCase()] = true;
  }

  // EU prospectus check
  if ((jurisdiction === 'eu' || jurisdiction === 'uk') && issuance_amount > 8_000_000 && !prospectus_filed) {
    compliance_flags.PROSPECTUS_REQUIRED_NOT_FILED = true;
  }

  // Custody
  if (custodian_type === 'self_custody') {
    compliance_flags.SELF_CUSTODY_RISK = true;
  }

  // DLT Pilot
  if (jurisdiction === 'eu' && isin_assigned) {
    compliance_flags.DLT_PILOT_ISIN_NOTE = true;
  }

  const output_payload = {
    verdict,
    verdict_badge: badge,
    all_gaps: allGaps,
    critical_gaps: criticalGaps,
    event_matrix,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version: '1.0.0',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
