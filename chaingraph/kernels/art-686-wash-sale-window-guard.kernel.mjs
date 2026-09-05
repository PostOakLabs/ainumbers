import { executionHash } from './_hash.mjs';

// art-686-wash-sale-window-guard — Wash-Sale Window Guard.
// Deterministic calculator over caller-declared synthetic inputs: it computes the
// arithmetic of one named rule, the 61-day acquisition window (sale date minus 30
// days through sale date plus 30 days, inclusive) applied to a declared lot sale
// and a declared replacement-purchase list, and NOTHING more. The verdict enum
// describes the declared arithmetic only. It is never advice, never an optimizer,
// and never a tax position. Zero storage, zero network, no runtime clock (any
// as-of is a caller-declared input). All inputs are synthetic per the PII banner,
// never real client or portfolio data.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(),
// no network, no filesystem. Date arithmetic uses Date.UTC on caller-declared
// calendar dates only, never the host clock, so it runs unmodified inside the
// QuickJS-ng zkVM guest, which is a STRICT SUBSET of a browser/Node environment.

const TOOL_ID = 'art-686-wash-sale-window-guard';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_wash_sale_window_guard',
  mandate_type: 'compliance_control', gpu: false,
};

// Round to 2 decimal places, half-up, declared here and mirrored in every trace.
function round2dpHalfUp(x) {
  const scaled = x * 100;
  const r = Math.sign(scaled) * Math.round(Math.abs(scaled) + Number.EPSILON * Math.abs(scaled));
  return r / 100;
}

function asFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// Strict calendar-date parse of a caller-declared ISO yyyy-mm-dd string. Returns
// the UTC-midnight epoch ms, or null when the string is not a real calendar date
// (fail closed on undated or malformed lots, never guess).
function parseIsoDateUtc(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const ms = Date.UTC(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (d.getUTCFullYear() !== Number(v.slice(0, 4))
    || d.getUTCMonth() !== Number(v.slice(5, 7)) - 1
    || d.getUTCDate() !== Number(v.slice(8, 10))) return null;
  return ms;
}

function isoFromUtcMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * compute(pp) — pure decision kernel.
 * Declared inputs:
 *   sale                   (required object)
 *     .lot_id              (required, non-empty string) declared lot identifier
 *     .sale_date           (required, ISO yyyy-mm-dd) declared sale date
 *     .realized_loss       (required, >= 0) declared realized loss on the lot
 *   replacement_purchases  (required array, may be empty) declared replacement
 *                          purchases, each:
 *     .date                (required, ISO yyyy-mm-dd) declared purchase date — an
 *                          undated lot fails closed with a thrown TypeError
 *     .account_type        (required, "taxable" | "tax_deferred") declared account type
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const flags = [];

  const sale = pp.sale;
  if (!sale || typeof sale !== 'object' || Array.isArray(sale)) {
    flags.push('WSG_ERROR');
    throw new TypeError('sale must be supplied as an object with lot_id, sale_date and realized_loss (synthetic values; never real portfolio data).');
  }
  if (typeof sale.lot_id !== 'string' || sale.lot_id.length === 0) {
    flags.push('WSG_ERROR');
    throw new TypeError('sale.lot_id must be supplied as a non-empty string.');
  }
  const saleMs = parseIsoDateUtc(sale.sale_date);
  if (saleMs === null) {
    flags.push('WSG_ERROR');
    throw new TypeError('sale.sale_date must be supplied as a valid ISO yyyy-mm-dd calendar date; an undated lot fails closed.');
  }
  const realizedLoss = asFiniteNumber(sale.realized_loss);
  if (realizedLoss === null || realizedLoss < 0) {
    flags.push('WSG_ERROR');
    throw new TypeError('sale.realized_loss must be supplied as a finite non-negative number.');
  }
  if (!Array.isArray(pp.replacement_purchases)) {
    flags.push('WSG_ERROR');
    throw new TypeError('replacement_purchases must be supplied as an array (it may be empty).');
  }
  const purchases = [];
  for (const p of pp.replacement_purchases) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      flags.push('WSG_ERROR');
      throw new TypeError('each entry of replacement_purchases must be an object with date and account_type.');
    }
    const pMs = parseIsoDateUtc(p.date);
    if (pMs === null) {
      flags.push('WSG_ERROR');
      throw new TypeError('each replacement purchase must carry a valid ISO yyyy-mm-dd date; an undated lot fails closed.');
    }
    if (p.account_type !== 'taxable' && p.account_type !== 'tax_deferred') {
      flags.push('WSG_ERROR');
      throw new TypeError('each replacement purchase account_type must be declared as either "taxable" or "tax_deferred".');
    }
    purchases.push({ ms: pMs, date: p.date, account_type: p.account_type });
  }

  // The named rule: the 61-day window is the sale date minus 30 days through the
  // sale date plus 30 days, inclusive of both endpoints and the sale date itself.
  const DAY = 86400000;
  const windowStartMs = saleMs - 30 * DAY;
  const windowEndMs = saleMs + 30 * DAY;
  const windowStart = isoFromUtcMs(windowStartMs);
  const windowEnd = isoFromUtcMs(windowEndMs);

  const inWindow = purchases.filter((p) => p.ms >= windowStartMs && p.ms <= windowEndMs);
  const replacementsInWindow = inWindow.length;

  const roundedLoss = round2dpHalfUp(realizedLoss);
  const flagged = replacementsInWindow > 0;
  const disallowedLoss = flagged ? roundedLoss : 0;
  const iraTrap = inWindow.some((p) => p.account_type === 'tax_deferred');

  let trace;
  if (flagged) {
    trace = `${inWindow[0].date} is within ${windowStart}..${windowEnd} (sale ${sale.sale_date} \u00b130d) so the ${roundedLoss} loss is disallowed under the declared section 1091 method`;
  } else {
    trace = `no declared replacement purchase falls within ${windowStart}..${windowEnd} (sale ${sale.sale_date} \u00b130d) so the ${roundedLoss} loss is allowed under the declared section 1091 method`;
  }

  const output_payload = {
    window_start: windowStart,
    window_end: windowEnd,
    replacements_in_window: replacementsInWindow,
    disallowed_loss: disallowedLoss,
    ira_trap: iraTrap,
    trace,
    overall: flagged ? 'WASH_SALE_FLAGGED' : 'WASH_SALE_CLEAR',
  };

  // The carryforward note rides OUTSIDE the hashed payload: the canonical preimage
  // (HARVEST-GUARD-BUILD-SPEC) freezes output_payload at exactly seven keys on the
  // flagged taxable path, so the basis-carryforward explanation is carried by the
  // WSG_CARRYFORWARD_BASIS compliance_flag (compliance_flags is not part of the
  // preimage) and rendered with its note text by the node page.
  if (flagged && !iraTrap) flags.push('WSG_CARRYFORWARD_BASIS');
  if (iraTrap) {
    flags.push('WSG_IRA_TRAP');
    // Flag-mirror doctrine (AUTHORING-STANDARD): a conditional warning flag mirrors
    // into output_payload.warnings. The canonical-parity keys stay byte-frozen, so
    // the mirror member is added only when a warning flag actually fired (never on
    // the canonical path, whose payload carries exactly the seven declared keys).
    output_payload.warnings = ['WSG_IRA_TRAP'];
  }

  return { output_payload, compliance_flags: flags };
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
