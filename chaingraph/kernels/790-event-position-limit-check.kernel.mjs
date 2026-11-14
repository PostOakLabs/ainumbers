import { executionHash } from './_hash.mjs';

// 790-event-position-limit-check — event-contract position limit / accountability checker.
//
// BEHAVIOUR ONLY (KERNEL-CITATION-CLASS-1): rule cites travel as output data strings and in the
// node shard's cited_clause_digest[], never as source comments. Every limit and accountability
// figure is CALLER-SUPPLIED — the kernel hard-codes no venue figure. Integer arithmetic only
// (BigInt products, safe-Number outputs). One documented rounding rule: max loss is rounded UP
// to the next minor unit when computed from micro-denominated prices (ceiling, conservative
// toward finding).
//
// Profiles are data (not code): each profile row carries the venue label, the market-maker
// accountability multiplier default, the market-maker limit-exemption default, the default
// netting rule, an effective window and a source pin. The caller's as_of selects the row.
// A `generic` profile carries no defaults at all — every parameter is caller-supplied.
//
// DETERMINISM: compute() is a PURE function of pp — no wall clock, no network, no filesystem.
// It runs unmodified inside the QuickJS-ng zkVM guest (no TextEncoder/atob/btoa/URL).

const TOOL_ID = '790-event-position-limit-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_event_contract_position_limits',
  mandate_type: 'compliance_control', gpu: false,
};

// ── profile table (data; effective-dated; source pins echo where the profile's shape comes from) ──
const PROFILES = {
  kalshi_rulebook_v1_29: {
    profile_id: 'kalshi_rulebook_v1_29',
    venue_label: 'Kalshi DCM',
    effective_from: '2026-10-30',
    effective_to: null,
    mm_accountability_multiplier_default: 10,
    mm_limit_exempt_default: true,
    netting_default: 'gross',
    source_pin: 'Kalshi DCM Rulebook v1.29 (pinned sha256:3b6d4ffd5b32330d3466179d4cae610372d07511123c9976bc6cbb1b5185240b); accountability cite Rule 5.18, limit cite Rule 5.19, market-maker cite Rule 4.5',
    cites: {
      accountability: 'Kalshi DCM Rulebook v1.29 Rule 5.18 (Position Accountability) with 17 CFR 38.300 Core Principle 5',
      limit: 'Kalshi DCM Rulebook v1.29 Rule 5.19 (Position Limits) with 17 CFR 38.301',
      market_maker: 'Kalshi DCM Rulebook v1.29 Rule 4.5 (market maker accountability 10x; limit exemption on program contracts)',
    },
  },
  generic: {
    profile_id: 'generic',
    venue_label: 'caller-declared venue',
    effective_from: '0000-01-01',
    effective_to: null,
    mm_accountability_multiplier_default: null,
    mm_limit_exempt_default: null,
    netting_default: 'gross',
    source_pin: 'caller-supplied; the generic profile carries no venue data and no defaults',
    cites: {
      accountability: 'caller-declared accountability level (venue regime data); see 17 CFR 38.300 for the DCM obligation shape',
      limit: 'caller-declared position limit (venue regime data); see 17 CFR 38.301 for the DCM obligation shape',
      market_maker: 'caller-declared market-maker treatment; no default is applied',
    },
  },
};

const MICRO_PER_MINOR = 10000; // 1 minor unit (cent) = 10,000 micro units (micro-dollars)
const PRICE_MICRO_MAX = 1000000; // yes contract pays out 1.00 at resolution

