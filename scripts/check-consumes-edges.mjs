#!/usr/bin/env node
/**
 * check-consumes-edges.mjs — CONSUMES-EDGE-CHECK-1.
 *
 * Verifies every DECLARED `consumes:` pin against its supplier kernel — the
 * sharpest consistency gap in the estate: kernels assert cross-kernel identity
 * in their own payloads ("This node pins the same values for local deterministic
 * compute", art-234 payload `consumes:` line) while NOTHING checked it. This is
 * the measured silently-fallback-compute class: a consumer pins a local copy of a
 * supplier's table, the copy goes stale or falls back silently, and every
 * per-kernel fixture suite stays green because the fixtures are regenerated from
 * the stale copy itself.
 *
 * ── WHAT IT DOES ──────────────────────────────────────────────────────────────
 *
 * 1. SCAN. Walks chaingraph/kernels/*.kernel.mjs for declared `consumes:` edges
 *    naming a supplier kernel: payload string declarations
 *    (`consumes: 'art-220 (lookup_reg_z_thresholds) supplies …'`) and header
 *    comment declarations (`// CONSUMES: art-220 …`). Every declared edge is
 *    resolved to its supplier kernel file by tool-id prefix.
 *
 * 2. COMPARE — EQUIVALENCE CLASSES, NOT BARE EQUALITY. For each edge with a
 *    calibration adapter, the CONSUMER's EFFECTIVE per-year values are probed
 *    through its own compute() (never read out of a source literal — SO #34
 *    independent derivation: the probe measures what the kernel actually applies,
 *    which is exactly where a silent `table[year] || table[2026]` fallback
 *    becomes visible) and compared with the SUPPLIER's published table row for
 *    the same year. Verdict per edge:
 *
 *      BYTE-EQUAL       every overlapping entry equal, consumer covers every
 *                       supplier-published year
 *      SUBSET-BY-YEAR   every overlapping entry equal, consumer pins fewer years
 *                       than the supplier publishes (legal per art-235's own
 *                       payload note — dated entries only for retrieved years)
 *      MISMATCH         any overlapping entry differs → RED
 *      UNVERIFIED-NO-ADAPTER
 *                       a declared edge no adapter covers — ⛔ NEVER counted
 *                       clean (SO #34c: absence of a check is not a pass)
 *      UNRESOLVED-SUPPLIER
 *                       the named supplier kernel file does not exist → RED
 *
 * 3. CALIBRATE — CCPP Family A (art-220 → art-218 / art-234 / art-235), with
 *    DECLARED EXPECTATIONS in the pilot's style (`__consistency__/_consistency-
 *    harness.mjs`): each edge declares what it expects BEFORE it runs, and a
 *    result that disagrees with the declaration in EITHER direction is a
 *    SURPRISE, reported loudly. art-234's edge declares MISMATCH while
 *    CCPP-FIX-ART234-1 is open (its HOEPA_PF holds only 2025+2026 and its
 *    compute falls back silently to 2026 for 2021-2024 — the known divergence);
 *    the day the fix lands, the same declaration turns the fix's green into a
 *    visible SURPRISE that tells the session to flip the declaration.
 *
 * 4. REPORT-ONLY. Exit 0 always in default/--summary modes (ADVISORY BY DESIGN —
 *    wired as a non-blocking preflight report; blocking promotion is a SEPARATE
 *    decision with measured cost, per the row). --strict exits 1 on any
 *    MISMATCH / UNRESOLVED-SUPPLIER / SURPRISE (for that future row; NOT wired
 *    anywhere blocking today). The selftest exits 1 on any failed control.
 *
 * ── MUTATION ADEQUACY (SO #34c RED control, house rule) ──────────────────────
 * `scripts/consumes-edge-fixtures/art-234-hoepa-floor-perturbed.fixture.mjs` is
 * a scratch copy of the art-234 Family-A probe shape with ONE pinned value
 * perturbed (2026 points-and-fees floor 1380 → 1379). `--self-test` proves the
 * comparator FIRES on that single-value mutation (names the exact year+field),
 * and that the unperturbed run's failing-entry set excludes it — so the
 * checker's sensitivity is measured, not assumed. Run:
 *
 *   node scripts/check-consumes-edges.test.mjs
 *
 * ⛔ Zero kernel bytes edited, zero supplier bytes edited — report-only gate.
 *   Kernel modules are IMPORTED for probing (a read-only behavioural measurement,
 *   the same access the __consistency__ pilot uses); nothing is written.
 *
 * Run: node scripts/check-consumes-edges.mjs [--summary] [--strict] [--json <path>]
 *      node scripts/check-consumes-edges.mjs --self-test
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KERNELS_DIR = join(REPO_ROOT, 'chaingraph', 'kernels');

// ── Verdict vocabulary ───────────────────────────────────────────────────────
export const VERDICT = {
  BYTE_EQUAL: 'BYTE-EQUAL',
  SUBSET_BY_YEAR: 'SUBSET-BY-YEAR',
  MISMATCH: 'MISMATCH',
  UNVERIFIED_NO_ADAPTER: 'UNVERIFIED-NO-ADAPTER',
  UNRESOLVED_SUPPLIER: 'UNRESOLVED-SUPPLIER',
};

// ── Scanner ──────────────────────────────────────────────────────────────────
/**
 * Extract declared `consumes:` edges from one kernel source.
 * @returns {Array<{consumer:string, supplierArt:number, declaration:string, where:string}>}
 */
