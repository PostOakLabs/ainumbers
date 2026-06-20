/**
 * art-55-trade-document-provenance-verifier.kernel.mjs
 * Wave 12 — Trade Document Provenance & Consistency Verifier.
 * Cross-validates a full trade-document set for internal consistency,
 * computes a Merkle provenance root, and flags TBML red flags.
 * Pure decision kernel — no DOM, no window, no Date.now().
 * Spec: WORKFLOW-CANDIDATES-WAVE12_2026-06-19.md §2.4.
 * Citations: FATF Trade-Based Money Laundering typologies; ICC DSI KTDDE.
 * Educational screen — not a SAR determination.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-55-trade-document-provenance-verifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'verify_trade_document_set',
  mandate_type: 'cryptographic_mandate',
  gpu:          false,
};

// Fields that must match across all docs (per ICC DSI KTDDE field model)
const CONSISTENCY_FIELDS = ['party_seller', 'party_buyer', 'goods_desc', 'currency', 'incoterm'];
// Numeric fields to cross-check (quantity × unit_price should = total_amount)
const AMOUNT_TOLERANCE = 0.01; // 1 cent absolute tolerance
// Over/under-invoicing threshold vs reference market price
const INVOICING_DEVIATION_THRESHOLD = 0.20; // 20%
// Phantom shipment: same goods_desc, different unit_price delta
const PHANTOM_DELTA_THRESHOLD = 0.10; // 10%

export function compute(pp) {
  const {
    documents           = [],
    reference_market_price = null,
    expected_route      = '',
    hash_alg            = 'sha-256',
  } = pp;

  const docs = Array.isArray(documents) ? documents : [];
  const mismatches = [];
  const tbml_flags = [];

  // 1. Field consistency matrix
  for (const field of CONSISTENCY_FIELDS) {
    const vals = docs.map(d => String(d[field] ?? '').trim()).filter(v => v !== '');
    const unique = [...new Set(vals)];
    if (unique.length > 1) {
      mismatches.push({
        field,
        docs: docs.map(d => d.doc_type),
        detail: `${field} differs across documents: ${unique.join(' | ')}`,
      });
    }
  }

  // 2. Amount consistency (quantity × unit_price ≈ total_amount)
  for (const doc of docs) {
    const qty   = Number(doc.quantity   ?? 0);
    const price = Number(doc.unit_price ?? 0);
    const total = Number(doc.total_amount ?? 0);
    if (qty > 0 && price > 0 && Math.abs(qty * price - total) > AMOUNT_TOLERANCE) {
      mismatches.push({
        field: 'total_amount',
        docs: [doc.doc_type],
        detail: `${doc.doc_type}: quantity (${qty}) × unit_price (${price}) = ${(qty*price).toFixed(2)} but total_amount = ${total}`,
      });
    }
  }

  // 3. Over/under-invoicing vs reference_market_price
  let invoicing_deviation_pct = null;
  if (reference_market_price != null && Number(reference_market_price) > 0) {
    const refPrice = Number(reference_market_price);
    // Use first non-zero unit_price found
    const sampleDoc = docs.find(d => Number(d.unit_price ?? 0) > 0);
    if (sampleDoc) {
      const unitP = Number(sampleDoc.unit_price);
      invoicing_deviation_pct = +((Math.abs(unitP - refPrice) / refPrice) * 100).toFixed(1);
      if (invoicing_deviation_pct > INVOICING_DEVIATION_THRESHOLD * 100) {
        const dir = unitP > refPrice ? 'OVER' : 'UNDER';
        tbml_flags.push(`${dir}_INVOICING_SUSPECTED`);
        tbml_flags.push('TBML_RED_FLAG');
      }
    }
  }

  // 4. Phantom shipment / price inconsistency across docs with same goods_desc
  const byGoods = {};
  for (const doc of docs) {
    const gk = String(doc.goods_desc ?? '').trim().toLowerCase();
    if (!gk) continue;
    if (!byGoods[gk]) byGoods[gk] = [];
    byGoods[gk].push(Number(doc.unit_price ?? 0));
  }
  for (const [goods, prices] of Object.entries(byGoods)) {
    const nonzero = prices.filter(p => p > 0);
    if (nonzero.length >= 2) {
      const mn = Math.min(...nonzero), mx = Math.max(...nonzero);
      if (mn > 0 && (mx - mn) / mn > PHANTOM_DELTA_THRESHOLD) {
        tbml_flags.push('PHANTOM_SHIPMENT_SUSPECTED');
        if (!tbml_flags.includes('TBML_RED_FLAG')) tbml_flags.push('TBML_RED_FLAG');
      }
    }
  }

  const consistency_verdict = mismatches.length === 0 ? 'consistent' : 'inconsistent';

  // 5. Merkle root — SHA-256 over sorted canonicalized document set
  // Computed async in buildArtifact; here return a placeholder key for compute()
  const doc_count = docs.length;

  const output_payload = {
    consistency_verdict,
    mismatches,
    tbml_flags,
    invoicing_deviation_pct,
    merkle_root: null,  // filled by buildArtifact (requires async crypto)
    doc_count,
    note: 'Cross-document consistency and TBML red-flag screen per FATF TBML typologies and ICC DSI KTDDE field model. Merkle root anchors the document set. Educational screen — not a SAR determination.',
  };

  const compliance_flags = [];
  if (consistency_verdict === 'inconsistent') compliance_flags.push('DOC_SET_INCONSISTENT');
  if (tbml_flags.includes('OVER_INVOICING_SUSPECTED'))     compliance_flags.push('OVER_INVOICING_SUSPECTED');
  if (tbml_flags.includes('UNDER_INVOICING_SUSPECTED'))    compliance_flags.push('UNDER_INVOICING_SUSPECTED');
  if (tbml_flags.includes('TBML_RED_FLAG'))                compliance_flags.push('TBML_RED_FLAG');
  if (tbml_flags.includes('PHANTOM_SHIPMENT_SUSPECTED'))   compliance_flags.push('PHANTOM_SHIPMENT_SUSPECTED');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);

  // Compute Merkle root over sorted document set
  const docs = Array.isArray(pp.documents) ? pp.documents : [];
  const sorted_docs = [...docs].sort((a, b) => String(a.doc_type).localeCompare(String(b.doc_type)));
  const merkle_root = await executionHash({ documents: sorted_docs }, { merkle_schema: 'sha256-ktdde-v1' });
  output_payload.merkle_root = merkle_root;

  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
