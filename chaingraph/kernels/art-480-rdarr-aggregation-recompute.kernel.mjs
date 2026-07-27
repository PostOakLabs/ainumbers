// art-480 — RDARR Aggregation Recompute: pure decision kernel.
//
// RDARR-K-1, first entry of the BCBS 239 / RDARR family (BCBS239-RDARR-BUILD-SPEC.md).
// Re-derives a stated risk-report figure from a SUPPLIED source extract under a
// DECLARED aggregation policy (filter set, netting rule, FX rate set, hierarchy
// roll-up). Returns the recomputed figure, a signed delta vs the reported figure,
// and a per-roll-up-node contribution breakdown so a break localises to one node
// instead of the whole report.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): every FX rate is
// SUPPLIED by the caller and merely ASSERTED — this kernel performs zero
// market-data lookups (zero-egress by contract). It recomputes the ARITHMETIC over
// declared extract lines and a declared aggregation policy, and attests THAT
// computation ran correctly. This is NEVER an opinion on whether the extract or
// the reported figure is correct, NEVER a data-quality assessment (that is
// art-481's job), and NEVER a materiality judgement — a delta is reported exactly
// as computed, with no pass/fail label attached.
//
// Fixed-point design: every amount is parsed from its DECIMAL STRING
// REPRESENTATION (never via floating multiplication) into a BigInt scaled by
// 10^SCALE_EXP. All arithmetic happens in that BigInt domain; only rendered
// strings are truncated to display precision. No new canonicalisation is
// introduced — hashing goes through the shared `_hash.mjs` executionHash as usual.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-480-rdarr-aggregation-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'rdarr_aggregation_recompute',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

// ── fixed-point money math (BigInt, no floats) ──────────────────────────────
const SCALE_EXP = 8;
const SCALE = 10n ** BigInt(SCALE_EXP);

function toFixed(value) {
  let s = String(value ?? 0).trim();
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  else if (s.startsWith('+')) { s = s.slice(1); }
  if (!/^[0-9]*\.?[0-9]*$/.test(s) || s === '' || s === '.') s = '0';
  let [intPart, fracPart = ''] = s.split('.');
  if (intPart === '') intPart = '0';
  if (fracPart.length > SCALE_EXP) fracPart = fracPart.slice(0, SCALE_EXP);
  fracPart = fracPart.padEnd(SCALE_EXP, '0');
  let mag = BigInt(intPart + fracPart);
  if (neg) mag = -mag;
  return mag;
}

function mulFixed(a, b) {
  return (a * b) / SCALE;
}

function divFixed(a, b) {
  if (b === 0n) return 0n;
  return (a * SCALE) / b;
}

function roundFixedToString(value, places, mode) {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const divisor = 10n ** BigInt(SCALE_EXP - places);
  let q = abs / divisor;
  const r = abs % divisor;
  const twiceR = r * 2n;
  if (mode === 'truncate') {
    // q already truncated toward zero
  } else if (mode === 'half_even') {
    if (twiceR > divisor || (twiceR === divisor && q % 2n === 1n)) q += 1n;
  } else {
    if (twiceR >= divisor) q += 1n; // half_up (default)
  }
  let qs = q.toString();
  let result;
  if (places === 0) {
    result = qs;
  } else {
    qs = qs.padStart(places + 1, '0');
    result = `${qs.slice(0, -places)}.${qs.slice(-places)}`;
  }
  return (neg && q !== 0n) ? `-${result}` : result;
}

function toBase(amountFixed, fxRateToBase) {
  return mulFixed(amountFixed, toFixed(fxRateToBase ?? 1));
}

const NOT_PROVEN = [
  { item: 'Extract accuracy', detail: 'Every extract line and FX rate is caller-supplied and asserted. This kernel performs no market-data or source-system lookups (zero-egress) and does not verify these values against any external source.' },
  { item: 'Reported-figure correctness', detail: 'The reported figure is a caller-supplied comparison point, not validated independently. A signed delta is reported exactly as computed, with no correctness or materiality judgement attached.' },
  { item: 'Data quality', detail: 'This kernel performs arithmetic recomputation only. Completeness, referential integrity, timeliness, reconciliation coverage, and manual-adjustment ratio are scored separately by art-481-rdarr-quality-scorecard.' },
  { item: 'Materiality', detail: 'Whether a computed delta is material is a policy/governance judgement outside this kernel\'s scope — it is never emitted as a kernel output.' },
];