// ── refusal machinery (AUTHORING-STANDARD section 1: refused branches are reachable runtime paths) ──
function refused(flag, field, reason, extra) {
  const payload = {
    verdict: 'REFUSED',
    manual_review_required: true,
    refusal: { flag, field: field || null, reason },
    refusal_flag: flag,
    compliance_note: 'structured non-verdict: no limit or accountability finding is asserted on a refused input',
  };
  if (extra) payload.refusal.detail = extra;
  return { output_payload: payload, compliance_flags: [flag, 'REFUSED_NO_FINDING_ASSERTED'] };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Identifier-like label detection (AUTHORING-STANDARD section 1 refusal for identifier-shaped fields):
// a label that looks like an account id, member id, order id, blockchain address, or hash is
// refused — labels must be synthetic contract/event/series designators.
function labelLooksLikeIdentifier(s) {
  if (typeof s !== 'string' || s.length === 0) return 'empty';
  if (s.length > 64) return 'over-64-chars';
  if (/^(acct|account|member|user|order|cust|client|customer)[\s:_-]*\d/i.test(s)) return 'account-or-member-id-shape';
  if (/^0x[0-9a-f]+$/i.test(s) && s.length >= 20) return 'address-shape';
  if (/^[0-9a-f]{32,}$/i.test(s)) return 'hash-shape';
  if (/[A-Za-z]{4}\d{6,}/.test(s) && /\d{6,}/.test(s) && s.length >= 12 && s.includes('ID')) return 'id-token-shape';
  if (/@/.test(s)) return 'email-shape';
  return null;
}

function isNonNegInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}
function isPosInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function ceilDivBig(a, b) { // both BigInt, b > 0
  return (a + b - 1n) / b;
}

function toSafe(n) { // BigInt -> Number, refusing unsafe magnitudes
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(n);
}

// Max loss of a position in micro units: a YES position loses its full cost (quantity x price);
// a NO position loses quantity x (payout - price).
function maxLossMicro(side, quantity, priceMicro) {
  const q = BigInt(quantity);
  const p = BigInt(priceMicro);
  return side === 'yes' ? q * p : q * BigInt(PRICE_MICRO_MAX - priceMicro);
}