export function scanSource(consumerToolId, source) {
  const edges = [];
  const seen = new Set();
  const push = (supplierArt, declaration, where) => {
    const key = `${supplierArt}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ consumer: consumerToolId, supplierArt, declaration, where });
  };
  // Payload string declarations: consumes: '…art-NNN…'
  for (const m of source.matchAll(/consumes:\s*(['"`])([^'"`\n]*art-(\d+)[^'"`\n]*)\1/g)) {
    push(Number(m[3]), m[2].trim(), 'payload');
  }
  // Header comment declarations: // CONSUMES: art-NNN …
  for (const m of source.matchAll(/^\s*\/\/\s*CONSUMES:\s*art-(\d+)\b.*$/gim)) {
    push(Number(m[1]), m[0].trim(), 'header-comment');
  }
  return edges;
}

/** Enumerate live kernel files + their tool ids, and every declared edge. */
export function scanEstate(kernelsDir = KERNELS_DIR) {
  const files = readdirSync(kernelsDir).filter((f) => f.endsWith('.kernel.mjs') && !f.startsWith('_'));
  const kernels = [];
  const edges = [];
  for (const f of files) {
    const source = readFileSync(join(kernelsDir, f), 'utf8');
    const toolId = f.replace(/\.kernel\.mjs$/, '');
    kernels.push({ file: f, toolId });
    for (const e of scanSource(toolId, source)) edges.push({ ...e, consumerFile: f });
  }
  return { kernels, edges };
}

// ── Probing helpers (SO #34: derive everything from the kernels' own compute) ─
const EPS = 1e-9;
function numEq(a, b) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)) + EPS;
}
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN; }

// ── Comparator ───────────────────────────────────────────────────────────────
/**
 * Classify one edge from per-year {field: value} maps of consumer-effective and
 * supplier-published values. A year the consumer cannot answer (null/undefined/
 * NaN entry set) is a NON-overlap — the SUBSET class, never a mismatch.
 */
