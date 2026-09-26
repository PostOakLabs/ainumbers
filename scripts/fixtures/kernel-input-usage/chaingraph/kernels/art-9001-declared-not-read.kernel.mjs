// KERNEL-INPUT-USAGE-CHECK-1 fixture: DECLARED-NOT-READ.
// `unused_threshold` is in the manifest's input_schema.properties and never appears in this
// source in any of the four read shapes; `amount_cents` is read and used. Expected finding:
//   art-9001-declared-not-read DECLARED-NOT-READ unused_threshold
const safeNum = (v, d) => (Number.isFinite(v) ? v : d);

export function compute(pp) {
  pp = pp || {};
  const amount = safeNum(pp.amount_cents, 0);
  return { amount };
}