export function compute(pp) {
  pp = pp || {};

  // ── profile ──
  const profileId = pp.profile;
  if (typeof profileId !== 'string' || !Object.prototype.hasOwnProperty.call(PROFILES, profileId)) {
    return refused('PROFILE_REFUSED', 'profile',
      'unknown profile string; the closed profile set is kalshi_rulebook_v1_29 and generic; no default profile is applied');
  }
  const profile = PROFILES[profileId];

  // ── as_of (caller clock, never a wall clock) ──
  const asOf = pp.as_of;
  if (typeof asOf !== 'string' || !ISO_DATE.test(asOf)) {
    return refused('AS_OF_REFUSED', 'as_of',
      'as_of must be an ISO-8601 date YYYY-MM-DD; the kernel never reads a wall clock');
  }
  if (asOf < profile.effective_from || (profile.effective_to && asOf > profile.effective_to)) {
    return refused('PROFILE_NOT_EFFECTIVE', 'as_of',
      'as_of falls outside the pinned profile window ' + profile.effective_from + '..' + (profile.effective_to || 'open'));
  }

  // ── aggregation / netting / participant class ──
  const aggregation = pp.aggregation;
  if (aggregation !== 'per_contract' && aggregation !== 'per_event' && aggregation !== 'per_series') {
    return refused('AGGREGATION_REFUSED', 'aggregation',
      'aggregation must be one of per_contract, per_event, per_series');
  }
  const netting = pp.netting === undefined || pp.netting === null ? profile.netting_default : pp.netting;
  if (netting !== 'gross' && netting !== 'per_contract_net') {
    return refused('NETTING_REFUSED', 'netting',
      'netting must be one of gross, per_contract_net (default is the profile rule: ' + profile.netting_default + ')');
  }
  const participantClass = pp.participant_class;
  if (participantClass !== 'standard' && participantClass !== 'market_maker') {
    return refused('PARTICIPANT_CLASS_REFUSED', 'participant_class',
      'participant_class must be one of standard, market_maker');
  }
  const isMM = participantClass === 'market_maker';
  let mmMultiplier;
  if (pp.mm_accountability_multiplier !== undefined && pp.mm_accountability_multiplier !== null) {
    if (!isPosInt(pp.mm_accountability_multiplier)) {
      return refused('MM_MULTIPLIER_REFUSED', 'mm_accountability_multiplier',
        'mm_accountability_multiplier must be a positive integer');
    }
    mmMultiplier = pp.mm_accountability_multiplier;
  } else if (profile.mm_accountability_multiplier_default !== null) {
    mmMultiplier = profile.mm_accountability_multiplier_default;
  } else if (isMM) {
    return refused('MM_MULTIPLIER_REQUIRED', 'mm_accountability_multiplier',
      'the generic profile carries no market-maker default; a market_maker caller must declare mm_accountability_multiplier');
  } else {
    mmMultiplier = 1;
  }
  let mmLimitExempt;
  if (pp.mm_limit_exempt !== undefined && pp.mm_limit_exempt !== null) {
    if (typeof pp.mm_limit_exempt !== 'boolean') {
      return refused('MM_LIMIT_EXEMPT_REFUSED', 'mm_limit_exempt', 'mm_limit_exempt must be a boolean');
    }
    mmLimitExempt = pp.mm_limit_exempt;
  } else if (profile.mm_limit_exempt_default !== null) {
    mmLimitExempt = profile.mm_limit_exempt_default;
  } else {
    mmLimitExempt = false;
  }

  // ── positions ──
  if (!Array.isArray(pp.positions) || pp.positions.length === 0) {
    return refused('POSITIONS_REFUSED', 'positions', 'positions must be a non-empty array');
  }
  if (pp.positions.length > 200) {
    return refused('POSITIONS_REFUSED', 'positions', 'more than 200 positions exceeds the declared bounded domain');
  }
  const LABEL_FIELDS = ['contract_label', 'event_label', 'series_label'];
  const parsed = [];
  for (const pos of pp.positions) {
    if (!pos || typeof pos !== 'object') {
      return refused('POSITION_REFUSED', 'positions', 'each position must be an object');
    }
    for (const f of LABEL_FIELDS) {
      const bad = labelLooksLikeIdentifier(pos[f]);
      if (bad) {
        return refused('LABEL_IDENTIFIER_SUSPECTED', f,
          'label field looks like an account id, member id, address, email or hash (' + bad + '); labels must be synthetic contract, event or series designators');
      }
    }
    if (pos.side !== 'yes' && pos.side !== 'no') {
      return refused('SIDE_REFUSED', 'side', 'side must be one of yes, no');
    }
    if (!isPosInt(pos.quantity)) {
      return refused('QUANTITY_REFUSED', 'quantity', 'quantity must be a positive integer');
    }
    if (!isNonNegInt(pos.avg_price_micro) || pos.avg_price_micro > PRICE_MICRO_MAX) {
      return refused('PRICE_REFUSED', 'avg_price_micro',
        'avg_price_micro must be an integer in 0..' + PRICE_MICRO_MAX);
    }
    if (pos.max_loss_minor !== undefined && pos.max_loss_minor !== null && !isNonNegInt(pos.max_loss_minor)) {
      return refused('MAX_LOSS_REFUSED', 'max_loss_minor', 'max_loss_minor, when declared, must be a non-negative integer');
    }
    if (pos.accountability_level_minor !== undefined && pos.accountability_level_minor !== null && !isNonNegInt(pos.accountability_level_minor)) {
      return refused('ACCOUNTABILITY_LEVEL_REFUSED', 'accountability_level_minor', 'accountability_level_minor, when declared, must be a non-negative integer');
    }
    if (pos.limit_minor !== undefined && pos.limit_minor !== null && !isNonNegInt(pos.limit_minor)) {
      return refused('LIMIT_REFUSED', 'limit_minor', 'limit_minor, when declared, must be a non-negative integer');
    }
    if (pos.limit_basis !== 'max_loss' && pos.limit_basis !== 'contracts') {
      return refused('LIMIT_BASIS_REFUSED', 'limit_basis', 'limit_basis must be one of max_loss, contracts');
    }
    parsed.push({
      contract_label: pos.contract_label, event_label: pos.event_label, series_label: pos.series_label,
      side: pos.side, quantity: pos.quantity, avg_price_micro: pos.avg_price_micro,
      declared_max_loss_minor: pos.max_loss_minor ?? null,
      accountability_level_minor: pos.accountability_level_minor ?? null,
      limit_minor: pos.limit_minor ?? null,
      limit_basis: pos.limit_basis,
      netted: false,
    });
  }

  // ── netting: per_contract_net nets yes and no quantities on the same contract ──
  let books = parsed;
  const nettingApplied = netting === 'per_contract_net';
  if (nettingApplied) {
    const byContract = new Map();
    for (const p of parsed) {
      if (!byContract.has(p.contract_label)) byContract.set(p.contract_label, []);
      byContract.get(p.contract_label).push(p);
    }
    books = [];
    for (const [, group] of byContract) {
      const yes = group.filter((p) => p.side === 'yes');
      const no = group.filter((p) => p.side === 'no');
      const yesQty = yes.reduce((a, p) => a + p.quantity, 0);
      const noQty = no.reduce((a, p) => a + p.quantity, 0);
      const net = yesQty - noQty;
      const proto = group[0];
      if (net === 0) {
        books.push({ ...proto, side: 'yes', quantity: 0, avg_price_micro: proto.avg_price_micro, netted: true });
      } else if (net > 0) {
        books.push({ ...proto, side: 'yes', quantity: net, avg_price_micro: yes[0].avg_price_micro, netted: true });
      } else {
        books.push({ ...proto, side: 'no', quantity: -net, avg_price_micro: no[0].avg_price_micro, netted: true });
      }
    }
  }

  // ── per-book max loss (one documented rounding rule: ceiling to the next minor unit) ──
  const bookRows = books.map((b) => {
    let maxLossMinor;
    let rounding = 'declared_by_caller';
    if (b.declared_max_loss_minor !== null) {
      maxLossMinor = b.declared_max_loss_minor;
    } else if (b.quantity === 0) {
      maxLossMinor = 0;
      rounding = 'netted_to_zero';
    } else {
      const micro = maxLossMicro(b.side, b.quantity, b.avg_price_micro);
      const minor = ceilDivBig(micro, BigInt(MICRO_PER_MINOR));
      const safe = toSafe(minor);
      if (safe === null) return { book: b, refusal: 'MAX_LOSS_MAGNITUDE_REFUSED' };
      maxLossMinor = safe;
      rounding = 'ceil_micro_to_minor';
    }
    return { book: { ...b, netted: b.netted === true }, max_loss_minor: maxLossMinor, rounding };
  });
  for (const r of bookRows) {
    if (r.refusal) {
      return refused('MAX_LOSS_MAGNITUDE_REFUSED', 'quantity',
        'computed max loss exceeds the safe-integer output bound; reduce quantity', r.refusal);
    }
  }

  // ── market-maker treatment ──
  const flags = [];
  if (isMM) flags.push('MM_ACCOUNTABILITY_MULTIPLIER_APPLIED');
  if (isMM && mmLimitExempt) flags.push('MM_LIMIT_EXEMPTION_APPLIED');

  const effectiveAcct = (book) => {
    if (book.book.accountability_level_minor === null) return null;
    return book.book.accountability_level_minor * (isMM ? mmMultiplier : 1);
  };
  const limitApplies = (book) => {
    if (book.book.limit_minor === null) return false;
    if (isMM && mmLimitExempt) return false;
    return true;
  };

  // ── aggregation groups ──
  const groupKeyOf = (b) => aggregation === 'per_contract' ? b.contract_label
    : aggregation === 'per_event' ? b.event_label : b.series_label;
  const groups = new Map();
  for (const r of bookRows) {
    const k = groupKeyOf(r.book);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const groupRows = [];
  const accountabilityBreaches = [];
  const limitBreaches = [];
  let nonUniformLevels = false;
  for (const [key, rows] of groups) {
    const maxLossMinor = rows.reduce((a, r) => a + r.max_loss_minor, 0);
    const quantity = rows.reduce((a, r) => a + r.book.quantity, 0);
    const levels = new Set(rows.filter((r) => r.book.accountability_level_minor !== null).map((r) => r.book.accountability_level_minor));
    const limits = new Set(rows.filter((r) => r.book.limit_minor !== null).map((r) => r.book.limit_minor));
    const bases = new Set(rows.filter((r) => r.book.limit_minor !== null).map((r) => r.book.limit_basis));
    if (rows.some((r) => r.book.accountability_level_minor === null) || levels.size > 1) nonUniformLevels = true;

    let effAcct = null;
    if (levels.size === 1 && !rows.some((r) => r.book.accountability_level_minor === null)) {
      const lvl = [...levels][0];
      effAcct = lvl * (isMM ? mmMultiplier : 1);
    }
    let effLimit = null, effBasis = null;
    if (limits.size === 1 && !rows.some((r) => r.book.limit_minor === null) && !(isMM && mmLimitExempt) && bases.size === 1) {
      effLimit = [...limits][0];
      effBasis = [...bases][0];
    }

    const acctExceeded = effAcct !== null && maxLossMinor > effAcct;
    const limitExceeded = effLimit !== null && (effBasis === 'max_loss' ? maxLossMinor > effLimit : quantity > effLimit);

    groupRows.push({
      group_key: key,
      aggregation,
      position_count: rows.length,
      quantity,
      max_loss_minor: maxLossMinor,
      accountability_level_minor: effAcct === null ? null : rows[0].book.accountability_level_minor,
      effective_accountability_level_minor: effAcct,
      accountability_exceeded: acctExceeded,
      limit_minor: effLimit,
      limit_basis: effBasis,
      limit_applies: effLimit !== null,
      limit_exceeded: limitExceeded,
    });

    if (acctExceeded) {
      accountabilityBreaches.push({
        group_key: key,
        max_loss_minor: maxLossMinor,
        declared_level_minor: rows[0].book.accountability_level_minor,
        effective_level_minor: effAcct,
        market_maker_multiplier_applied: isMM ? mmMultiplier : null,
        cite: profile.cites.accountability,
      });
    }
    if (limitExceeded) {
      limitBreaches.push({
        group_key: key,
        max_loss_minor: maxLossMinor,
        quantity,
        limit_minor: effLimit,
        limit_basis: effBasis,
        market_maker_exemption_applied: false,
        cite: profile.cites.limit,
      });
    }
  }
  if (nonUniformLevels) flags.push('AGG_LEVELS_NOT_UNIFORM_PER_GROUP_CHECKS_ONLY');
  if (isMM && mmLimitExempt) flags.push('LIMIT_CHECKS_SCOPE_NOTE_MM_EXEMPT');

  let verdict;
  if (limitBreaches.length > 0) {
    verdict = 'LIMIT_BREACH';
    flags.push('LIMIT_BREACH_PRESENT');
  } else if (accountabilityBreaches.length > 0) {
    verdict = 'ACCOUNTABILITY_REVIEW';
    flags.push('ACCOUNTABILITY_BREACH_PRESENT');
  } else {
    verdict = 'WITHIN';
    flags.push('VERDICT_WITHIN_NO_BREACH');
  }

  const payload = {
    verdict,
    manual_review_required: nonUniformLevels,
    profile_id: profile.profile_id,
    venue_label: profile.venue_label,
    source_pin: profile.source_pin,
    as_of: asOf,
    aggregation,
    netting_declared: netting,
    netting_rule_note: nettingApplied
      ? 'per_contract_net: yes and no quantities on the same contract were netted before max-loss computation'
      : 'gross: yes and no positions on the same contract are both counted; the profile default is ' + profile.netting_default,
    participant_class: participantClass,
    market_maker_treatment: {
      accountability_multiplier: isMM ? mmMultiplier : 1,
      multiplier_source: pp.mm_accountability_multiplier != null ? 'caller' : (isMM ? 'profile_default' : 'standard_1x'),
      limit_exempt: isMM && mmLimitExempt,
      cite: profile.cites.market_maker,
    },
    rounding_rule: 'max loss computed from side, quantity and avg_price_micro is rounded UP to the next minor unit (ceiling of micro/10000) — conservative toward finding; a caller-declared max_loss_minor is used as given',
    error_direction: 'conservative_toward_finding',
    aggregation_scope_note: 'aggregation across similar contracts is venue-specific and sets no numeric level here; every figure is caller-supplied',
    positions: bookRows.map((r) => ({
      contract_label: r.book.contract_label,
      event_label: r.book.event_label,
      series_label: r.book.series_label,
      side: r.book.side,
      quantity: r.book.quantity,
      avg_price_micro: r.book.avg_price_micro,
      netted: r.book.netted === true,
      declared_max_loss_minor: r.book.declared_max_loss_minor,
      max_loss_minor: r.max_loss_minor,
      rounding: r.rounding,
      accountability_level_minor: r.book.accountability_level_minor,
      effective_accountability_level_minor: effectiveAcct(r),
      limit_minor: r.book.limit_minor,
      limit_basis: r.book.limit_basis,
      limit_applies: limitApplies(r),
      group_key: groupKeyOf(r.book),
    })),
    groups: groupRows,
    accountability_breaches: accountabilityBreaches,
    limit_breaches: limitBreaches,
    cite_accountability: profile.cites.accountability,
    cite_limit: profile.cites.limit,
  };

  return { output_payload: payload, compliance_flags: flags };
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