export function classify(consumerByYear, supplierByYear) {
  const supplierYears = Object.keys(supplierByYear).map(Number).sort((a, b) => a - b);
  const consumerYears = Object.keys(consumerByYear).map(Number).sort((a, b) => a - b);
  const entries = [];
  let diffs = 0;
  let overlaps = 0;
  for (const y of supplierYears) {
    const c = consumerByYear[y];
    const s = supplierByYear[y];
    if (!c) continue; // consumer does not answer this year at all → non-overlap
    let yearDiffers = false;
    let comparable = 0;
    const detail = {};
    for (const field of Object.keys(s)) {
      const cv = c[field];
      const sv = s[field];
      if (cv === undefined) continue; // field not measured for this consumer → not comparable
      comparable += 1;
      const eq = numEq(cv, sv);
      detail[field] = { supplier: sv, consumer: cv, equal: eq };
      if (!eq) { yearDiffers = true; diffs += 1; }
    }
    if (comparable === 0) continue; // a year with NOTHING comparable is a non-overlap, never a pass (SO #34c)
    overlaps += 1;
    entries.push({ year: y, differs: yearDiffers, fields: detail });
  }
  const covered = Object.keys(consumerByYear).length;
  let verdict;
  if (diffs > 0) verdict = VERDICT.MISMATCH;
  else if (overlaps === 0) verdict = 'UNVERIFIED-NO-OVERLAP'; // vacuous comparison is NEVER clean (SO #34c)
  else if (overlaps === supplierYears.length) verdict = VERDICT.BYTE_EQUAL;
  else verdict = VERDICT.SUBSET_BY_YEAR;
  return { verdict, diffs, overlappingYears: overlaps, supplierYears, consumerYears: covered, entries };
}

// ── Family-A adapters (art-220 publisher; art-218 / art-234 / art-235) ───────
// Each adapter probes the CONSUMER's compute() per year and shapes BOTH sides
// into one projected field vocabulary, so classify() compares like with like.
// The CONSUMER's values are always measured through its own compute() (never
// read out of a source literal — SO #34): the probe measures what the kernel
// actually applies, which is exactly where a silent `table[year] ||
// table[2026]` fallback becomes visible.
function supplierRow(art220, table, year) {
  const { output_payload } = art220({ year, table });
  return output_payload && output_payload.data ? { years: output_payload.available_years, row: output_payload.data } : null;
}
function supplierYears(art220, table) {
  return supplierRow(art220, table, 2026).years;
}

// art-218: four tier probes per year, projected onto the limit art-220 implies
// at each probe point (the CCPP pilot P-A1 probe set).
const ART218_PROBES = [
  { key: 'qm_limit_at_tier1_floor', from: (d) => d.tier_1_min, implied: (d) => r2(d.tier_1_min * d.tier_1_pct / 100) },
  { key: 'qm_limit_just_below_tier1', from: (d) => d.tier_1_min - 1, implied: (d) => d.tier_2_fixed },
  { key: 'qm_limit_at_tier3_floor', from: (d) => d.tier_3_min, implied: (d) => r2(d.tier_3_min * d.tier_3_pct / 100) },
  { key: 'qm_limit_small_loan', from: () => 1000, implied: (d) => r2(1000 * d.tier_5_pct / 100) },
];
function probeArt218(art218, art220) {
  const byYear = {};
  for (const year of supplierYears(art220, 'qm_points_fees')) {
    const d = supplierRow(art220, 'qm_points_fees', year).row;
    const values = {};
    for (const p of ART218_PROBES) {
      const out = art218({ loan_amount: p.from(d), points_and_fees: 0, year }).output_payload;
      values[p.key] = Number.isFinite(out.limit) ? out.limit : null;
    }
    byYear[year] = values;
  }
  return byYear;
}
function supplierArt218(art220) {
  const byYear = {};
  for (const year of supplierYears(art220, 'qm_points_fees')) {
    const d = supplierRow(art220, 'qm_points_fees', year).row;
    const values = {};
    for (const p of ART218_PROBES) values[p.key] = p.implied(d);
    byYear[year] = values;
  }
  return byYear;
}

export function probeArt234(art234, art220) {
  const byYear = {};
  for (const year of supplierYears(art220, 'hoepa')) {
    const small = { loan_amount: 10000, points_and_fees: 0, year, apr_pct: 0, apor_pct: 0 };
    const first = art234({ ...small, lien_type: 'first' }).output_payload;
    const sub = art234({ ...small, lien_type: 'subordinate' }).output_payload;
    byYear[year] = {
      points_fees_floor: first.points_fees_floor,
      points_fees_pct: first.points_fees_limit_pct,
      rate_spread_first_lien_pp: first.apr_threshold_pct,
      rate_spread_sub_lien_pp: sub.apr_threshold_pct,
    };
  }
  return byYear;
}
export function supplierArt234(art220) {
  const byYear = {};
  for (const year of supplierYears(art220, 'hoepa')) {
    const d = supplierRow(art220, 'hoepa', year).row;
    byYear[year] = {
      points_fees_floor: d.points_fees_floor,
      points_fees_pct: d.points_fees_pct,
      rate_spread_first_lien_pp: d.rate_spread_first_lien_pp,
      rate_spread_sub_lien_pp: d.rate_spread_sub_lien_pp,
    };
  }
  return byYear;
}

