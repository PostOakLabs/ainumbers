// KERNEL-INPUT-USAGE-CHECK-1 fixture: READ-NOT-USED (the art-224 shape).
// `notice_text` is read into the local `threshold` (line marked below) and the local never
// recurs after that line. Expected finding:
//   art-9002-read-not-used READ-NOT-USED notice_text
const safeNum = (v, d) => (Number.isFinite(v) ? v : d);

export function compute(pp) {
  pp = pp || {};
  const amount = safeNum(pp.amount_cents, 0);
  const threshold = String(pp.notice_text || 'none').toLowerCase(); // bound, never used
  return { amount };
}
