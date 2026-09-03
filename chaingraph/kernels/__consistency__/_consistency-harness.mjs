// _consistency-harness.mjs — CROSS-KERNEL CONSISTENCY property harness (pilot).
//
// WHAT THIS IS. Classical L3 end-to-end pipeline properties do not apply to OCG chains:
// a chain is a provenance-linked bundle of independently parameterized kernels, and each
// step's inputs come from the CALLER, never from the prior step's output. So there is no
// pipeline to assert over. The honest L3-adjacent property class is CROSS-KERNEL
// CONSISTENCY: two or more kernels that implement facets of the SAME rule, fed the SAME
// policy inputs, must produce mutually consistent verdicts.
//
// Properties here assert RELATIONSHIPS between kernels, never golden values. A golden
// value is what the per-kernel fixture suites already cover; a relationship is what
// nothing covered before, and it is exactly what the estate's measured defect class
// (consistent-but-wrong shared tables, silent fallback in a copied table, divergent
// treatment of a degenerate input domain) actually violates.
//
// ENGINE. Exhaustive systematic enumeration over each property's declared finite input
// domain — no RNG, no shrinking, no property-testing dependency. See README.md
// "Engine decision" for why this, and not fast-check.
//
// This directory is a PILOT. It is deliberately NOT wired into preflight or CI.
// A property FAILURE is a FINDING to report, never a fix applied here.

// ── Verdicts ────────────────────────────────────────────────────────────────
// A property declares what it expects BEFORE it runs, so a red result is
// distinguishable from a red result nobody predicted (SO #34c: absence is not a pass,
// and a gate only ever observed green has not been observed at all).
export const EXPECT = {
  HOLDS: 'HOLDS',            // we expect the relationship to hold
  VIOLATION: 'VIOLATION',    // we expect it to be violated — a known/suspected defect
};

/**
 * Declare a family of consistency properties over a set of kernels.
 * @param {{family:string, title:string, chains:string[], kernels:string[],
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

// ── Comparison helpers ──────────────────────────────────────────────────────
// Money/percentage comparison at an explicit tolerance. Kernels round to 2dp or 4dp;
// a consistency property must not fail on a representation difference, only on a
// substantive one.
export function near(a, b, tol = 0.005) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tol;
}

export function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN; }

/**
 * Accumulator handed to each property's run(). Records one checked case at a time so
 * the report can quote a real failing case, not a summary of one.
 */
export function checker() {
  const failures = [];
  let cases = 0;
  return {
    /** @param {boolean} ok @param {object} caseDesc */
    check(ok, caseDesc) {
      cases += 1;
      if (!ok) failures.push(caseDesc);
      return ok;
    },
    result() { return { cases, failures }; },
  };
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
      // OBSERVED is what the harness measured. VERDICT compares it to what the
      // property declared it expected, so a surprise in EITHER direction is loud.
      const observed = error ? 'ERROR' : (held ? 'HOLDS' : 'VIOLATION');
      const verdict = error ? 'ERROR'
        : (observed === prop.expect ? 'AS-DECLARED' : 'SURPRISE');
      rows.push({
        family: fam.family, id: prop.id, statement: prop.statement,
        expect: prop.expect, observed, verdict, cases,
        failureCount: failures.length,
        failures: failures.slice(0, 5), // quote up to 5 concrete failing cases
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
  lines.push(pad('PROPERTY', 34) + pad('CASES', 7) + pad('EXPECT', 11) + pad('OBSERVED', 11) + 'VERDICT');
  lines.push('-'.repeat(84));
  for (const r of rows) {
    lines.push(pad(r.id, 34) + pad(r.cases, 7) + pad(r.expect, 11) + pad(r.observed, 11) + r.verdict);
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