function probeArt235(art235, art220) {
  const byYear = {};
  for (const year of supplierYears(art220, 'hpml')) {
    const combos = [
      { lien_type: 'first', is_jumbo: false, field: 'first_lien_pp' },
      { lien_type: 'first', is_jumbo: true, field: 'first_lien_jumbo_pp' },
      { lien_type: 'subordinate', is_jumbo: false, field: 'sub_lien_pp' },
    ];
    const values = {};
    for (const c of combos) {
      const o = art235({ year, apr_pct: 5, apor_pct: 3, lien_type: c.lien_type, is_jumbo: c.is_jumbo }).output_payload;
      values[c.field] = Number.isFinite(o.spread_threshold_pct) ? o.spread_threshold_pct : null;
    }
    byYear[year] = values;
  }
  return byYear;
}
function supplierArt235(art220) {
  const byYear = {};
  for (const year of supplierYears(art220, 'hpml')) {
    const d = supplierRow(art220, 'hpml', year).row;
    byYear[year] = {
      first_lien_pp: d.first_lien_pp,
      first_lien_jumbo_pp: d.first_lien_jumbo_pp,
      sub_lien_pp: d.sub_lien_pp,
    };
  }
  return byYear;
}

// ── Declared expectations (declared-expectation style, pre-pilot SO #34c) ────
export const DECLARED_EXPECTATIONS = {
  'art-234-test-hoepa-high-cost->art-220-reg-z-threshold-lookup': {
    expect: VERDICT.MISMATCH,
    reason: 'DECLARED while CCPP-FIX-ART234-1 is open: HOEPA_PF pins only 2025+2026 and compute() falls back silently to 2026 for 2021-2024 (floor too high → false negatives on a consumer-protection trigger). Flip this declaration to HOLDS-class in the same PR that lands the fix.',
  },
  'art-235-test-hpml-escrow->art-220-reg-z-threshold-lookup': {
    expect: 'HOLDS', // BYTE-EQUAL or SUBSET-BY-YEAR both satisfy
    reason: 'art-235 pins the structural spread tiers (1.5/2.5/3.5 pp, not indexed) and dates only the asset limits; every overlapping year must equal art-220.',
  },
};

// Calibration-only edges: Family-A members whose consumer relationship the row
// requires to classify correctly even though the kernel carries no `consumes:`
// declaration of its own. Reported as a distinct class — an UNDECLARED consumer
// is itself a consistency gap (the supplier cannot be discovered from the
// consumer's payload), but the VALUE relationship is still verified.
export const CALIBRATION_ONLY = {
  'art-218-qm-points-and-fees->art-220-reg-z-threshold-lookup': {
    expect: 'HOLDS',
    reason: 'art-218 applies the QM points-and-fees tiers art-220 publishes but declares no consumes: edge — a Family-A calibration measurement (CCPP pilot P-A1), reported as UNDECLARED-CONSUMER + value verdict.',
    undeclared: true,
  },
};

function loadKernel(file) {
  return import(pathToFileURL(join(KERNELS_DIR, file)).href);
}
const k = (toolId) => `${toolId}.kernel.mjs`;

// ── The gate body ────────────────────────────────────────────────────────────
/**
 * Run the full edge check.
 * @param {object} [opts] { kernelsDir, imports } — imports overrides kernel
 *        module loading for the selftest fixtures.
 * @returns {{startedAt:Date, wallMs:number, scanned:number, edges:Array, surprises:Array}}
 */
