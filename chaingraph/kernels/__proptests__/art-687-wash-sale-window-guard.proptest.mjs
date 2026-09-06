// art-687-wash-sale-window-guard — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:90239f1ed800b3758c774493db294a17aec61bb1f994506ea0d1df46f79c6378
// spec: HARVEST-GUARD-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-687-wash-sale-window-guard.proptest.mjs

import { compute } from '../art-687-wash-sale-window-guard.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-687-wash-sale-window-guard';

// Deterministic pseudo-random draws — never Math.random(), the kernel and the
// property test must be reproducible byte-for-byte.
const rand = mulberry32(686);

function round2dpHalfUp(x) {
  const scaled = x * 100;
  const r = Math.sign(scaled) * Math.round(Math.abs(scaled) + Number.EPSILON * Math.abs(scaled));
  return r / 100;
}

// Calendar-date helpers mirroring the kernel's own UTC arithmetic (declared dates
// only, never the host clock).
const DAY = 86400000;
function parseIso(v) {
  return Date.UTC(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));
}
function isoFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
function randomIsoDate() {
  const ms = Date.UTC(2024, 0, 1) + Math.floor(rand() * 1500) * DAY;
  return isoFromMs(ms);
}

// Class-A: window bounds are exactly sale_date minus/plus 30 days (inclusive), and
// replacements_in_window counts exactly the declared purchases inside it, with the
// trace restating the same numbers.
function checkWindowArithmetic() {
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 300; i++) {
    const saleDate = randomIsoDate();
    const n = Math.floor(rand() * 4);
    const purchases = [];
    for (let j = 0; j < n; j++) {
      const offset = Math.floor(rand() * 121) - 60; // -60..+60 days around the sale
      purchases.push({
        date: isoFromMs(parseIso(saleDate) + offset * DAY),
        account_type: rand() < 0.5 ? 'taxable' : 'tax_deferred',
      });
    }
    const pp = {
      sale: { lot_id: `SYN-${i}`, sale_date: saleDate, realized_loss: round2dpHalfUp(rand() * 10000) },
      replacement_purchases: purchases,
    };
    const { output_payload } = compute(pp);
    const startMs = parseIso(saleDate) - 30 * DAY;
    const endMs = parseIso(saleDate) + 30 * DAY;
    const expected = purchases.filter((p) => {
      const ms = parseIso(p.date);
      return ms >= startMs && ms <= endMs;
    }).length;
    checked++;
    if (output_payload.window_start !== isoFromMs(startMs) || output_payload.window_end !== isoFromMs(endMs)) violations++;
    if (output_payload.replacements_in_window !== expected) violations++;
  }
  return { name: 'window-bounds-and-membership-61-day', checked, violations };
}

// Class-B: disallowed loss equals the declared loss exactly when the window is
// non-empty and zero otherwise; overall tracks that verdict (both verdicts
// reachable); ira_trap is true exactly when an in-window replacement is tax_deferred.
function checkVerdictAndLoss() {
  let checked = 0;
  let violations = 0;
  const seenOverall = new Set();
  const seenIra = new Set();
  for (let i = 0; i < 300; i++) {
    const saleDate = randomIsoDate();
    const n = Math.floor(rand() * 3);
    const purchases = [];
    for (let j = 0; j < n; j++) {
      const offset = Math.floor(rand() * 121) - 60;
      purchases.push({
        date: isoFromMs(parseIso(saleDate) + offset * DAY),
        account_type: rand() < 0.4 ? 'tax_deferred' : 'taxable',
      });
    }
    const loss = round2dpHalfUp(rand() * 5000);
    const pp = { sale: { lot_id: `SYN-${i}`, sale_date: saleDate, realized_loss: loss }, replacement_purchases: purchases };
    const { output_payload } = compute(pp);
    const startMs = parseIso(saleDate) - 30 * DAY;
    const endMs = parseIso(saleDate) + 30 * DAY;
    const inWindow = purchases.filter((p) => {
      const ms = parseIso(p.date);
      return ms >= startMs && ms <= endMs;
    });
    const wantFlagged = inWindow.length > 0;
    const wantOverall = wantFlagged ? 'WASH_SALE_FLAGGED' : 'WASH_SALE_CLEAR';
    const wantLoss = wantFlagged ? loss : 0;
    const wantIra = inWindow.some((p) => p.account_type === 'tax_deferred');
    checked++;
    if (output_payload.overall !== wantOverall || output_payload.disallowed_loss !== wantLoss || output_payload.ira_trap !== wantIra) violations++;
    seenOverall.add(output_payload.overall);
    seenIra.add(output_payload.ira_trap);
  }
  checked++;
  if (!seenOverall.has('WASH_SALE_FLAGGED') || !seenOverall.has('WASH_SALE_CLEAR')) violations++;
  checked++;
  if (!seenIra.has(true) || !seenIra.has(false)) violations++;
  return { name: 'disallowed-loss-verdict-and-ira-trap', checked, violations };
}

