import { executionHash } from './_hash.mjs';

// 792-curator-vault-cap-auditor — audit a vault curator's allocation snapshot against
// per-market caps and a declared mandate.
//
// Primary text (SO #38), pinned 2026-10-30 — research/CURATOR-VAULT-CAP-PIN-2026-10-30.md,
// snapshots + sha256 under research/clause-snapshots/curator-vault-caps/:
//   Morpho docs, "Liquidity curation" concepts page (pinned edition):
//     - Absolute Cap: "A fixed maximum amount of assets" per id/market.
//     - Relative Cap: "A maximum percentage of the vault's total assets that an
//       allocation can reach".
//     - Caps constrain allocation operations, not a continuously enforced ceiling;
//       exposure can legitimately end up above a cap (withdrawals shrink the total,
//       interest grows positions) — so this node AUDITS a point-in-time snapshot and
//       reports observed breaches.
//     - "relative caps are measured against the vault's total assets at the start of
//       the transaction" — here: the snapshot's total_assets_minor.
//   The Morpho Vault V2 contracts are GPL-2.0: ONLY the documentation was read. No code
//   was copied. Rules only the code states (exact on-chain rounding, id-granularity
//   encoding) are shipped caller-declared / excluded.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no
// network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest.

const TOOL_ID = '792-curator-vault-cap-auditor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'audit_curator_vault_caps',
  mandate_type: 'compliance_control', gpu: false,
};

const SCOPE_NOTE =
  'Values-only audit of a declared curator allocation snapshot against per-market caps ' +
  '(absolute + relative) and a caller-declared mandate. No on-chain reads, no pricing: ' +
  'share pricing is the art-610 (ERC-4626 share math) domain and async redemption state ' +
  'is the art-611 (ERC-7540 request accounting) domain — this node consumes declared ' +
  'minor-unit values only. Asset classes are a fixed declared enum. No curator or ' +
  'platform is named by this node.';

const ASSET_CLASSES = ['rwa_treasury', 'rwa_credit', 'defi_lending', 'other'];
const PROFILES = ['morpho_vault_v2', 'generic'];

// One documented rounding rule: NO division anywhere. Relative comparisons use exact
// integer cross-multiplication in the minor-unit-by-10000 domain
// (allocated_minor * 10000  vs  cap_bp * total_assets_minor), so there is no rounding
// step at all; shares are reported in integer basis points floored.
function floorBp(numerator, denominator) {
  if (denominator <= 0n) return 0;
  return Number((numerator * 10000n) / denominator);
}

function isInt(v) {
  return typeof v === 'number' && Number.isSafeInteger(v);
}

function malformed(reasons) {
  return {
    output_payload: {
      profile: null,
      conservation: null,
      cap_breaches: [],
      mandate_breaches: [],
      concentration: null,
      coverage: null,
      verdict: 'INDETERMINATE',
      scope_note: SCOPE_NOTE,
      reasons,
    },
    compliance_flags: ['CURATOR_VAULT_CAPS_INDETERMINATE', 'CURATOR_VAULT_CAPS_MALFORMED_INPUT'],
  };
}

