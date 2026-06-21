/**
 * art-85-pqc-timeline-fit-diagnostic.kernel.mjs
 * Wave 18 — PQC Timeline Fit Diagnostic.
 * Scores an organisation's post-quantum cryptography readiness across four
 * dimensions (inventory, HNDL awareness, vendor alignment, agility maturity)
 * and maps the result to key public-sector and financial-sector milestones.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   EU Coordinated PQC Roadmap — EU national cryptographic inventories deadline end-2026.
 *   EU Finance PQC Roadmap — EU finance sector PQC-secured systems target 2030.
 *   NSM-10 / CNSA 2.0 — NSS procurement deadline 2027, full transition 2035.
 *   G7 Financial Sector PQC Roadmap — Jan 2026 publication.
 *   PCI DSS 4.0 Req 12.3.3 — cryptographic inventory deadline 31 Mar 2025.
 *   EDUCATIONAL: outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-85-pqc-timeline-fit-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'run_pqc_timeline_fit',
  mandate_type: 'agent_guardrail_mandate',
  gpu:          false,
};

// EU coordinated PQC roadmap — national cryptographic inventories deadline (verify current)
const EU_INVENTORY_DEADLINE = 'end-2026';
// EU finance sector PQC-secured systems target (verify current)
const EU_FINANCE_DEADLINE   = 2030;
// CNSA 2.0 / NSM-10 — NSS procurement deadline (verify current)
const CNSA_NSS_DEADLINE     = 2027;
// CNSA 2.0 full transition deadline (verify current)
const CNSA_FULL_DEADLINE    = 2035;
// G7 financial-sector PQC roadmap publication date (verify current)
const G7_ROADMAP_DATE       = '2026-01';
// PCI DSS 4.0 Req 12.3.3 cryptographic inventory deadline (verify current)
const PCI_DSS_INVENTORY_DATE = '2025-03-31';

function gradeScore(total) {
  if (total >= 85) return 'A';
  if (total >= 70) return 'B';
  if (total >= 55) return 'C';
  if (total >= 40) return 'D';
  return 'F';
}

function gradeToMilestoneFit(grade) {
  if (grade === 'A') return 'on_track';
  if (grade === 'B') return 'on_track';
  if (grade === 'C') return 'at_risk';
  if (grade === 'D') return 'at_risk';
  return 'behind_schedule';
}

export function compute(pp) {
  const {
    sector                 = 'bank',
    crypto_inventory_status = 'none',
    hndl_data_shelf_life   = 'short',
    vendor_pqc_roadmap     = 'none',
    protocol_estate        = [],
    agility_maturity       = 'low',
    cnsa_applicability     = false,
    regulatory_drivers     = [],
    sector_preset          = 'custom',
    // derived fields — caller may pass or they are computed here
    hndl_long_shelf_flag   = (hndl_data_shelf_life === 'long'),
    inventory_complete     = (crypto_inventory_status === 'complete'),
    notes                  = '',
  } = pp;

  // --- Dimension scoring (each 0–25) ---
  // Inventory readiness (0–25)
  const inv_score =
    crypto_inventory_status === 'complete' ? 25 :
    crypto_inventory_status === 'partial'  ? 12 : 0;

  // HNDL awareness (0–25): penalise long shelf-life data without inventory
  let hndl_score = 25;
  if (hndl_data_shelf_life === 'long')   hndl_score -= 15;
  if (hndl_data_shelf_life === 'medium') hndl_score -= 7;
  if (!inventory_complete)               hndl_score -= 5;
  if (hndl_score < 0) hndl_score = 0;

  // Vendor alignment (0–25)
  const vendor_score =
    vendor_pqc_roadmap === 'committed' ? 25 :
    vendor_pqc_roadmap === 'partial'   ? 12 : 0;

  // Agility maturity (0–25)
  const agility_score =
    agility_maturity === 'high'   ? 25 :
    agility_maturity === 'medium' ? 13 : 0;

  const total_score    = inv_score + hndl_score + vendor_score + agility_score;
  const readiness_grade = gradeScore(total_score);
  const milestone_fit   = gradeToMilestoneFit(readiness_grade);

  // --- Flags ---
  const compliance_flags = [];
  if (crypto_inventory_status === 'none')
    compliance_flags.push('NO_CRYPTO_INVENTORY');
  if (hndl_data_shelf_life === 'long')
    compliance_flags.push('HNDL_LONG_SHELF_LIFE');
  if (cnsa_applicability && vendor_pqc_roadmap === 'none')
    compliance_flags.push('CNSA_2027_AT_RISK');

  // --- Inventory deadline flag ---
  const inventory_deadline_flag =
    crypto_inventory_status !== 'complete' &&
    regulatory_drivers.includes('eu_nis2');

  // --- Do-now / prepare-ahead actions ---
  const do_now = [];
  const prepare_ahead = [];

  if (crypto_inventory_status === 'none') {
    do_now.push('Commission cryptographic asset inventory immediately (EU inventory deadline: ' + EU_INVENTORY_DEADLINE + ')');
  } else if (crypto_inventory_status === 'partial') {
    do_now.push('Complete cryptographic inventory before ' + EU_INVENTORY_DEADLINE);
  }

  if (vendor_pqc_roadmap === 'none') {
    do_now.push('Engage critical vendors for PQC roadmap commitments');
  }

  if (hndl_long_shelf_flag) {
    do_now.push('Identify and prioritise long shelf-life HNDL data assets for early migration');
  }

  if (agility_maturity === 'low') {
    prepare_ahead.push('Develop cryptographic agility programme — target medium maturity');
  }

  if (cnsa_applicability) {
    prepare_ahead.push('Align NSS systems to CNSA 2.0 procurement requirements by ' + CNSA_NSS_DEADLINE);
  }

  if (regulatory_drivers.includes('pci_dss')) {
    do_now.push('Verify PCI DSS 4.0 Req 12.3.3 inventory evidence (deadline was ' + PCI_DSS_INVENTORY_DATE + ')');
  }

  // --- Protocol routes ---
  const protocol_routes = (protocol_estate || []).map(p => ({
    protocol: p,
    pqc_action:
      p === 'tls'            ? 'Hybrid TLS 1.3 with ML-KEM-768 key exchange (IETF draft)' :
      p === 'pki'            ? 'Dual-stack or composite X.509 certificates (ML-DSA-65)' :
      p === 'swift_iso20022' ? 'Monitor BIS Project Leap Phase 2 outputs for BAH signature guidance' :
      p === 'fido'           ? 'Target CTAP2.3 authenticators with ML-DSA COSE IDs' :
      p === 'blockchain'     ? 'Assess exposed public-key share; monitor BIP-360 / chain-specific PQC proposals' :
      'Review algorithm dependencies',
  }));

  const primary_recommendation =
    readiness_grade === 'A' ? 'Maintain momentum — schedule annual PQC readiness review' :
    readiness_grade === 'B' ? 'Address remaining vendor gaps and lock agility programme scope' :
    readiness_grade === 'C' ? 'Prioritise inventory completion and vendor engagement before end-2026' :
    readiness_grade === 'D' ? 'Launch emergency cryptographic inventory; brief board on HNDL risk' :
    'Immediate escalation required — PQC programme has not started';

  const output_payload = {
    readiness_grade,
    total_score,
    dim_scores: {
      inventory: inv_score,
      hndl:      hndl_score,
      vendor:    vendor_score,
      agility:   agility_score,
    },
    milestone_fit,
    inventory_deadline_flag,
    do_now,
    prepare_ahead,
    primary_recommendation,
    protocol_routes,
    milestones: {
      eu_inventory_deadline:  EU_INVENTORY_DEADLINE,
      eu_finance_deadline:    EU_FINANCE_DEADLINE,
      cnsa_nss_deadline:      CNSA_NSS_DEADLINE,
      cnsa_full_deadline:     CNSA_FULL_DEADLINE,
      g7_roadmap_date:        G7_ROADMAP_DATE,
      pci_dss_inventory_date: PCI_DSS_INVENTORY_DATE,
    },
    reference_version: '2026-06',
    note: 'DECISION-SUPPORT DRAFT. Milestone dates sourced from EU PQC Roadmap, NSM-10/CNSA 2.0, G7 Jan 2026 roadmap, PCI DSS 4.0. Verify all deadlines against current official publications before citing.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
