/**
 * art-111-arc-corridor-jurisdiction-router.kernel.mjs
 * Arc Multi-Currency Corridor Jurisdiction Router.
 * Routes each corridor leg to its home regulatory regime and validates cross-currency
 * settlement and Travel-Rule compliance. NO FX economics (art-44 owns pricing).
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-111-arc-corridor-jurisdiction-router';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'route_partner_stablecoin_jurisdiction',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// Home-regime routing table (Circle Partner Stablecoins + Arc corridors, 2026)
const REGIME_TABLE = {
  EURC:  { regime: 'MiCA-EMT',     regulator: 'EBA/NCAs',       disclosure: ['EMT_whitepaper', 'reserve_attestation_monthly', 'MiCA_Art21'] },
  JPYC:  { regime: 'JP-PSA-FSA',   regulator: 'Japan FSA',       disclosure: ['PSA_registration', 'fund_segregation', 'JP_crypto_reporting'] },
  BRLA:  { regime: 'BR-CMN-BCB',   regulator: 'Banco Central BR', disclosure: ['BCB_registration', 'reserve_report_monthly', 'AML_COAF'] },
  MXNB:  { regime: 'MX-CNBV-FINTEC', regulator: 'CNBV',          disclosure: ['Fintech_Law_ITF', 'CNBV_registration', 'SAT_reporting'] },
  AUDF:  { regime: 'AU-ASIC',      regulator: 'ASIC',            disclosure: ['ASIC_digital_asset', 'ePayments_Code'] },
  PHPC:  { regime: 'PH-BSP',       regulator: 'Bangko Sentral ng Pilipinas', disclosure: ['BSP_VirtualAsset', 'AMLC_registration'] },
  QCAD:  { regime: 'CA-FINTRAC',   regulator: 'FINTRAC',         disclosure: ['MSB_registration', 'PCMLTFA_compliance'] },
  ZARU:  { regime: 'ZA-SARB-FSCA', regulator: 'SARB/FSCA',       disclosure: ['SARB_registration', 'FSCA_CASP', 'FICA_AML'] },
  USDC:  { regime: 'US-NY-DFS',    regulator: 'NY DFS / OCC',    disclosure: ['GENIUS_Act', 'monthly_attestation', 'FedWire_eligibility'] },
  USDT:  { regime: 'US-USVI-registered', regulator: 'USVI',      disclosure: ['monthly_attestation'] },
};

const REQUIRED_DISCLOSURE_FIELDS = ['reserve_attestation', 'AML_program'];

export function compute(pp) {
  const legs = Array.isArray(pp.corridor_legs) ? pp.corridor_legs : [];

  const leg_regimes = [];
  const disclosure_gaps = [];

  for (const leg of legs) {
    const ccy    = (leg.partner_stablecoin ?? leg.ccy ?? '').toUpperCase();
    const entry  = REGIME_TABLE[ccy];
    const notional = Number(leg.notional) || 0;

    if (!entry) {
      leg_regimes.push({ ccy_pair: leg.ccy_pair ?? ccy, ccy, regime: 'UNKNOWN', regulator: 'unknown', disclosures_required: [], note: `No home regime registered for ${ccy}` });
      disclosure_gaps.push({ ccy, gap: 'NO_REGIME_MAPPED', severity: 'HIGH' });
    } else {
      leg_regimes.push({ ccy_pair: leg.ccy_pair ?? ccy, ccy, regime: entry.regime, regulator: entry.regulator, disclosures_required: entry.disclosure, notional });
      // Check if provided disclosures cover the required set
      const provided = Array.isArray(leg.disclosures_provided) ? leg.disclosures_provided : [];
      for (const req of REQUIRED_DISCLOSURE_FIELDS) {
        if (!provided.some(p => p.toLowerCase().includes(req.toLowerCase()))) {
          disclosure_gaps.push({ ccy, gap: `MISSING_${req.toUpperCase()}`, severity: 'MEDIUM' });
        }
      }
    }
  }

  const pvp_handoff = {
    tool: '511-multi-currency-pvp-validator',
    leg_count: legs.length,
    regimes: leg_regimes.map(l => l.regime),
  };

  const travel_rule_handoff = {
    tool: 'art-104-tfr-travel-rule-batch-validator',
    leg_count: legs.length,
    currencies: leg_regimes.map(l => l.ccy),
  };

  const all_mapped  = !leg_regimes.some(l => l.regime === 'UNKNOWN');
  const high_gaps   = disclosure_gaps.filter(g => g.severity === 'HIGH');
  const verdict     = all_mapped && high_gaps.length === 0 ? 'ROUTING_COMPLETE' : 'ROUTING_GAPS';

  const compliance_flags = [all_mapped ? 'ALL_REGIMES_MAPPED' : 'UNMAPPED_REGIMES'];
  if (disclosure_gaps.length === 0) compliance_flags.push('DISCLOSURES_COMPLETE');
  else compliance_flags.push('DISCLOSURE_GAPS_FOUND');

  const output_payload = {
    leg_regimes,
    disclosure_gaps,
    pvp_handoff,
    travel_rule_handoff,
    verdict,
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
