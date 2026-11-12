import { executionHash } from './_hash.mjs';

// art-814-qf-pairwise-recompute: recompute a funding round's matches from declared contributions.
//
// DETERMINISM: compute() is a pure function of pp. No clock, no randomness, no I/O. It uses only
// BigInt arithmetic and Array/Map/Object builtins, so it runs unmodified in the zkVM guest
// (no TextEncoder, atob, btoa or URL). Money is integer minor units. Every division is an
// integer floor division and every place a division happens is named in rounding_disclosure.
//
// COST BOUND: the loops are bounded by CAPS below, enforced before any arithmetic runs.

const TOOL_ID = 'art-814-qf-pairwise-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_quadratic_funding_round',
  mandate_type: 'compliance_control', gpu: false,
};

const CAPS = { contributions: 200, contributors: 40, projects: 20, amount: 1000000000000, pool: 1000000000000, m: 1000000000000 };
const MODES = ['plain', 'pairwise_bounded'];
const ALLOCATIONS = ['normalize_to_pool', 'cap_at_pool'];
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const NOTE = 'Reproduces the published formula on your data. It does not detect sybils. The result is within tolerance of a published round only when the round used the same inputs and the same rounding, never identical by construction.';

function refuse(error, detail) {
  return { output_payload: { ok: false, error, detail, note: NOTE }, compliance_flags: error ? ['REFUSED_' + error] : [] };
}

