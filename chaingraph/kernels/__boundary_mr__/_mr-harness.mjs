// _mr-harness.mjs — METAMORPHIC BOUNDARY-DIRECTION harness (BOUNDARY-MR-PILOT-1).
//
// WHAT THIS IS. The __consistency__ pilot asserts cross-kernel VALUE agreement. This
// pilot asserts the tighter metamorphic relation at shared THRESHOLDS: when a supplier
// kernel publishes a threshold T and a consumer kernel applies it, the consumer's
// verdict must FLIP at T, and in the SAME DIRECTION the supplier's figure implies —
// not at T+drift, not in the opposite direction. A copied table can be value-equal at
// a glance yet apply `>` where the rule says `>=`, or apply last year's floor and flip
// dollars away from the published point. Value checks miss both; flip-point/direction
// checks catch both.
//
// THE RELATION. For every published threshold T, generate a systematic PAIR family:
//
//   T - eps   oracle: not fired   consumer must NOT have flipped
//   T         oracle: per spec    consumer verdict must sit exactly at the boundary
//   T + eps   oracle: fired       consumer must HAVE flipped, same direction
//
// The oracle verdict is derived (SO #34 independent derivation) from the SUPPLIER's
// published row via its own compute() — never from the consumer's internals. Where the
// supplier row does not state boundary inclusivity, the spec's comparator (from the
// kernel's own regulatory_basis, quoted in the family module) fixes the oracle side,
// and it is written out in the property's `statement`.
//
// ENGINE. Same decision as the __consistency__ pilot: exhaustive systematic enumeration
// over each property's declared finite input domain — no RNG, no property-testing
// dependency. Every expectation is DECLARED BEFORE RUNNING (SO #34c); an observed state
// that differs from its declaration in EITHER direction is a SURPRISE.
//
// This directory is a PILOT. It is deliberately NOT wired into preflight or CI.
// A relation FAILURE is a FINDING to report, never a fix applied here.

// ── Verdicts ────────────────────────────────────────────────────────────────
export const EXPECT = {
  HOLDS: 'HOLDS',         // we expect the boundary relation to hold
  VIOLATION: 'VIOLATION', // we expect it to be violated — a known/suspected defect
};

/**
 * Declare a family of boundary-direction relations over a set of kernels.
 * @param {{family:string, title:string, chain:string, kernels:string[],
 *          basis:string,
 *          properties:Array<{id:string, statement:string, expect:string,
 *                            run:(env:object)=>{cases:number, failures:Array<object>}}>}} def
 */
export function defineFamily(def) {
  for (const p of def.properties || []) {
    if (!p.id || !p.statement || !p.expect || typeof p.run !== 'function') {
      throw new Error(`family ${def.family}: malformed property ${p && p.id}`);
    }
    if (!Object.values(EXPECT).includes(p.expect)) {
      throw new Error(`family ${def.family}: property ${p.id} has unknown expect "${p.expect}"`);
    }
  }
  return def;
}

/** Two cents: above every kernel's half-cent rounding tolerance, small next to every threshold here. */
export const EPS_CENTS = 0.02;
/** Five thousandths of a percentage point, for pp-spread thresholds compared at 4dp. */
export const EPS_PP = 0.005;

/**
 * Accumulator handed to each property's run(). Records one checked case at a time so
 * the report can quote a real failing case, not a summary of one.
 */
export function checker() {
  const failures = [];
  let cases = 0;
  return {
    check(ok, caseDesc) {
      cases += 1;
      if (!ok) failures.push(caseDesc);
      return ok;
    },
    result() { return { cases, failures }; },
  };
}

/**
 * Check the three-point boundary-direction relation at one threshold.
 *
 * @param {object} c                      checker accumulator
 * @param {object} a                      probe identity (kernel, threshold name, year, ...)
 * @param {number} t                      the published threshold T
 * @param {number} eps                    epsilon
 * @param {(v:number)=>boolean} oracle    supplier-implied verdict: does the rule fire at value v?
 * @param {(v:number)=>boolean} consumer  the consumer kernel's verdict at value v
 */
export function boundaryTriples(c, a, t, eps, oracle, consumer) {
  const points = [
    { v: t - eps, tag: 'below' },
    { v: t, tag: 'at' },
    { v: t + eps, tag: 'above' },
  ];
  for (const p of points) {
    const want = oracle(p.v);
    const got = consumer(p.v);
    c.check(got === want, {
      relation: a.relation, threshold_name: a.threshold_name, year: a.year,
      published_threshold: t, probed_value: Number(p.v.toFixed(6)), point: p.tag,
      oracle_fires: want, consumer_fires: got,
      why: 'consumer verdict disagrees with the supplier-implied boundary direction at a published threshold',
    });
  }
}

// ── Runner ──────────────────────────────────────────────────────────────────
/**
 * Run every property in every family and return a structured report.
 * @param {Array<object>} families
 * @param {object} env  injected kernel computes (allows RED-control substitution)
 */
export function runFamilies(families, env = {}) {
  const rows = [];
  for (const fam of families) {
    for (const prop of fam.properties) {
      let cases = 0, failures = [], error = null;
      try {
        const r = prop.run(env);
        cases = r.cases;
        failures = r.failures;
      } catch (e) {
        error = e && e.stack ? e.stack : String(e);
      }
      const held = !error && failures.length === 0;
      const observed = error ? 'ERROR' : (held ? 'HOLDS' : 'VIOLATION');
      const verdict = error ? 'ERROR'
        : (observed === prop.expect ? 'AS-DECLARED' : 'SURPRISE');
      rows.push({
        family: fam.family, id: prop.id, statement: prop.statement,
        expect: prop.expect, observed, verdict, cases,
        failureCount: failures.length,
        failures: failures.slice(0, 5),
        error,
      });
    }
  }
  return rows;
}

export function formatReport(rows) {
  const lines = [];
  const pad = (s, n) => String(s).padEnd(n);
  lines.push('');
  lines.push(pad('RELATION', 40) + pad('CASES', 7) + pad('EXPECT', 11) + pad('OBSERVED', 11) + 'VERDICT');
  lines.push('-'.repeat(90));
  for (const r of rows) {
    lines.push(pad(r.id, 40) + pad(r.cases, 7) + pad(r.expect, 11) + pad(r.observed, 11) + r.verdict);
  }
  lines.push('');
  for (const r of rows) {
    if (r.error) {
      lines.push(`## ${r.id} — ERROR`);
      lines.push(r.error);
      lines.push('');
      continue;
    }
    if (r.failureCount === 0) continue;
    lines.push(`## ${r.id} — ${r.failureCount} violating case(s) of ${r.cases}`);
    lines.push(`   ${r.statement}`);
    for (const f of r.failures) lines.push('   - ' + JSON.stringify(f));
    if (r.failureCount > r.failures.length) {
      lines.push(`   ... ${r.failureCount - r.failures.length} more not quoted`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
