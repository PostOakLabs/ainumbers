/**
 * art-70-cbam-default-value-resolver.kernel.mjs
 * Wave 16 — CBAM Default-Value Resolver.
 * Resolves the Commission default embedded-emissions value for a
 * (CN-code × country-of-origin) pair, applies the year-dependent markup
 * vs the actual-data path, and returns the value with its provenance.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Citations (verify before citing on any page):
 *   CBAM Implementing Regulation (Commission) — default embedded-emissions
 *     values per sector × origin. Verify current edition + date.
 *   CBAM Reg. (EU) 2023/956 Art 17 — default value obligations.
 *   Default markup: Art 14 CBAM Implementing Reg. — +10% 2026, +20% 2027,
 *     +30% 2028 and subsequent years.
 *   EDUCATIONAL: outputs are decision-support drafts, not official declarations.
 *
 * reference_version: "CBAM-IR-v1.0-2024-Q4" — update when Commission revises.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-70-cbam-default-value-resolver';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'resolve_cbam_default_value',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// ─── Default-value table (tCO₂e per tonne) ───────────────────────────────────
// Source: CBAM Implementing Regulation, Annex with default embedded-emission values.
// reference_version: "CBAM-IR-v1.0-2024-Q4" — verify current edition.
// Countries not listed use the world-average default for the sector.
// Values are illustrative approximations; always verify against the current
// Commission Implementing Regulation before use in any official filing.
const DEFAULT_VALUES = {
  cement: {
    _world:  0.766, CN: 0.856, IN: 0.820, TR: 0.799, UA: 0.812, EG: 0.789,
    MA: 0.801, BY: 0.834, RU: 0.845, VN: 0.778, TH: 0.770,
  },
  iron_steel: {
    _world:  1.894, CN: 2.240, IN: 2.106, UA: 2.050, TR: 1.980, RU: 1.960,
    BY: 2.010, EG: 1.920, BR: 1.870, KR: 1.840, JP: 1.820,
  },
  aluminium: {
    _world:  1.503, CN: 1.820, IN: 1.640, NO: 0.540, RU: 1.620, CA: 0.620,
    AU: 1.680, GH: 0.800, IS: 0.420, GY: 0.920, ME: 1.580,
  },
  fertiliser: {
    _world:  2.340, RU: 2.120, UA: 2.290, BY: 2.310, EG: 2.280, MA: 2.350,
    CN: 2.620, QA: 1.980, TN: 2.400, TR: 2.260, SA: 2.050,
  },
  hydrogen: {
    _world:  10.90, CN: 11.80, RU: 11.20, UA: 11.50, IN: 11.60, TR: 11.30,
    NO: 4.20,
  },
  electricity: {
    _world:  0.000,
  },
};

// Default markup by reporting year (CBAM Implementing Reg. Art 14)
// +10% 2026, +20% 2027, +30% 2028 and subsequent years
const MARKUP_BY_YEAR = { 2026: 0.10, 2027: 0.20 };
const getMarkup = (year) => year >= 2028 ? 0.30 : (MARKUP_BY_YEAR[year] ?? 0.10);

const REFERENCE_VERSION = 'CBAM-IR-v1.0-2024-Q4';

export function compute(pp) {
  const {
    cn_code              = '',
    good_category        = 'iron_steel',
    country_of_origin    = 'CN',
    reporting_year       = 2026,
    actual_data_available = false,
  } = pp;

  const table  = DEFAULT_VALUES[good_category] ?? DEFAULT_VALUES.iron_steel;
  const base   = table[country_of_origin] ?? table._world;
  const markup = getMarkup(+reporting_year);
  const effective_default = +(base * (1 + markup)).toFixed(4);

  const actual_path_recommended = actual_data_available === true || actual_data_available === 'true';

  const output_payload = {
    default_value_tco2e_per_t: +base.toFixed(4),
    markup_pct:                +(markup * 100).toFixed(1),
    effective_default,
    actual_path_recommended,
    good_category,
    cn_code,
    country_of_origin,
    reporting_year: +reporting_year,
    provenance: `Default embedded-emission value for ${good_category} (${country_of_origin || 'world-average'}). Source: CBAM Implementing Regulation, reference_version ${REFERENCE_VERSION}. Markup +${(markup * 100).toFixed(0)}% applied for ${reporting_year} reporting year per Art 14.`,
    reference_version: REFERENCE_VERSION,
    note: 'DECISION-SUPPORT DRAFT — values are approximate. Verify against the current Commission CBAM Implementing Regulation edition (https://taxation-customs.ec.europa.eu/) before use in any official declaration. Default markup rates: +10% 2026, +20% 2027, +30% 2028+.',
  };

  const compliance_flags = [];
  if (!actual_data_available) compliance_flags.push('DEFAULT_MARKUP_PENALTY');
  if (actual_data_available)  compliance_flags.push('ACTUAL_DATA_RECOMMENDED');
  if (!(country_of_origin in table)) compliance_flags.push('WORLD_AVERAGE_USED');

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
