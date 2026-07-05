import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-259-compute-multilateral-netting';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'analytics_mandate', gpu: false };

// Corporate multilateral cash netting: N-entity gross positions → net positions → settlement legs.
// Computes FX-converted net amounts, wire-count savings, and per-entity netting statement.
// NOT estimate_ficc_margin_netting (FICC clearing MARGIN netting, a different product/buyer).
// This node is CORPORATE CASH netting for TMS/in-house-bank settlement cycles.
// Netting statement is suitable for anchor_batch / Merkle-leaf receipts (cry-04).
// ZERO PII: entity IDs, amounts, and currency codes only.

const TABLE_VERSION = 'MULTILATERAL-NETTING-MATH-V1.0-2025';
const TABLE_SOURCE  = 'SWIFT gpi multilateral netting guide; ISO 20022 pacs.010 Financial Institution Credit Transfer; BIS CPMI net settlement framework 2012';

export function compute(params) {
  const p = params || {};

  const base_currency  = (p.base_currency || 'USD').toUpperCase();
  const entities       = Array.isArray(p.entities) ? p.entities : [];
  const gross_positions = Array.isArray(p.gross_positions) ? p.gross_positions : [];
  const fx_rates        = (p.fx_rates && typeof p.fx_rates === 'object') ? p.fx_rates : {};

  // Build entity index
  const entity_ids = entities.map(function(e) { return (e && e.entity_id) ? e.entity_id : ''; }).filter(Boolean);
  const entity_names = {};
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i] || {};
    if (e.entity_id) entity_names[e.entity_id] = e.name || e.entity_id;
  }

  // Convert amount to base currency
  function toBase(amount, currency) {
    const c = (currency || base_currency).toUpperCase();
    if (c === base_currency) return _round4(amount);
    const rate = _finite(fx_rates[c], 1);
    return _round4(amount / rate);
  }

  // Net position map: entity_id → net amount in base_currency (positive = receivable, negative = payable)
  const net_pos = {};
  for (let i = 0; i < entity_ids.length; i++) { net_pos[entity_ids[i]] = 0; }

  const gross_count = gross_positions.length;

  for (let i = 0; i < gross_positions.length; i++) {
    const gp = gross_positions[i] || {};
    const from = gp.from_entity || '';
    const to   = gp.to_entity   || '';
    const amt  = toBase(_finite(gp.amount, 0), gp.currency || base_currency);
    if (from && to && amt > 0) {
      if (from in net_pos) net_pos[from] = _round4(net_pos[from] - amt);
      if (to   in net_pos) net_pos[to]   = _round4(net_pos[to]   + amt);
    }
  }

  // Build settlement legs: payers → receivers (minimum legs via sequential matching)
  const payers    = entity_ids.filter(function(id) { return net_pos[id] < 0; }).map(function(id) { return {id, owed: -net_pos[id]}; });
  const receivers = entity_ids.filter(function(id) { return net_pos[id] > 0; }).map(function(id) { return {id, owed:  net_pos[id]}; });

  const settlement_legs = [];
  // Use simple greedy settlement (minimum-leg heuristic)
  let pi = 0, ri = 0;
  const pCopy = payers.map(function(x) { return {id: x.id, rem: x.owed}; });
  const rCopy = receivers.map(function(x) { return {id: x.id, rem: x.owed}; });

  while (pi < pCopy.length && ri < rCopy.length) {
    const p_ent = pCopy[pi];
    const r_ent = rCopy[ri];
    const settle = Math.min(p_ent.rem, r_ent.rem);
    if (settle > 0.001) {
      settlement_legs.push({
        from_entity: p_ent.id,
        to_entity:   r_ent.id,
        amount:      _round4(settle),
        currency:    base_currency,
      });
    }
    p_ent.rem = _round4(p_ent.rem - settle);
    r_ent.rem = _round4(r_ent.rem - settle);
    if (p_ent.rem < 0.001) pi++;
    if (r_ent.rem < 0.001) ri++;
  }

  const net_count = settlement_legs.length;
  const wire_count_savings = Math.max(0, gross_count - net_count);
  const wire_count_savings_pct = gross_count > 0 ? _round2(wire_count_savings / gross_count * 100) : 0;

  // Per-entity netting summary
  const entity_net_positions = entity_ids.map(function(id) {
    const net = net_pos[id] || 0;
    return {
      entity_id:   id,
      entity_name: entity_names[id] || id,
      net_amount:  net,
      currency:    base_currency,
      role:        net > 0.001 ? 'RECEIVER' : (net < -0.001 ? 'PAYER' : 'FLAT'),
    };
  });

  const gross_volume = _round4(gross_positions.reduce(function(s, gp) {
    return s + toBase(_finite((gp||{}).amount, 0), (gp||{}).currency || base_currency);
  }, 0));

  const net_volume = _round4(settlement_legs.reduce(function(s, leg) { return s + leg.amount; }, 0));

  return {
    entity_count:               entity_ids.length,
    gross_count,
    net_count,
    wire_count_savings,
    wire_count_savings_pct,
    gross_volume,
    net_volume,
    netting_efficiency_pct:     gross_volume > 0 ? _round2((1 - net_volume / gross_volume) * 100) : 0,
    entity_net_positions,
    settlement_legs,
    base_currency,
    table_version:  TABLE_VERSION,
    table_source:   TABLE_SOURCE,
    regulatory_basis: 'Multilateral netting per SWIFT gpi multilateral netting guide; BIS CPMI net settlement framework (2012, cpmi96). NOT estimate_ficc_margin_netting (FICC clearing margin netting). This node computes corporate CASH netting for TMS / in-house-bank settlement cycles. Netting statement suitable for anchor_batch Merkle-leaf receipts.',
    pii_note:         'ZERO PII: entity IDs, currency codes, and amounts only. No account holder, beneficial owner, or personal data enters this kernel.',
    not_legal_advice: 'Not legal or accounting advice. Netting arrangements must be validated under applicable netting law (e.g. ISDA master netting agreement, national netting legislation).',
    anchor_surface:   'anchor.ainumbers.co/mcp -- use anchor_batch to anchor the netting statement as a Merkle tree (one leaf per entity). Each entity receives an individual inclusion proof of the same net settlement cycle.',
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}
function _round2(v) { return Math.round(v * 100) / 100; }
function _round4(v) { return Math.round(v * 10000) / 10000; }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
