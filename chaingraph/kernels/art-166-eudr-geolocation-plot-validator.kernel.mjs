import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-166-eudr-geolocation-plot-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_eudr_geolocation',
  mandate_type: 'compliance_mandate', gpu: false,
};

// EUDR Art. 9(1)(d) requires geo-location of all plots where the commodity was produced.
// For areas <4 ha: a single Point (longitude, latitude) is sufficient.
// For areas ≥4 ha: a Polygon with closed ring is required.
// Micro-operators (<10 employees, <€2M turnover) may substitute a postal address.
// This kernel validates GeoJSON geometry type, coordinate validity, size-rule compliance,
// polygon closure, and micro-operator exemption. Feeds commodity classifier (art-167).
// Zero network.
export function compute(pp) {
  const { geo = {} } = pp;

  const area_ha_raw = Number(geo.area_ha);
  const area_ha = Number.isFinite(area_ha_raw) ? area_ha_raw : 0;

  const micro_exemption = geo.micro_operator_postal_address_provided === true;
  if (micro_exemption) {
    return {
      output_payload: {
        valid: true,
        geo_type: null,
        area_ha,
        size_rule_met: true,
        coordinates_valid: true,
        polygon_closed: null,
        micro_operator_exemption: true,
        issues: [],
      },
      compliance_flags: { EUDR_GEO_ASSESSED: true, EUDR_GEO_MICRO_EXEMPTION: true },
    };
  }

  const type = typeof geo.type === 'string' ? geo.type : null;
  const coords = Array.isArray(geo.coordinates) ? geo.coordinates : [];
  const issues = [];

  // Validate geometry type
  const valid_types = ['Point', 'Polygon', 'MultiPolygon'];
  const type_valid = valid_types.includes(type);
  if (!type_valid) issues.push('invalid_geometry_type');

  // Size rule: <4 ha → Point OK; ≥4 ha → Polygon or MultiPolygon required
  const large_plot = Number.isFinite(area_ha_raw) && area_ha >= 4;
  const size_rule_met = !large_plot || type === 'Polygon' || type === 'MultiPolygon';
  if (!size_rule_met) issues.push('large_plot_requires_polygon');

  // Coordinate validity: longitude [-180,180], latitude [-90,90]
  let coordinates_valid = true;
  if (type === 'Point') {
    if (coords.length >= 2) {
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) { coordinates_valid = false; issues.push('invalid_longitude'); }
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) { coordinates_valid = false; issues.push('invalid_latitude'); }
    } else { coordinates_valid = false; issues.push('point_missing_coordinates'); }
  } else if (type === 'Polygon') {
    // coords[0] = exterior ring array of [lon,lat] pairs
    const ring = Array.isArray(coords[0]) ? coords[0] : [];
    if (ring.length < 4) { coordinates_valid = false; issues.push('polygon_insufficient_points'); }
    else {
      for (const pt of ring) {
        const lon = Number(Array.isArray(pt) ? pt[0] : NaN);
        const lat = Number(Array.isArray(pt) ? pt[1] : NaN);
        if (!Number.isFinite(lon) || lon < -180 || lon > 180 || !Number.isFinite(lat) || lat < -90 || lat > 90) {
          coordinates_valid = false; issues.push('invalid_ring_coordinate'); break;
        }
      }
    }
  }

  // Polygon closure check: first == last coordinate
  let polygon_closed = null;
  if (type === 'Polygon' && Array.isArray(coords[0]) && coords[0].length >= 2) {
    const ring = coords[0];
    const first = ring[0]; const last = ring[ring.length - 1];
    polygon_closed = Array.isArray(first) && Array.isArray(last) &&
      Number(first[0]) === Number(last[0]) && Number(first[1]) === Number(last[1]);
    if (!polygon_closed) issues.push('polygon_not_closed');
  }

  const valid = type_valid && size_rule_met && coordinates_valid && (polygon_closed !== false);

  const compliance_flags = { EUDR_GEO_ASSESSED: true };
  if (valid) compliance_flags.EUDR_GEO_VALID = true;
  else compliance_flags.EUDR_GEO_INVALID = true;

  return {
    output_payload: { valid, geo_type: type, area_ha, size_rule_met, coordinates_valid, polygon_closed, micro_operator_exemption: false, issues },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