/** @param {bigint} n @returns {bigint} */
function isqrt(n) {
  if (n < 2n) return n;
  let x = 1n << BigInt((n.toString(2).length + 1) >> 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

function isNonNegInt(v) {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

/**
 * compute(pp) -- pure decision kernel.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const mode = pp.mode == null ? 'plain' : pp.mode;
  if (MODES.indexOf(mode) < 0) return refuse('BAD_MODE', 'mode must be plain or pairwise_bounded');
  const allocation = pp.allocation == null ? 'normalize_to_pool' : pp.allocation;
  if (ALLOCATIONS.indexOf(allocation) < 0) return refuse('BAD_ALLOCATION', 'allocation must be normalize_to_pool or cap_at_pool');
  const digits = pp.sqrt_scale_digits == null ? 6 : pp.sqrt_scale_digits;
  if (!isNonNegInt(digits) || digits > 9) return refuse('BAD_SCALE_DIGITS', 'sqrt_scale_digits must be an integer from 0 to 9');
  if (!isNonNegInt(pp.matching_pool) || pp.matching_pool > CAPS.pool) return refuse('BAD_POOL', 'matching_pool must be a non-negative integer of minor units up to ' + CAPS.pool);
  let mParam = 0;
  if (mode === 'pairwise_bounded') {
    if (!isNonNegInt(pp.pairwise_m) || pp.pairwise_m < 1 || pp.pairwise_m > CAPS.m) return refuse('BAD_M', 'pairwise_m must be an integer of minor units from 1 to ' + CAPS.m);
    mParam = pp.pairwise_m;
  }
  const rows = pp.contributions;
  if (!Array.isArray(rows) || rows.length === 0) return refuse('BAD_CONTRIBUTIONS', 'contributions must be a non-empty array');
  if (rows.length > CAPS.contributions) return refuse('TOO_MANY_CONTRIBUTIONS', 'at most ' + CAPS.contributions + ' contribution rows');

  // Aggregate repeated rows of the same contributor to the same project (the formula takes one
  // total per contributor and project).
  const byKey = {};
  const projSet = {};
  const conSet = {};
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || typeof row !== 'object') return refuse('BAD_CONTRIBUTION', 'row ' + r + ' is not an object');
    if (typeof row.project !== 'string' || !ID_RE.test(row.project)) return refuse('BAD_PROJECT_ID', 'row ' + r + ' project must match [A-Za-z0-9_-]{1,32}');
    if (typeof row.contributor !== 'string' || !ID_RE.test(row.contributor)) return refuse('BAD_CONTRIBUTOR_ID', 'row ' + r + ' contributor must be a pseudonymous label matching [A-Za-z0-9_-]{1,32}');
    if (!isNonNegInt(row.amount) || row.amount < 1 || row.amount > CAPS.amount) return refuse('BAD_AMOUNT', 'row ' + r + ' amount must be an integer of minor units from 1 to ' + CAPS.amount);
    const k = row.project + '\u0000' + row.contributor;
    byKey[k] = (byKey[k] || 0) + row.amount;
    if (!Number.isSafeInteger(byKey[k])) return refuse('BAD_AMOUNT', 'aggregate amount overflow');
    projSet[row.project] = true;
    conSet[row.contributor] = true;
  }
  const projects = Object.keys(projSet).sort();
  const contributors = Object.keys(conSet).sort();
  if (projects.length > CAPS.projects) return refuse('TOO_MANY_PROJECTS', 'at most ' + CAPS.projects + ' projects');
  if (contributors.length > CAPS.contributors) return refuse('TOO_MANY_CONTRIBUTORS', 'at most ' + CAPS.contributors + ' contributors');

  const S = 10n ** BigInt(digits);
  const S2 = S * S;
  // v[p][c]: floor(sqrt(amount) * S) as a BigInt, or 0n when the contributor gave nothing.
  /** @type {bigint[][]} */
  const v = [];
  /** @type {number[][]} */
  const raw = [];
  let exactSquares = true;
  for (let p = 0; p < projects.length; p++) {
    /** @type {bigint[]} */
    const vp = [];
    /** @type {number[]} */
    const rp = [];
    for (let c = 0; c < contributors.length; c++) {
      const amt = byKey[projects[p] + '\u0000' + contributors[c]] || 0;
      rp.push(amt);
      const a = BigInt(amt);
      const root = isqrt(a);
      if (root * root !== a) exactSquares = false;
      vp.push(amt === 0 ? 0n : isqrt(a * S2));
    }
    v.push(vp);
    raw.push(rp);
  }

  // Scaled subsidy per project (units of minor units times S^2).
  /** @type {bigint[]} */
  const sub = [];
  for (let p = 0; p < projects.length; p++) {
    let sum = 0n;
    let sumSq = 0n;
    for (let c = 0; c < contributors.length; c++) { sum += v[p][c]; sumSq += v[p][c] * v[p][c]; }
    sub.push(mode === 'plain' ? sum * sum - sumSq : 0n);
  }
  let pairsCoupled = 0;
  if (mode === 'pairwise_bounded') {
    const MS2 = BigInt(mParam) * S2;
    for (let i = 0; i < contributors.length; i++) {
      for (let j = i + 1; j < contributors.length; j++) {
        let t = 0n;
        let shared = 0;
        for (let p = 0; p < projects.length; p++) {
          if (v[p][i] > 0n && v[p][j] > 0n) { t += v[p][i] * v[p][j]; shared++; }
        }
        if (shared === 0) continue;
        pairsCoupled++;
        const den = MS2 + t;
        for (let p = 0; p < projects.length; p++) {
          if (v[p][i] > 0n && v[p][j] > 0n) sub[p] += 2n * ((MS2 * v[p][i] * v[p][j]) / den);
        }
      }
    }
  }

  // Allocation against the pool.
  const pool = BigInt(pp.matching_pool);
  let total = 0n;
  for (let p = 0; p < sub.length; p++) total += sub[p];
  /** @type {bigint[]} */
  const match = [];
  let scaledDown = false;
  let remainderUnits = 0;
  const flags = [];
  if (total === 0n) {
    for (let p = 0; p < sub.length; p++) match.push(0n);
    flags.push('NO_SUBSIDY_COMPUTED');
  } else if (allocation === 'cap_at_pool' && total <= pool * S2) {
    for (let p = 0; p < sub.length; p++) match.push(sub[p] / S2);
  } else {
    scaledDown = allocation === 'cap_at_pool';
    /** @type {bigint[]} */
    const rem = [];
    let base = 0n;
    for (let p = 0; p < sub.length; p++) {
      const num = pool * sub[p];
      match.push(num / total);
      rem.push(num % total);
      base += match[p];
    }
    let left = Number(pool - base);
    remainderUnits = left;
    // Largest remainder first; equal remainders go to the project id that sorts first.
    const order = [];
    for (let p = 0; p < sub.length; p++) order.push(p);
    order.sort(function (a, b) { return rem[a] > rem[b] ? -1 : rem[a] < rem[b] ? 1 : a - b; });
    for (let k = 0; k < order.length && left > 0; k++, left--) match[order[k]] += 1n;
    if (scaledDown) flags.push('SUBSIDY_SCALED_DOWN_TO_POOL');
  }
  let allocated = 0n;
  for (let p = 0; p < match.length; p++) allocated += match[p];

  const perProject = [];
  for (let p = 0; p < projects.length; p++) {
    let n = 0;
    let tot = 0;
    for (let c = 0; c < contributors.length; c++) if (raw[p][c] > 0) { n++; tot += raw[p][c]; }
    if (n === 1) flags.push('SINGLE_CONTRIBUTOR_PROJECT_' + projects[p]);
    const entry = {
      project: projects[p],
      contributor_count: n,
      total_contributed: tot,
      raw_subsidy_scaled: sub[p].toString(),
      match: Number(match[p]),
    };
    if (mode === 'plain' && exactSquares) {
      // Closed form: (sum of square roots)^2 minus the sum of contributions, scaled by S^2.
      let sr = 0n;
      for (let c = 0; c < contributors.length; c++) sr += isqrt(BigInt(raw[p][c]));
      const closed = (sr * sr - BigInt(tot)) * S2;
      entry.closed_form_subsidy_scaled = closed.toString();
      entry.matches_closed_form = closed === sub[p];
    }
    perProject.push(entry);
  }
  if (mode === 'plain' && exactSquares) flags.push('CLOSED_FORM_IDENTITY_CHECKED');

  const undistributed = pool - allocated;
  const out = {
    ok: true,
    mode,
    allocation,
    matching_pool: pp.matching_pool,
    projects: perProject,
    sum_check: {
      matching_pool: pp.matching_pool,
      allocated: Number(allocated),
      undistributed: Number(undistributed),
      allocated_equals_pool: allocated === pool,
      allocated_within_pool: allocated <= pool,
    },
    rounding_disclosure: {
      sqrt: 'each square root is floor(sqrt(amount) * 10^' + digits + ') by exact integer square root; the result is a lower bound with error below 10^-' + digits + ' per root',
      scale_digits: digits,
      pair_terms: mode === 'pairwise_bounded' ? 'each coefficient-weighted term is floored once per contributor pair and project, then doubled for the ordered pair' : 'not applicable in plain mode',
      allocation: allocation === 'cap_at_pool' && !scaledDown && total > 0n ? 'raw subsidy floored to whole minor units; the unspent remainder is reported as undistributed' : 'pool share floored per project, then the leftover minor units go one each to the largest remainders (ties to the project id that sorts first)',
      leftover_units_distributed: remainderUnits,
      tolerance_label: 'within tolerance',
    },
    inputs_summary: {
      contribution_rows: rows.length,
      contributors: contributors.length,
      projects: projects.length,
      coupled_contributor_pairs: pairsCoupled,
      pairwise_m: mode === 'pairwise_bounded' ? mParam : null,
      caps: { contributions: CAPS.contributions, contributors: CAPS.contributors, projects: CAPS.projects },
    },
    warnings: flags,
    note: NOTE,
  };
  return { output_payload: out, compliance_flags: flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