export async function runCheck(opts = {}) {
  const startedAt = new Date();
  const kernelsDir = opts.kernelsDir ?? KERNELS_DIR;
  const load = opts.imports ?? {
    'art-218-qm-points-and-fees': () => loadKernel(k('art-218-qm-points-and-fees')),
    'art-220-reg-z-threshold-lookup': () => loadKernel(k('art-220-reg-z-threshold-lookup')),
    'art-234-test-hoepa-high-cost': () => loadKernel(k('art-234-test-hoepa-high-cost')),
    'art-235-test-hpml-escrow': () => loadKernel(k('art-235-test-hpml-escrow')),
  };

  const { kernels, edges } = scanEstate(kernelsDir);
  const toolIds = new Set(kernels.map((x) => x.toolId));

  const results = [];
  const surprises = [];

  async function measureEdge(edgeKey, consumerId, supplierId, declared, undeclared) {
    if (!toolIds.has(supplierId) && !opts.imports) {
      return {
        edge: edgeKey, verdict: VERDICT.UNRESOLVED_SUPPLIER,
        note: `supplier kernel file ${k(supplierId)} does not exist`,
        declared: declared?.expect ?? null, surprise: false, undeclared: Boolean(undeclared),
      };
    }
    const [cMod, sMod] = await Promise.all([load[consumerId](), load[supplierId]()]);
    const art220 = sMod.compute;
    let byYear, supplierByYear;
    if (consumerId.startsWith('art-218')) { byYear = probeArt218(cMod.compute, art220); supplierByYear = supplierArt218(art220); }
    else if (consumerId.startsWith('art-234')) { byYear = probeArt234(cMod.compute, art220); supplierByYear = supplierArt234(art220); }
    else if (consumerId.startsWith('art-235')) { byYear = probeArt235(cMod.compute, art220); supplierByYear = supplierArt235(art220); }
    else return { edge: edgeKey, verdict: VERDICT.UNVERIFIED_NO_ADAPTER, note: 'declared edge has no calibration adapter — never counted clean (SO #34c)', declared: declared?.expect ?? null, surprise: false, undeclared: Boolean(undeclared) };

    const cls = classify(byYear, supplierByYear);
    const holding = cls.verdict === VERDICT.BYTE_EQUAL || cls.verdict === VERDICT.SUBSET_BY_YEAR;
    const declaredOk = !declared || declared.expect === 'HOLDS' ? holding : cls.verdict === declared.expect;
    return {
      edge: edgeKey, verdict: cls.verdict, diffs: cls.diffs,
      overlappingYears: cls.overlappingYears, consumerYears: cls.consumerYears,
      supplierYears: cls.supplierYears.length,
      declared: declared?.expect ?? null, declaredOk,
      surprise: !declaredOk,
      surpriseNote: declaredOk ? null : `declared ${declared?.expect ?? '(nothing)'} but observed ${cls.verdict}`,
      reason: declared?.reason ?? null, undeclared: Boolean(undeclared),
      entries: cls.verdict === VERDICT.MISMATCH ? cls.entries.filter((e) => e.differs) : undefined,
    };
  }

  // (1) Every DECLARED edge from the scanner.
  for (const e of edges) {
    // Resolve supplier tool id by prefix match among scanned kernels.
    const resolved = kernels.map((x) => x.toolId).find((t) => t.startsWith(`art-${e.supplierArt}-`));
    const key = `${e.consumer}->${resolved ?? `art-${e.supplierArt}(unresolved)`}`;
    const declared = DECLARED_EXPECTATIONS[key];
    if (!resolved) {
      results.push({ edge: key, verdict: VERDICT.UNRESOLVED_SUPPLIER, note: `no kernel file art-${e.supplierArt}-*.kernel.mjs`, declared: declared?.expect ?? null, surprise: false, where: e.where });
      continue;
    }
    results.push(await measureEdge(key, e.consumer, resolved, declared, false));
  }

  // (2) Calibration-only edges (Family A members without their own declaration).
  for (const [key, cfg] of Object.entries(CALIBRATION_ONLY)) {
    const [consumerId, supplierId] = key.split('->');
    results.push(await measureEdge(key, consumerId, supplierId, cfg, cfg));
  }

  for (const r of results) if (r.surprise) surprises.push(r);

  // Edge-listing check: any declared edge key with no DECLARED_EXPECTATIONS entry
  // is fine (UNVERIFIED-NO-ADAPTER already reports it), but a DECLARED_EXPECTATIONS
  // key that no longer matches any scanned/calibration edge is stale — say so.
  const seenKeys = new Set(results.map((r) => r.edge));
  const staleDeclarations = Object.keys(DECLARED_EXPECTATIONS).filter((key) => !seenKeys.has(key));

  const wallMs = Date.now() - startedAt.getTime();
  return { startedAt, wallMs, scanned: kernels.length, declaredEdges: edges.length, results, surprises, staleDeclarations };
}

