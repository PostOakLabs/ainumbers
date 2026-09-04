import { executionHash } from './_hash.mjs';

// art-672-fx-funding-sequencer: FX Funding Sequencer for T+1 (FX-SEQUENCER-BUILD-SPEC.md).
//
// WHAT IT DOES (spec "Functions / stages"): orders a trade's declared currency legs by FX
// cutoff, computes margin-to-cutoff minutes from the declared confirm time, returns an
// all-cutoffs-met verdict, and points at the PvP validator surface. Times are declared UTC
// "HH:MM" strings; the arithmetic is pure comparison math (cutoff minutes minus confirm
// minutes on the stated settle date). No calendar, timezone, or holiday logic is applied --
// every leg is assumed to settle on the one declared settle_date, as declared.
//
// PARITY TARGET: the canonical preimage embedded in FX-SEQUENCER-BUILD-SPEC.md. For the
// canonical policy_parameters, compute() must return an output_payload EXACTLY equal to the
// spec's output_payload; sequence, margins_minutes, all_cutoffs_met, trace, overall: those
// five keys, those values, NO extra keys; and executionHash(pp, output_payload) must equal
// the spec's staged execution_hash 1d4984b1e1c6efca36095590507adb92102ce7e1570d0ecc37517893737204fb.
// The trace string format is therefore load-bearing:
//   "<ccy> <cutoff> - <confirm> = <m> min; ...; order by tightest first"
// with legs listed tightest-margin-first, joined by "; ".
// Because the happy-path output_payload is parity-frozen at exactly five keys, the
// rationale / not_proven / fence / notice riders travel at the ARTIFACT level
// (buildArtifact), not inside output_payload.
//
// POSITIONING (spec Constraints): this tool computes arithmetic of DECLARED inputs under
// named rules. It does NOT check live SSR tapes, borrow lists, cutoff feeds, or registers,
// and never determines whether a declared cutoff is correct. The PvP check is OUT OF SCOPE:
// copy points at the PvP validator surface (the chaingraph settlement/PvP validator nodes,
// e.g. art-58-cross-network-settlement-validator) as a LINK, never a duplicated verdict --
// linked tools are pointers, never patch targets (row fence).
//
// NEVER GUESS, NEVER DEFAULT: an absent or malformed settle_date, confirm time, or leg
// (bad currency code, bad cutoff time, empty/absent legs) resolves to overall INDETERMINATE
// with each offending input named in rejected_inputs; never guessed toward a sequence.
//
// FINITE GATE: malformed input never throws; compute() always returns a defined
// output_payload. Zero network, zero storage, zero wall-clock reads inside compute().
//
// Run: node scripts/kernel-preflight.mjs art-672-fx-funding-sequencer

const TOOL_ID = 'art-672-fx-funding-sequencer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_fx_funding_sequencer',
  mandate_type: 'compliance_control', gpu: false,
};

const NOT_PROVEN = [
  { item: 'Not a live cutoff feed', detail: 'Cutoff times are caller-declared UTC strings. This kernel does not read any FX cutoff feed, SSR tape, borrow list, register, or venue calendar, and makes no claim that a declared cutoff matches any live market cutoff.' },
  { item: 'Not a PvP determination', detail: 'Payment-versus-payment outcome is out of scope. The output points at the PvP validator surface as a link; this kernel never renders a PvP verdict and never settles, nets, or moves anything.' },
  { item: 'Declared inputs only', detail: 'The settle date, confirm time, and currency legs are caller-declared and synthetic by contract. No correctness check on the declared values against any external source is performed.' },
  { item: 'Single-settle-date comparison math', detail: 'Margins are computed as cutoff-minus-confirm minutes on the one declared settle date. No timezone conversion, date rollover, holiday calendar, or daylight-saving adjustment is applied; a cutoff declared past midnight relative to the confirm time would be a negative margin, reported as declared.' },
];

const FENCE = 'This is arithmetic over caller-declared inputs under named rules. It is no check of any live cutoff feed, SSR tape, borrow list, or register, and it makes no PvP determination and performs no settlement action. A declared negative margin is an arithmetic finding about the declared times, never a determination that a cutoff was missed in fact or that any party is at fault.';

const NOTE = 'Deterministic FX funding sequencing for one declared T+1 settle date: orders declared currency legs by cutoff, computes margin-to-cutoff minutes from the declared confirm time, and returns an all-cutoffs-met verdict. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing.';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const CCY_RE = /^[A-Z]{3}$/;