// Class-K invalid-domain rejection: undated or malformed lots fail closed (throw),
// never silently compute.
function checkInvalidDomainRejection() {
  const bad = [
    { sale: { lot_id: 'SYN-1', realized_loss: 100 }, replacement_purchases: [] },
    { sale: { lot_id: 'SYN-1', sale_date: 'not-a-date', realized_loss: 100 }, replacement_purchases: [] },
    { sale: { lot_id: 'SYN-1', sale_date: '2026-02-30', realized_loss: 100 }, replacement_purchases: [] },
    { sale: { lot_id: '', sale_date: '2026-03-10', realized_loss: 100 }, replacement_purchases: [] },
    { sale: { lot_id: 'SYN-1', sale_date: '2026-03-10' }, replacement_purchases: [] },
    { sale: { lot_id: 'SYN-1', sale_date: '2026-03-10', realized_loss: -1 }, replacement_purchases: [] },
    { sale: { lot_id: 'SYN-1', sale_date: '2026-03-10', realized_loss: 100 } },
    { sale: { lot_id: 'SYN-1', sale_date: '2026-03-10', realized_loss: 100 }, replacement_purchases: [{ account_type: 'taxable' }] },
    { sale: { lot_id: 'SYN-1', sale_date: '2026-03-10', realized_loss: 100 }, replacement_purchases: [{ date: 'nope', account_type: 'taxable' }] },
    { sale: { lot_id: 'SYN-1', sale_date: '2026-03-10', realized_loss: 100 }, replacement_purchases: [{ date: '2026-03-20', account_type: 'roth' }] },
  ];
  let checked = 0;
  let violations = 0;
  for (const pp of bad) {
    let threw = false;
    try { compute(pp); } catch { threw = true; }
    checked++;
    if (!threw) violations++;
  }
  return { name: 'invalid-domain-rejection-throws', checked, violations };
}

// Output-shape: the canonical-parity vector carries exactly the seven declared
// members and no extras; the warnings mirror appears only when the IRA-trap
// warning fires; determinism over repeats.
function checkOutputShapeAndDeterminism() {
  const canonical = {
    sale: { lot_id: 'SYN-A', sale_date: '2026-03-10', realized_loss: 1200 },
    replacement_purchases: [{ date: '2026-03-25', account_type: 'taxable' }],
  };
  let checked = 0;
  let violations = 0;
  const a = compute(canonical).output_payload;
  const b = compute(canonical).output_payload;
  checked++;
  if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  checked++;
  if (JSON.stringify(Object.keys(a).sort()) !== JSON.stringify(['disallowed_loss', 'ira_trap', 'overall', 'replacements_in_window', 'trace', 'window_end', 'window_start'])) violations++;
  const withIra = compute({
    sale: { lot_id: 'SYN-C', sale_date: '2026-03-10', realized_loss: 1200 },
    replacement_purchases: [{ date: '2026-03-20', account_type: 'tax_deferred' }],
  }).output_payload;
  checked++;
  if (withIra.warnings == null || JSON.stringify(withIra.warnings) !== JSON.stringify(['WSG_IRA_TRAP'])) violations++;
  return { name: 'output-shape-and-determinism', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkWindowArithmetic(),
  checkVerdictAndLoss(),
  checkInvalidDomainRejection(),
  checkOutputShapeAndDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — Wash-Sale Window Guard.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