// ── Rendering ────────────────────────────────────────────────────────────────
export function renderReport(rep) {
  const L = [];
  L.push(`consumes-edge check — origin tree probe, ${rep.startedAt.toISOString()} (wall ${rep.wallMs} ms)`);
  L.push(`scanned ${rep.scanned} kernels · ${rep.declaredEdges} declared consumes: edge(s) · ${rep.results.length} edge measurement(s)`);
  L.push('');
  for (const r of rep.results) {
    const tag = r.undeclared ? ' [UNDECLARED-CONSUMER, calibration-only]' : '';
    L.push(`  ${r.verdict.padEnd(22)} ${r.edge}${tag}`);
    if (r.declared) L.push(`    declared: ${r.declared} — ${r.declaredOk ? 'matches observation' : `SURPRISE: ${r.surpriseNote}`}`);
    if (r.reason) L.push(`    why: ${r.reason}`);
    if (r.note) L.push(`    note: ${r.note}`);
    if (r.verdict === VERDICT.MISMATCH && r.entries) {
      for (const e of r.entries) {
        const fields = Object.entries(e.fields).filter(([, f]) => f.equal === false)
          .map(([name, f]) => `${name}: consumer ${f.consumer} vs supplier ${f.supplier}`);
        L.push(`    year ${e.year}: ${fields.join('; ')}`);
      }
    } else if (r.verdict === VERDICT.SUBSET_BY_YEAR) {
      L.push(`    consumer answers ${r.consumerYears} of ${r.supplierYears} supplier-published years; every overlap equal`);
    }
  }
  L.push('');
  if (rep.surprises.length === 0) L.push('SURPRISES: 0 — every observed verdict matches its declared expectation.');
  else {
    L.push(`SURPRISES: ${rep.surprises.length} — observed-vs-declared disagreement (SO #34c: a red nobody predicted, or a green nobody expected):`);
    for (const s of rep.surprises) L.push(`  ${s.edge}: ${s.surpriseNote}`);
  }
  if (rep.staleDeclarations.length) {
    L.push(`STALE DECLARATIONS: ${rep.staleDeclarations.join(', ')} — named in DECLARED_EXPECTATIONS but matching no measured edge.`);
  }
  L.push('REPORT-ONLY: exit 0 by design; blocking promotion is a separate decision with measured cost.');
  return L.join('\n');
}

