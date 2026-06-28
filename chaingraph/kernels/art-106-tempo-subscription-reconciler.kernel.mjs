/**
 * art-106-tempo-subscription-reconciler.kernel.mjs
 * Tempo Subscription & Streaming Settlement Reconciler.
 * Reconciles executed MPP recurring/streamed draws against the authorized mandate envelope.
 * DISTINCT from art-36 (tempo-mpp-agent): art-36 grants the mandate; this audits executed draws.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';
const TOOL_ID = 'art-106-tempo-subscription-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'reconcile_mpp_subscription',
  mandate_type: 'settlement_mandate',
  gpu:          false,
};

const CADENCE_WINDOW_DAYS = { daily: 1, weekly: 7, monthly: 30 };

export function compute(pp) {
  const envelope = pp.envelope ?? {};
  const draws    = Array.isArray(pp.draws) ? pp.draws : [];

  const cap_total     = Number(envelope.cap_total)     || 0;
  const cap_per_cycle = Number(envelope.cap_per_cycle) || 0;
  const valid_until   = Number(envelope.valid_until)   || Infinity;
  const cadence       = envelope.cadence ?? 'monthly';
  const mode          = envelope.mode ?? 'subscription';

  const breaches = [];

  // Group draws by cycle
  const cycleMap = {};
  let total_drawn = 0;
  for (const draw of draws) {
    const seq    = draw.seq ?? 0;
    const amount = Number(draw.amount) || 0;
    const ts     = Number(draw.ts) || 0;
    const cycle  = draw.cycle ?? 1;

    total_drawn += amount;

    // Expiry breach
    if (ts > valid_until) {
      breaches.push({ seq, type: 'EXPIRY_BREACH', detail: `Draw ts ${ts} > valid_until ${valid_until}` });
    }

    // Accumulate per cycle
    if (!cycleMap[cycle]) cycleMap[cycle] = 0;
    cycleMap[cycle] += amount;
  }

  // Per-cycle cap check
  for (const [cycle, cycleTotal] of Object.entries(cycleMap)) {
    if (cap_per_cycle > 0 && cycleTotal > cap_per_cycle) {
      breaches.push({ cycle: Number(cycle), type: 'CYCLE_CAP_BREACH', detail: `Cycle total ${cycleTotal.toFixed(6)} > cap_per_cycle ${cap_per_cycle}` });
    }
  }

  // Cumulative cap check
  let cumulative_ok = true;
  if (cap_total > 0 && total_drawn > cap_total) {
    cumulative_ok = false;
    breaches.push({ type: 'CUMULATIVE_CAP_BREACH', detail: `Total drawn ${total_drawn.toFixed(6)} > cap_total ${cap_total}` });
  }

  const cycles_ok   = !breaches.some(b => b.type === 'CYCLE_CAP_BREACH');
  const residual_envelope = Math.max(0, cap_total - total_drawn);

  // Draw-set deterministic leaf hash (commitment; real SHA-256 Merkle done by cry-04)
  const drawLeaves  = draws.map(d => `${d.seq}:${Number(d.amount).toFixed(6)}:${d.ts}:${d.cycle}`).sort().join('|');
  const draw_merkle_root = `leaf-commit:${draws.length}:${drawLeaves.length}`;

  const verdict = breaches.length === 0 ? 'CONFORMANT' : 'BREACH_DETECTED';

  const compliance_flags = [verdict === 'CONFORMANT' ? 'MPP_DRAWS_CONFORMANT' : 'MPP_DRAW_BREACH'];
  if (cycles_ok) compliance_flags.push('CYCLE_CAPS_OK');
  if (cumulative_ok) compliance_flags.push('CUMULATIVE_CAP_OK');

  const output_payload = {
    cycles_ok,
    cumulative_ok,
    breaches,
    total_drawn: +total_drawn.toFixed(6),
    residual_envelope: +residual_envelope.toFixed(6),
    draw_count: draws.length,
    draw_merkle_root,
    verdict,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, {
  now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0,
  sign = null,
} = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const artifact = {
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
  if (!sign) return artifact;
  // §16 signer imported lazily so the runner-guest (which only runs compute()) need not resolve _proof.mjs.
  const { sign: proofSign } = await import('./_proof.mjs');
  return proofSign(artifact, sign);
}
