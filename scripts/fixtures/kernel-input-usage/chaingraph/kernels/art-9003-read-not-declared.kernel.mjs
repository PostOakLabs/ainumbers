// KERNEL-INPUT-USAGE-CHECK-1 fixture: READ-NOT-DECLARED (the inverse lie).
// `rush_processing` is read and used but the manifest does not declare it. Expected finding:
//   art-9003-read-not-declared READ-NOT-DECLARED rush_processing
const safeNum = (v, d) => (Number.isFinite(v) ? v : d);

export function compute(pp) {
  pp = pp || {};
  const amount = safeNum(pp.amount_cents, 0);
  const rush = Boolean(pp.rush_processing);
  return { amount, rush };
}