/**
 * compute(pp) — pure decision kernel.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const reasons = [];
  const profile = pp.profile;
  if (!PROFILES.includes(profile)) {
    reasons.push(`profile must be one of ${PROFILES.join(' | ')} (got ${JSON.stringify(profile) ?? 'undefined'}); generic carries caller-declared cap semantics`);
  }
  const snap = pp.snapshot || {};
  const total = snap.total_assets_minor;
  const idle = snap.idle_minor;
  if (!isInt(total) || total < 0) reasons.push('snapshot.total_assets_minor must be a non-negative safe integer');
  if (!isInt(idle) || idle < 0) reasons.push('snapshot.idle_minor must be a non-negative safe integer');
  if (!Array.isArray(snap.markets) || snap.markets.length === 0) {
    reasons.push('snapshot.markets must be a non-empty array of declared market rows');
  } else {
    snap.markets.forEach((m, i) => {
      const at = `snapshot.markets[${i}]`;
      if (!m || typeof m.market_label !== 'string' || m.market_label.length === 0 || m.market_label.length > 120) {
        reasons.push(`${at}.market_label must be a declared label string of 1-120 characters`);
      }
      if (!ASSET_CLASSES.includes(m.asset_class)) {
        reasons.push(`${at}.asset_class must be one of ${ASSET_CLASSES.join(' | ')}`);
      }
      if (!isInt(m.allocated_minor) || m.allocated_minor < 0) reasons.push(`${at}.allocated_minor must be a non-negative safe integer`);
      if (m.abs_cap_minor !== undefined && (!isInt(m.abs_cap_minor) || m.abs_cap_minor < 0)) reasons.push(`${at}.abs_cap_minor must be a non-negative safe integer when declared`);
      if (m.rel_cap_bp !== undefined && (!isInt(m.rel_cap_bp) || m.rel_cap_bp < 0 || m.rel_cap_bp > 1000000)) reasons.push(`${at}.rel_cap_bp must be an integer in [0, 1000000] when declared`);
      if (m.withdrawable_minor !== undefined && (!isInt(m.withdrawable_minor) || m.withdrawable_minor < 0)) reasons.push(`${at}.withdrawable_minor must be a non-negative safe integer when declared`);
    });
  }
  const man = pp.mandate || {};
  if (!isInt(man.max_per_market_bp) || man.max_per_market_bp < 0 || man.max_per_market_bp > 1000000) reasons.push('mandate.max_per_market_bp must be an integer in [0, 1000000]');
  const classCaps = man.max_per_asset_class_bp || {};
  for (const k of Object.keys(classCaps)) {
    if (!ASSET_CLASSES.includes(k)) reasons.push(`mandate.max_per_asset_class_bp key "${k}" is outside the declared asset_class enum`);
    else if (!isInt(classCaps[k]) || classCaps[k] < 0 || classCaps[k] > 1000000) reasons.push(`mandate.max_per_asset_class_bp.${k} must be an integer in [0, 1000000]`);
  }
  if (!isInt(man.min_idle_bp) || man.min_idle_bp < 0 || man.min_idle_bp > 1000000) reasons.push('mandate.min_idle_bp must be an integer in [0, 1000000]');
  if (man.min_rwa_bp !== undefined && (!isInt(man.min_rwa_bp) || man.min_rwa_bp < 0 || man.min_rwa_bp > 1000000)) reasons.push('mandate.min_rwa_bp must be an integer in [0, 1000000] when declared');
  if (man.max_defi_bp !== undefined && (!isInt(man.max_defi_bp) || man.max_defi_bp < 0 || man.max_defi_bp > 1000000)) reasons.push('mandate.max_defi_bp must be an integer in [0, 1000000] when declared');
  let red = null;
  if (pp.redemptions !== undefined && pp.redemptions !== null) {
    red = pp.redemptions;
    if (!red || !isInt(red.pending_minor) || red.pending_minor < 0) reasons.push('redemptions.pending_minor must be a non-negative safe integer');
    if (!red || !isInt(red.horizon_hours) || red.horizon_hours < 0) reasons.push('redemptions.horizon_hours must be a non-negative safe integer');
  }
  if (reasons.length > 0) return malformed(reasons);

  // ── conservation first: idle + allocations vs declared total ────────────────────────
  const markets = snap.markets;
  let allocatedSum = 0n;
  for (const m of markets) allocatedSum += BigInt(m.allocated_minor);
  const idleBig = BigInt(idle);
  const totalBig = BigInt(total);
  const idlePlusAlloc = idleBig + allocatedSum;
  const conservationDelta = totalBig - idlePlusAlloc; // >0 shortfall, <0 excess
  const conserved = conservationDelta === 0n;

  // ── cap breaches (Morpho pinned semantics: absolute = fixed max amount; relative =
  //    max share of total assets, cross-multiplied, no division) ──────────────────────
  const cap_breaches = [];
  for (const m of markets) {
    if (m.abs_cap_minor !== undefined && BigInt(m.allocated_minor) > BigInt(m.abs_cap_minor)) {
      cap_breaches.push({
        market_label: m.market_label,
        kind: 'absolute',
        allocated_minor: m.allocated_minor,
        cap_minor: m.abs_cap_minor,
        excess_minor: Number(BigInt(m.allocated_minor) - BigInt(m.abs_cap_minor)),
      });
    }
    if (m.rel_cap_bp !== undefined && BigInt(m.allocated_minor) * 10000n > BigInt(m.rel_cap_bp) * totalBig) {
      cap_breaches.push({
        market_label: m.market_label,
        kind: 'relative',
        allocated_minor: m.allocated_minor,
        cap_bp: m.rel_cap_bp,
        observed_bp: floorBp(BigInt(m.allocated_minor), totalBig),
      });
    }
  }

  // ── mandate breaches ─────────────────────────────────────────────────────────────────
  const mandate_breaches = [];
  for (const m of markets) {
    if (BigInt(m.allocated_minor) * 10000n > BigInt(man.max_per_market_bp) * totalBig) {
      mandate_breaches.push({
        scope: 'market',
        label: m.market_label,
        limit_bp: man.max_per_market_bp,
        observed_bp: floorBp(BigInt(m.allocated_minor), totalBig),
      });
    }
  }
  const classSum = {};
  for (const c of ASSET_CLASSES) classSum[c] = 0n;
  for (const m of markets) classSum[m.asset_class] += BigInt(m.allocated_minor);
  for (const c of ASSET_CLASSES) {
    if (classCaps[c] !== undefined && classSum[c] * 10000n > BigInt(classCaps[c]) * totalBig) {
      mandate_breaches.push({
        scope: 'asset_class',
        label: c,
        limit_bp: classCaps[c],
        observed_bp: floorBp(classSum[c], totalBig),
      });
    }
  }
  // idle: mandate floor on unallocated liquidity
  if (idleBig * 10000n < BigInt(man.min_idle_bp) * totalBig) {
    mandate_breaches.push({
      scope: 'idle',
      label: 'idle_minor',
      limit_bp: man.min_idle_bp,
      observed_bp: floorBp(idleBig, totalBig),
      direction: 'below_min',
    });
  }
  // split limits: minimum RWA share, maximum DeFi share
  const rwaSum = classSum.rwa_treasury + classSum.rwa_credit;
  if (man.min_rwa_bp !== undefined && rwaSum * 10000n < BigInt(man.min_rwa_bp) * totalBig) {
    mandate_breaches.push({
      scope: 'asset_class',
      label: 'rwa_treasury+rwa_credit',
      limit_bp: man.min_rwa_bp,
      observed_bp: floorBp(rwaSum, totalBig),
      direction: 'below_min',
    });
  }
  if (man.max_defi_bp !== undefined && classSum.defi_lending * 10000n > BigInt(man.max_defi_bp) * totalBig) {
    mandate_breaches.push({
      scope: 'asset_class',
      label: 'defi_lending',
      limit_bp: man.max_defi_bp,
      observed_bp: floorBp(classSum.defi_lending, totalBig),
      direction: 'above_max',
    });
  }

  // ── concentration: largest market share and Herfindahl index, basis points ──────────
  let largest = null;
  let herfindahl = 0;
  for (const m of markets) {
    const shareBp = floorBp(BigInt(m.allocated_minor), totalBig);
    herfindahl += shareBp * shareBp; // sum of squared bp shares, integer
    if (!largest || shareBp > largest.share_bp) largest = { market_label: m.market_label, share_bp: shareBp };
  }

  // ── redemption coverage: idle + withdrawable vs pending (declared values only) ──────
  let coverage = null;
  if (red) {
    let withdrawable = 0n;
    for (const m of markets) if (m.withdrawable_minor !== undefined) withdrawable += BigInt(m.withdrawable_minor);
    const available = idleBig + withdrawable;
    const pending = BigInt(red.pending_minor);
    coverage = {
      horizon_hours: red.horizon_hours,
      pending_minor: red.pending_minor,
      available_minor: Number(available),
      available_is_floor: markets.some((m) => m.withdrawable_minor === undefined),
      shortfall_minor: available >= pending ? 0 : Number(pending - available),
      covered: available >= pending,
    };
  }

  // ── verdict ─────────────────────────────────────────────────────────────────────────
  let verdict;
  if (!conserved) verdict = 'BREACH';
  else if (cap_breaches.length > 0 || mandate_breaches.length > 0) verdict = 'BREACH';
  else if (coverage && !coverage.covered) verdict = 'BREACH';
  else if (coverage && coverage.available_is_floor) verdict = 'WITHIN_MANDATE_WITH_WARNINGS';
  else verdict = 'WITHIN_MANDATE';

  const compliance_flags = [];
  if (!conserved) compliance_flags.push('CURATOR_VAULT_CAPS_NOT_CONSERVED');
  if (cap_breaches.length > 0) compliance_flags.push('CURATOR_VAULT_CAPS_CAP_BREACH');
  if (mandate_breaches.length > 0) compliance_flags.push('CURATOR_VAULT_CAPS_MANDATE_BREACH');
  if (coverage && !coverage.covered) compliance_flags.push('CURATOR_VAULT_CAPS_REDEMPTION_COVERAGE_SHORT');
  if (coverage && coverage.available_is_floor) compliance_flags.push('CURATOR_VAULT_CAPS_WITHDRAWABLE_INCOMPLETE');
  if (compliance_flags.length === 0) compliance_flags.push('CURATOR_VAULT_CAPS_WITHIN_MANDATE');

  return {
    output_payload: {
      profile,
      declared_context: { unit: 'minor', basis_points: true, rounding_rule: 'no division: relative comparisons are exact integer cross-multiplications (value * 10000 vs bp * total_assets_minor); reported shares are floored to integer basis points' },
      conservation: {
        reported_total_assets_minor: total,
        idle_plus_allocations_minor: Number(idlePlusAlloc),
        delta_minor: Number(conservationDelta),
        conserved,
      },
      cap_breaches,
      mandate_breaches,
      concentration: { largest_market: largest, herfindahl_bp2: herfindahl },
      coverage,
      verdict,
      scope_note: SCOPE_NOTE,
      primary_text: 'Morpho docs, Liquidity curation concepts page, pinned edition 2026-10-30 (sha256 in research/CURATOR-VAULT-CAP-PIN-2026-10-30.md)',
    },
    compliance_flags,
  };
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
