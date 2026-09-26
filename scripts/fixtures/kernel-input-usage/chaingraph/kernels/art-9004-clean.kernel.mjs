// KERNEL-INPUT-USAGE-CHECK-1 fixture: CLEAN — exercises all four read shapes, every binding used.
// Declared: amount_cents (shape 1: pp.<key>), risk_tier (shape 2: policy_parameters.<key>),
// region_code (shape 3: pp['<key>']), channel (shape 4: destructuring { <key> } = pp).
// Each bound local recurs after its declaration line, so NO finding may be emitted for this kernel.
const safeNum = (v, d) => (Number.isFinite(v) ? v : d);

export function compute(pp) {
  pp = pp || {};
  const amount = safeNum(pp.amount_cents, 0);
  const tier = String(policy_parameters.risk_tier || 'standard').toLowerCase();
  const region = String(pp['region_code'] || 'US').toUpperCase();
  const { channel } = pp;
  return { amount, tier, region, channel };
}