function timeToMinutes(t) {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}
function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

/** Validates one declared leg; returns {ccy, cutoff_utc, margin_minutes} or pushes a rejection and returns null. */
function normalizeLeg(raw, i, confirmMin, rejected) {
  const where = `legs[${i}]`;
  if (!isPlainObject(raw)) {
    rejected.push({ where, reason: 'not an object; expected { ccy, cutoff_utc }', supplied: raw === undefined ? null : String(raw) });
    return null;
  }
  const ccySupplied = typeof raw.ccy === 'string';
  const ccy = ccySupplied ? raw.ccy.trim() : null;
  if (!ccySupplied || !CCY_RE.test(ccy)) {
    rejected.push({ where: `${where}.ccy`, reason: 'absent or not a 3-letter uppercase currency code', supplied: ccySupplied ? raw.ccy : null });
  }
  const cutoffSupplied = typeof raw.cutoff_utc === 'string';
  const cutoff = cutoffSupplied ? raw.cutoff_utc.trim() : null;
  if (!cutoffSupplied || !TIME_RE.test(cutoff)) {
    rejected.push({ where: `${where}.cutoff_utc`, reason: 'absent or not a declared UTC HH:MM time', supplied: cutoffSupplied ? raw.cutoff_utc : null });
  }
  if (!ccy || !cutoff || !CCY_RE.test(ccy) || !TIME_RE.test(cutoff)) return null;
  return { ccy, cutoff_utc: cutoff, margin_minutes: timeToMinutes(cutoff) - confirmMin };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  //; policy parameters -----------------------------------------------------
  const settleSupplied = typeof pp.settle_date === 'string';
  const settle_date = settleSupplied ? pp.settle_date.trim() : null;
  if (!settleSupplied || !/^\d{4}-\d{2}-\d{2}$/.test(settle_date)) {
    rejected_inputs.push({ where: 'settle_date', reason: 'absent or not a declared YYYY-MM-DD settle date', supplied: settleSupplied ? pp.settle_date : null });
  }

  const confirmSupplied = typeof pp.trade_confirm_utc === 'string';
  const trade_confirm_utc = confirmSupplied ? pp.trade_confirm_utc.trim() : null;
  let confirmMin = null;
  if (!confirmSupplied || !TIME_RE.test(trade_confirm_utc)) {
    rejected_inputs.push({ where: 'trade_confirm_utc', reason: 'absent or not a declared UTC HH:MM confirm time', supplied: confirmSupplied ? pp.trade_confirm_utc : null });
  } else {
    confirmMin = timeToMinutes(trade_confirm_utc);
  }

  const legsPresent = Array.isArray(pp.legs) && pp.legs.length > 0;
  if (!legsPresent) {
    rejected_inputs.push({ where: 'legs', reason: 'absent, malformed, or empty; at least one declared currency leg is required', supplied: null });
  }
  // Legs are normalized (and each malformed leg NAMED) even when the confirm time is
  // itself unusable, so every rejected input is reported, never just the first one.
  const legs = legsPresent
    ? pp.legs.map((raw, i) => normalizeLeg(raw, i, confirmMin, rejected_inputs)).filter(Boolean)
    : null;

  //; fail-closed payload ---------------------------------------------------
  const indeterminatePayload = () => {
    const rationale = [
      'Verdict is INDETERMINATE: one or more required declared inputs (settle_date, trade_confirm_utc, legs) were absent, malformed, or ambiguous, so no funding sequence could be computed.',
    ];
    if (rejected_inputs.length > 0) rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable. Each one is named in rejected_inputs rather than silently dropped or guessed toward a sequence.`);
    rationale.push('This tool computes arithmetic of declared inputs under named rules. It does not check live SSR tapes, borrow lists, cutoff feeds, or registers, and the PvP check is out of scope; the output points at the PvP validator surface as a link, never a duplicated verdict.');
    return {
      meta_riders: { rationale, not_proven: NOT_PROVEN, fence: FENCE, note: NOTE },
      output_payload: {
        sequence: null,
        margins_minutes: null,
        all_cutoffs_met: null,
        trace: null,
        overall: 'INDETERMINATE',
        indeterminate_reason: 'settle_date, trade_confirm_utc, or legs were absent or malformed; no funding sequence could be computed from declared inputs alone.',
        settle_date: settle_date || null,
        trade_confirm_utc: trade_confirm_utc || null,
        rejected_inputs,
        citations: {},
        rationale,
        not_proven: NOT_PROVEN,
        fence: FENCE,
        note: NOTE,
      },
      compliance_flags: rejected_inputs.length > 0
        ? ['FX_FUNDING_INPUTS_REJECTED', 'FX_FUNDING_INDETERMINATE']
        : ['FX_FUNDING_INDETERMINATE'],
    };
  };
  // Fail closed: if ANY declared leg was unusable, there is no sequence at all; a partial
  // sequence over the surviving legs would silently understate the funding task.
  if (!legs || legs.length === 0 || legs.length !== pp.legs.length || confirmMin === null) return indeterminatePayload();

  //; fail closed on duplicate currency legs: margins_minutes is keyed by currency, so a
  // duplicated declared leg is ambiguous and is named, never silently collapsed.
  const seen = new Set();
  for (const leg of legs) {
    if (seen.has(leg.ccy)) {
      rejected_inputs.push({ where: `legs[${legs.indexOf(leg)}].ccy`, reason: `duplicate declared currency leg "${leg.ccy}"; a currency may appear at most once`, supplied: leg.ccy });
      continue;
    }
    seen.add(leg.ccy);
  }
  if (seen.size !== legs.length) return indeterminatePayload();

  //; sequencing: tightest margin first; ties keep declared order (stable) ---
  const ordered = legs
    .map((leg, idx) => ({ ...leg, idx }))
    .sort((a, b) => (a.margin_minutes - b.margin_minutes) || (a.idx - b.idx));

  const sequence = ordered.map((l) => l.ccy);
  const margins_minutes = {};
  for (const l of ordered) margins_minutes[l.ccy] = l.margin_minutes;
  const all_cutoffs_met = ordered.every((l) => l.margin_minutes >= 0);
  const trace = ordered.map((l) => `${l.ccy} ${l.cutoff_utc} - ${trade_confirm_utc} = ${l.margin_minutes} min`).join('; ') + '; order by tightest first';
  const overall = all_cutoffs_met ? 'FUNDING_SEQUENCED' : 'CUTOFF_MISSED';

  // PARITY: the happy-path output_payload is frozen at EXACTLY the five canonical keys.
  const output_payload = {
    sequence,
    margins_minutes,
    all_cutoffs_met,
    trace,
    overall,
  };

  const tightest = ordered[0].margin_minutes;
  const rationale = [
    `FX funding sequence computed for settle date ${settle_date} against declared confirm time ${trade_confirm_utc} UTC.`,
    `${ordered.length} declared currency leg${ordered.length === 1 ? '' : 's'} ordered tightest margin first: ${sequence.join(', ')}.`,
    all_cutoffs_met
      ? `Every declared leg clears its declared cutoff by ${tightest} minute${tightest === 1 ? '' : 's'} or more; all-cutoffs-met verdict is true.`
      : `${ordered.filter((l) => l.margin_minutes < 0).map((l) => l.ccy).join(', ')} is declared at or past its declared cutoff (negative margin); all-cutoffs-met verdict is false.`,
    'Margins are cutoff-minus-confirm minutes over declared UTC HH:MM strings; pure comparison math on the one declared settle date, with no timezone, calendar, or holiday adjustment.',
    'This tool computes arithmetic of declared inputs under named rules. It does not check live SSR tapes, borrow lists, cutoff feeds, or registers; the PvP check is out of scope and the PvP validator surface is pointed at and never re-run.',
  ];

  // Conditional flag emissions only (flags lint): a flag fires exactly when the
  // branch that earns it ran. !all_cutoffs_met <=> some declared leg has a negative margin.
  const compliance_flags = all_cutoffs_met
    ? ['FX_ALL_CUTOFFS_MET']
    : ['FX_CUTOFF_MISSED', 'ESCALATION_RAISED'];

  return {
    meta_riders: { rationale, not_proven: NOT_PROVEN, fence: FENCE, note: NOTE },
    output_payload,
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags, meta_riders } = compute(pp);
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
    rationale: meta_riders.rationale,
    not_proven: meta_riders.not_proven,
    fence: meta_riders.fence,
    note: meta_riders.note,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