/**
 * compute(pp) — pure aggregation-recompute kernel.
 * pp: {
 *   base_currency: string,
 *   reported_figure: number|string,
 *   aggregation_policy: {
 *     exclude_flagged?: boolean,       // drop extract lines with include === false
 *     netting?: { enabled: boolean, by?: 'counterparty' },
 *     rounding?: { decimal_places?: number, mode?: 'half_up'|'half_even'|'truncate' },
 *   },
 *   hierarchy: [ { node_id: string, parent_node_id: string|null, label?: string } ],   // root has parent_node_id: null
 *   extract: [ {
 *     line_id: string, node_id: string, counterparty?: string,
 *     amount: number|string, currency?: string, fx_rate_to_base?: number|string,
 *     include?: boolean,
 *   } ],
 * }
 */
export function compute(pp) {
  const baseCurrency = pp.base_currency ?? 'USD';
  const policy = pp.aggregation_policy ?? {};
  const excludeFlagged = policy.exclude_flagged !== false; // default true
  const nettingEnabled = policy.netting?.enabled === true;
  const nettingBy = policy.netting?.by ?? 'counterparty';
  const rounding = policy.rounding ?? {};
  const decimalPlaces = Number.isInteger(rounding.decimal_places) ? rounding.decimal_places : 2;
  const roundingMode = ['half_up', 'half_even', 'truncate'].includes(rounding.mode) ? rounding.mode : 'half_up';

  const hierarchy = Array.isArray(pp.hierarchy) ? pp.hierarchy : [];
  const extract = Array.isArray(pp.extract) ? pp.extract : [];

  const nodeById = new Map(hierarchy.map((n) => [n.node_id, n]));

  // 1. Filter.
  const includedLines = extract.filter((l) => !(excludeFlagged && l.include === false));
  const excludedCount = extract.length - includedLines.length;

  // 2. FX-convert each included line to base currency (fixed-point).
  const converted = includedLines.map((l) => {
    const amountFixed = toFixed(l.amount);
    const baseValueFixed = toBase(amountFixed, l.fx_rate_to_base);
    return {
      line_id: l.line_id ?? null,
      node_id: l.node_id ?? null,
      counterparty: l.counterparty ?? null,
      currency: l.currency ?? baseCurrency,
      base_value_fixed: baseValueFixed,
    };
  });

  // 3. Netting: group by (node_id[, counterparty]) and sum — offsetting signed
  //    amounts within the same netting set collapse to one net figure per set.
  let nettedLines = converted;
  const nettingSets = [];
  if (nettingEnabled) {
    const groups = new Map();
    for (const c of converted) {
      const key = nettingBy === 'counterparty' ? `${c.node_id}::${c.counterparty ?? ''}` : c.node_id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    nettedLines = [];
    for (const [key, lines] of groups) {
      const netFixed = lines.reduce((acc, l) => acc + l.base_value_fixed, 0n);
      const grossFixed = lines.reduce((acc, l) => acc + (l.base_value_fixed < 0n ? -l.base_value_fixed : l.base_value_fixed), 0n);
      nettingSets.push({
        netting_key: key,
        line_count: lines.length,
        gross_value: roundFixedToString(grossFixed, decimalPlaces, roundingMode),
        net_value: roundFixedToString(netFixed, decimalPlaces, roundingMode),
      });
      nettedLines.push({ node_id: lines[0].node_id, base_value_fixed: netFixed });
    }
  }

  // 4. Hierarchy roll-up: sum netted lines at each leaf node, then roll up
  //    through parent_node_id to the root. A line whose node_id has no
  //    hierarchy entry rolls up to an implicit 'UNMAPPED' node (surfaced, not
  //    silently dropped).
  const leafTotals = new Map();
  for (const l of nettedLines) {
    const nodeId = nodeById.has(l.node_id) ? l.node_id : 'UNMAPPED';
    leafTotals.set(nodeId, (leafTotals.get(nodeId) ?? 0n) + l.base_value_fixed);
  }

  const allNodeIds = new Set([...hierarchy.map((n) => n.node_id), ...leafTotals.keys()]);
  const rollup = new Map(); // node_id -> fixed total (own leaf lines + all descendants)
  for (const id of allNodeIds) rollup.set(id, leafTotals.get(id) ?? 0n);

  function parentOf(nodeId) {
    return nodeById.get(nodeId)?.parent_node_id ?? null;
  }

  // Propagate each node's leaf total up through its parent chain. UNMAPPED has
  // no parent (it is not part of the declared hierarchy) and stays at root level.
  for (const id of allNodeIds) {
    if (id === 'UNMAPPED') continue;
    const own = leafTotals.get(id) ?? 0n;
    if (own === 0n) continue;
    let p = parentOf(id);
    const seen = new Set([id]);
    while (p && nodeById.has(p) && !seen.has(p)) {
      rollup.set(p, (rollup.get(p) ?? 0n) + own);
      seen.add(p);
      p = parentOf(p);
    }
  }

  const roots = hierarchy.filter((n) => n.parent_node_id == null).map((n) => n.node_id);
  const recomputedFixed = roots.reduce((acc, id) => acc + (rollup.get(id) ?? 0n), 0n) + (leafTotals.get('UNMAPPED') ?? 0n);

  const reportedFixed = toFixed(pp.reported_figure);
  const deltaFixed = recomputedFixed - reportedFixed;
  const deltaPctStr = reportedFixed !== 0n
    ? roundFixedToString(divFixed(mulFixed(deltaFixed, toFixed(100)), reportedFixed), decimalPlaces, roundingMode)
    : null;

  // 5. Per-level contribution breakdown, sorted by |contribution| descending so
  //    the largest driver of any break is first.
  const contributionBreakdown = [...allNodeIds]
    .filter((id) => id !== 'UNMAPPED' || (leafTotals.get('UNMAPPED') ?? 0n) !== 0n)
    .map((id) => {
      const node = nodeById.get(id);
      const valueFixed = rollup.get(id) ?? 0n;
      const contributionPct = recomputedFixed !== 0n
        ? roundFixedToString(divFixed(mulFixed(valueFixed, toFixed(100)), recomputedFixed), decimalPlaces, roundingMode)
        : '0.00';
      return {
        node_id: id,
        parent_node_id: node?.parent_node_id ?? null,
        label: node?.label ?? (id === 'UNMAPPED' ? 'Lines with no hierarchy mapping' : null),
        _abs: valueFixed < 0n ? -valueFixed : valueFixed,
        value: roundFixedToString(valueFixed, decimalPlaces, roundingMode),
        contribution_pct: contributionPct,
      };
    })
    .sort((a, b) => (a._abs > b._abs ? -1 : a._abs < b._abs ? 1 : 0))
    .map(({ _abs, ...rest }) => rest);

  const compliance_flags = ['RDARR_AGGREGATION_RECOMPUTED'];
  if (excludedCount > 0) compliance_flags.push('RDARR_LINES_EXCLUDED_BY_FILTER');
  if (leafTotals.has('UNMAPPED') && leafTotals.get('UNMAPPED') !== 0n) compliance_flags.push('RDARR_UNMAPPED_LINES_PRESENT');
  if (deltaFixed !== 0n) compliance_flags.push('RDARR_DELTA_NONZERO');
  else compliance_flags.push('RDARR_DELTA_ZERO');

  const output_payload = {
    base_currency: baseCurrency,
    reported_figure: roundFixedToString(reportedFixed, decimalPlaces, roundingMode),
    recomputed_figure: roundFixedToString(recomputedFixed, decimalPlaces, roundingMode),
    delta: roundFixedToString(deltaFixed, decimalPlaces, roundingMode),
    delta_pct: deltaPctStr,
    lines_included: includedLines.length,
    lines_excluded: excludedCount,
    netting_applied: nettingEnabled,
    netting_sets: nettingSets,
    contribution_breakdown: contributionBreakdown,
    rounding: { decimal_places: decimalPlaces, mode: roundingMode },
    not_proven: NOT_PROVEN,
    fence: 'FX rates and extract lines are SUPPLIED, asserted, and digested into this receipt. This kernel recomputes the ARITHMETIC over those declared inputs under the declared aggregation policy and attests THAT — never an opinion on extract or reported-figure correctness, never a data-quality assessment (see art-481), never a materiality judgement (zero-egress by contract).',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