// ── Self-test (mutation adequacy + controls) ─────────────────────────────────
export async function selfTest() {
  let failures = 0;
  const check = (label, cond) => {
    if (cond) console.log(`  ok   ${label}`);
    else { console.error(`  FAIL ${label}`); failures += 1; }
  };

  // GREEN control: the real art-234 edge must be byte-equal on 2025+2026 — so the
  // RED control's 2026 failure below is attributable to the mutation ALONE.
  const [c234, s220] = await Promise.all([loadKernel(k('art-234-test-hoepa-high-cost')), loadKernel(k('art-220-reg-z-threshold-lookup'))]);
  const real = classify(probeArt234(c234.compute, s220.compute), supplierArt234(s220.compute));
  const real2026 = real.entries.find((e) => e.year === 2026);
  check('GREEN control: real art-234 vs art-220, year 2026 entries all equal', real2026 && !real2026.differs);
  check('GREEN control: real art-234 edge classifies MISMATCH only via the declared fallback years (2021-2024)',
    real.verdict === VERDICT.MISMATCH && real.entries.every((e) => !e.differs || (e.year >= 2021 && e.year <= 2024)));

  // RED control: ONE perturbed pinned value (2026 floor 1380 → 1379) in a scratch
  // fixture → the comparator MUST fire, naming year 2026 + points_fees_floor.
  const { probe: perturbedProbe, meta } = await import('./consumes-edge-fixtures/art-234-hoepa-floor-perturbed.fixture.mjs');
  const pert = classify(perturbedProbe, supplierArt234(s220.compute));
  const p2026 = pert.entries.find((e) => e.year === 2026);
  const floorField = p2026?.fields.points_fees_floor;
  check(`RED control: perturbed fixture (${meta.perturbation}) fires MISMATCH`, pert.verdict === VERDICT.MISMATCH);
  check('RED control: the fired entry names year 2026, field points_fees_floor, consumer 1379 vs supplier 1380',
    floorField && floorField.equal === false && floorField.consumer === 1379 && floorField.supplier === 1380);
  check('RED control: unperturbed run has NO 2026 failure — the mutation alone caused it',
    !(real2026 && real2026.differs));

  // Scanner controls: payload + header declarations extracted; dedupe per supplier.
  const src = [
    "    consumes: 'art-220 (lookup_reg_z_thresholds) supplies the table (table: hoepa).',",
    '// CONSUMES: art-220 (lookup_reg_z_thresholds) for threshold table',
    "    consumes: 'no supplier named here',",
  ].join('\n');
  const scanned = scanSource('art-X', src);
  check('scanner: payload + header declarations both found, deduped to one art-220 edge', scanned.length === 1 && scanned[0].supplierArt === 220);

  // Classifier controls: SUBSET-BY-YEAR for a legal partial pin; UNVERIFIED for a missing adapter.
  const subset = classify({ 2026: { a: 1 } }, { 2025: { a: 1 }, 2026: { a: 1 } });
  check('classifier: fewer consumer years, overlaps equal → SUBSET-BY-YEAR', subset.verdict === VERDICT.SUBSET_BY_YEAR);
  const byteEq = classify({ 2025: { a: 1 }, 2026: { a: 1 } }, { 2025: { a: 1 }, 2026: { a: 1 } });
  check('classifier: full coverage, all equal → BYTE-EQUAL', byteEq.verdict === VERDICT.BYTE_EQUAL);
  const mismatch = classify({ 2026: { a: 2 } }, { 2026: { a: 1 } });
  check('classifier: any overlapping entry differing → MISMATCH', mismatch.verdict === VERDICT.MISMATCH && mismatch.diffs === 1);

  if (failures) { console.error(`\n${failures} control(s) FAILED`); process.exit(1); }
  console.log('\nall controls green');
}

// ── CLI ──────────────────────────────────────────────────────────────────────
// Only when THIS file is the entry point — importing the module (the .test.mjs
// pair, the preflight advisory entry) must not trigger a run.
const argv = process.argv.slice(2);
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (argv.includes('--self-test')) {
    await selfTest();
  } else {
  const rep = await runCheck();
  const text = renderReport(rep);
  console.log(text);
  if (argv.includes('--summary')) {
    const mismatches = rep.results.filter((r) => r.verdict === VERDICT.MISMATCH).length;
    console.log(`SUMMARY: ${rep.results.length} edge(s) · scanned ${rep.scanned} kernels · MISMATCH=${mismatches} · surprises=${rep.surprises.length} · wall=${rep.wallMs}ms · report-only`);
  }
  const jsonIdx = argv.indexOf('--json');
  if (jsonIdx !== -1 && argv[jsonIdx + 1]) {
    writeFileSync(argv[jsonIdx + 1], JSON.stringify(rep, null, 2));
    console.log(`json report written: ${argv[jsonIdx + 1]}`);
  }
  if (argv.includes('--strict')) {
    const bad = rep.results.filter((r) => r.verdict === VERDICT.MISMATCH || r.verdict === VERDICT.UNRESOLVED_SUPPLIER || r.surprise);
    if (bad.length) { console.error(`--strict: ${bad.length} red edge(s)`); process.exit(1); }
  }
  process.exit(0);
  }
}
