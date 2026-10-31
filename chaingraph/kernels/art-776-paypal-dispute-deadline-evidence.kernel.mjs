// art-776-paypal-dispute-deadline-evidence — payment-service-provider dispute
// deadline calculator and evidence-bundle PRODUCER (first built 2026-10-24;
// extended to per-PSP deadline tables 2026-10-29).
//
// ROLE: this is the seller-side PRODUCER that emits a
// CE3.0-shaped bundle consumable by art-297 (mcp:lint_compelling_evidence_ce30_agentic),
// NOT a second linter. art-297 is the Visa CE3.0 TERMINAL linter; it knows no PayPal
// reasons and no PayPal deadlines. This node supplies the seller side: deadlines and
// the evidence bundle, with art-297's field names kept verbatim.
//
// CLAUSE AUTHORITY: every clause below is quoted verbatim (each under 25 words) from the
// dispute snapshots under research/clause-snapshots/ — paypal-disputes-2026-10
// (fetch 2026-10-25T03Z) for the PayPal path, stripe-disputes-2026-10,
// adyen-disputes-2026-10 and square-disputes-2026-10 (each fetch 2026-10-26T12Z) for
// the per-PSP deadline tables. A deadline the snapshot marks NOT STATED is returned
// as null with a reason, never guessed. Sources S1-S9 are the PayPal snapshot's nine
// pages; source ids in comments refer to that table.
//
// PER-PSP DEADLINE TABLES: a `psp` input (default `paypal`) selects one deadline table
// per PSP, as data, each rule citing its own snapshot's clause. The PayPal table is
// the original behavior, byte-identical for inputs that omit `psp` (or set
// `psp: 'paypal'`). The Stripe, Adyen and Square tables carry each PSP's own stage
// vocabulary and stated numbers; a window the PSP states only as a range, a
// "typically" figure or not at all returns due null with the reason quoted.
//
// VOCABULARY: dispute reasons and evidence types are reused VERBATIM from
// paypal-agent-shop/lib/disputes.js. No new reason or
// evidence vocabulary is invented here. On the PayPal path an unknown reason is
// refused, mirroring the lib's UnknownDisputeReasonError. The other PSP paths do not
// use that reason map: their snapshots publish no single re-typed per-reason evidence
// table, so those paths return required_evidence null with a reason instead of
// guessing.
//
// STAGE SCOPING (desk amendment 2026-10-25): most PayPal disputes run through PayPal's
// own buyer-protection process (inquiry, then claim), where no card network and no Visa
// CE3.0 applies. Only a chargeback on a card-funded transaction is a network dispute.
// The CE3.0-shaped bundle is emitted ONLY for lifecycle_stage CHARGEBACK with
// funding_source card. Inquiry and claim stages (and non-card funding) get a
// paypal_process_evidence bundle labelled as not CE3.0. Unknown funding gets no CE3.0
// bundle and a reason.
//
// CLOCK NOTE (deterministic): days remaining are measured against the REQUIRED
// caller-supplied as_of timestamp, never a wall clock. Nothing in compute() reads the
// clock, randomness or I/O. No network, no PII; all values are synthetic.
//
// HASHING: the artifact execution_hash is produced only by the shared
// chaingraph/kernels/_hash.mjs (executionHash over the RFC 8785/JCS canonical
// {policy_parameters, output_payload}) inside buildArtifact, the same path as art-213.
// The delivery_proof element digest inside the payload is a real SHA-256 (pure-JS sync
// leg below, like art-774's inline _hmacSha256, because the VM-1a QuickJS leg runs
// compute() standalone) over the jcsCanonical form, a byte-identical inline copy of the
// shared canonicalizer; the proptest P4 differential pins both the canonicalizer and
// the SHA-256 against _hash.mjs + node:crypto.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-776-paypal-dispute-deadline-evidence';
const TOOL_VERSION = '1.0.0';

// Clauses this kernel rests on (verbatim quotes, SNAPSHOT.md section 2), keyed for the
// per-run subset emitted in output_payload.cited_clauses, so each artifact carries the
// clauses its own output rests on. Source urls come from the SNAPSHOT.md "Sources" table.
const SNAPSHOT_SOURCES = {
  S1: 'https://developer.paypal.com/platforms/disputes/handle-disputes/use-disputes-api',
  S2: 'https://developer.paypal.com/disputes/disputes-lifecycle',
  S5: 'https://developer.paypal.com/api/customer-disputes/v1/schema.json',
  S8: 'https://www.paypal.com/us/cshelp/article/how-do-i-respond-to-%E2%80%98item-not-received%E2%80%99-and-%E2%80%98significantly-not-as-described%E2%80%99-disputes-help1083',
  S9: 'https://www.paypal.com/us/cshelp/article/evidence-to-provide-for-chargebacks-a-guide-for-sellers-help1103',
};

const CLAUSES = {
  seller_response_10_day_a: { id: 'S1', quote: 'As a merchant, you can submit supporting documentation within 10 days after the inquiry starts.' },
  seller_response_10_day_b: { id: 'S8', quote: 'You must respond within the first 10 days following a dispute creation.' },
  miss_10_day_consequence: { id: 'S8', quote: "If you don't respond within these 10 days and the buyer escalates it to a claim, we will resolve the case in the buyer's favor." },
  inquiry_20_day: { id: 'S1', quote: 'The inquiry stage lasts up to 20 days unless escalated to a claim.' },
  inquiry_auto_close: { id: 'S8', quote: 'Disputes are closed automatically after 20 days unless you or the buyer escalate it.' },
  due_date_definition: { id: 'S5', quote: 'The date and time by when the merchant must respond to the dispute, in Internet date and time format.' },
  due_date_consequence: { id: 'S5', quote: 'If the merchant does not respond by this date and time, the dispute is closed in the customer\'s favor.' },
  chargeback_no_number: { id: 'S9', quote: 'please respond to us promptly as there are strict response deadlines required for chargebacks based on the issuer.' },
  appeal_no_number: { id: 'S2', quote: 'If the merchant does not appeal within the appeal period, the case is considered resolved.' },
  chargeback_is_claim: { id: 'S2', quote: 'CHARGEBACK. A customer or merchant escalates an inquiry to a claim, which authorizes PayPal to investigate the case and make a determination.' },
};

function clause(key) {
  const c = CLAUSES[key];
  return { id: c.id, quote: c.quote, url: SNAPSHOT_SOURCES[c.id] };
}

// Deadline constants. Only PayPal-stated numbers appear here (SNAPSHOT.md section 2,
// drift note 6: "the hub proposal's 20-day inquiry window and 10-day response window
// are PayPal-stated (S1/S2/S8)"). The chargeback response window and the appeal period
// length are NOT STATED and MUST NOT enter this file as numbers.
export const INQUIRY_SELLER_RESPONSE_DAYS = 10; // S8 / S1
export const INQUIRY_STAGE_DAYS = 20;           // S1 / S8

export const LIFECYCLE_STAGES = ['INQUIRY', 'CHARGEBACK', 'PRE_ARBITRATION', 'ARBITRATION'];
export const FUNDING_SOURCES = ['card', 'paypal_balance_or_bank', 'unknown'];
const DAY_MS = 86400000;

// ── Per-PSP deadline tables ───────────────────────────────────────────────────
// One table per PSP, as data. Stage vocabularies, scheme sets and stated numbers
// are each PSP's own, reproduced from its snapshot; every rule cites its clause.
// A window stated only as a range, a "typically" figure or not at all yields
// due null with the reason quoted. The PayPal table is the original behavior
// above; these three feed the same deadline engine.

export const PSPS = ['paypal', 'stripe', 'adyen', 'square'];

const STRIPE_SOURCES = {
  S2: 'https://docs.stripe.com/api/disputes/object',
  S3: 'https://docs.stripe.com/disputes/how-disputes-work',
  S4: 'https://docs.stripe.com/disputes/responding',
};
const ADYEN_SOURCES = {
  A1: 'https://docs.adyen.com/risk-management/disputes-api',
  A3: 'https://docs.adyen.com/risk-management/disputes-api/dispute-notifications',
  A5: 'https://docs.adyen.com/risk-management/understanding-disputes/dispute-timeframes',
  A6: 'https://docs.adyen.com/risk-management/understanding-disputes/dispute-process-and-flow',
};
const SQUARE_SOURCES = {
  Q2: 'https://developer.squareup.com/docs/disputes-api/process-disputes',
  Q3: 'https://developer.squareup.com/docs/disputes-api/sandbox-testing',
  Q4: 'https://github.com/square/connect-api-specification',
  Q5: 'https://developer.squareup.com/reference/square/objects/Dispute',
};

// Stripe snapshot clauses (stripe-disputes-2026-10, fetch 2026-10-26T12Z).
const ST_CLAUSES = {
  status_warning_needs_response: { id: 'S2', quote: 'An inquiry that requires a response.' },
  status_warning_under_review: { id: 'S2', quote: 'An inquiry under review after evidence submission.' },
  status_warning_closed: { id: 'S2', quote: 'An inquiry closed without becoming a formal dispute.' },
  status_needs_response: { id: 'S2', quote: 'A dispute that requires a response.' },
  status_under_review: { id: 'S2', quote: 'A dispute under review after evidence submission.' },
  status_won: { id: 'S2', quote: 'A dispute resolved in the merchant\'s favor.' },
  status_lost: { id: 'S2', quote: 'A dispute resolved in the customer\'s favor.' },
  status_prevented: { id: 'S2', quote: 'A dispute that was prevented from becoming a formal chargeback.' },
  response_window: { id: 'S4', quote: 'you have a limited window to respond (usually 7 to 21 days, depending on the card network)' },
  miss_deadline: { id: 'S4', quote: "If you don't respond before the deadline, you automatically lose the dispute and can't retrieve the disputed funds." },
  inquiry_close: { id: 'S3', quote: 'If an inquiry remains open for 120 days without escalating to a chargeback, Stripe marks it as closed in both the Dashboard and API.' },
  due_by_def: { id: 'S2', quote: 'Date by which evidence must be submitted in order to successfully challenge dispute.' },
  due_by_zero: { id: 'S2', quote: "Will be 0 if the customer's bank or credit card company doesn't allow a response for this particular dispute." },
  issuer_decision: { id: 'S3', quote: 'the issuer has a limited time to evaluate it and decide the outcome: usually 60-75 days, depending on the card network' },
  escalate: { id: 'S4', quote: 'If an inquiry escalates to a chargeback, you must submit another response for the dispute.' },
  ce30: { id: 'S4', quote: 'Stripe automatically evaluates your transaction history to determine eligibility with Visa Compelling Evidence 3.0.' },
};

// Adyen snapshot clauses (adyen-disputes-2026-10, fetch 2026-10-26T12Z).
const AD_CLAUSES = {
  matrix_intro: { id: 'A5', quote: 'The following table shows the timeframe (in calendar days) to exercise and defend a chargeback for various schemes.' },
  noc_defense_start: { id: 'A1', quote: 'This is your starting point for the defense, and marks the start of the defense period.' },
  noc_stage: { id: 'A6', quote: 'A chargeback has been initiated by the issuer, and can be defended.' },
  chargeback_stage: { id: 'A6', quote: 'The disputed amount is withdrawn from your account.' },
  rfi_stage: { id: 'A6', quote: 'The issuer requests more information about the transaction. At this stage, no money is withdrawn from your account.' },
  second_cb: { id: 'A6', quote: 'A second chargeback occurs when the issuer declines your defense, when you or Adyen accept a pre-arbitration case…' },
  cb_reversed: { id: 'A6', quote: 'The disputed amount is transferred back to your account.' },
  nof_stage: { id: 'A6', quote: 'This is not a dispute, and no money is withdrawn' },
  info_supplied: { id: 'A1', quote: 'After you defend the dispute, you can no longer supply additional information.' },
  visa_9: { id: 'A5', quote: 'From 21 July 2025, the response timeframe for disputes opened on payments processed locally in the United States and Canada is 9 days.' },
  visa_18: { id: 'A5', quote: 'For disputes opened before this date in the United States or Canada, and for all other countries and regions, the response timeframe is 18 days.' },
  klarna_14: { id: 'A5', quote: '14 days for consumer reason codes.' },
  klarna_7: { id: 'A5', quote: '7 days for RFIs with reason code `unauthorized_purchase`.' },
  klarna_96h: { id: 'A5', quote: '96 hours for RFIs with reason code `high_risk_order`.' },
  prearb_reason_code: { id: 'A5', quote: 'The time you have to accept or decline a pre-arbitration case depends on the dispute reason code.' },
  arb_months: { id: 'A5', quote: 'The scheme arbitration process can take several months to complete.' },
};

// Square snapshot clauses (square-disputes-2026-10, fetch 2026-10-26T12Z).
const SQ_CLAUSES = {
  typical: { id: 'Q3', quote: 'A seller typically has 14 days or less to respond to a new dispute.' },
  due_at: { id: 'Q4', quote: 'The deadline by which the seller must respond to the dispute, in RFC 3339 format.' },
  due_at_def: { id: 'Q2', quote: 'the `due_at` deadline by which the seller must respond (by accepting or challenging the dispute)' },
  due_at_expiry: { id: 'Q2', quote: 'If the `due_at` deadline passes with no action from the seller, Square automatically challenges the dispute on the seller\'s behalf.' },
  bank_initiated: { id: 'Q2', quote: 'Dispute objects are created by Square when a bank sends a notification that a cardholder is initiating a chargeback.' },
  state_inquiry_ev: { id: 'Q4', quote: 'The initial state of an inquiry with evidence required' },
  state_inquiry_proc: { id: 'Q4', quote: 'Inquiry evidence has been submitted and the bank is processing the inquiry' },
  state_inquiry_closed: { id: 'Q4', quote: 'The inquiry is complete' },
  state_ev_required: { id: 'Q4', quote: 'The initial state of a dispute with evidence required' },
  state_processing: { id: 'Q4', quote: 'Dispute evidence has been submitted and the bank is processing the dispute' },
  state_won: { id: 'Q4', quote: 'The bank has completed processing the dispute and the seller has won' },
  state_lost: { id: 'Q4', quote: 'The bank has completed processing the dispute and the seller has lost' },
  state_accepted: { id: 'Q4', quote: 'The seller has accepted the dispute' },
};

function pspClause(sources, clauses, key) {
  const c = clauses[key];
  return { id: c.id, quote: c.quote, url: sources[c.id] };
}
function stClause(key) { return pspClause(STRIPE_SOURCES, ST_CLAUSES, key); }
function adClause(key) { return pspClause(ADYEN_SOURCES, AD_CLAUSES, key); }
function sqClause(key) { return pspClause(SQUARE_SOURCES, SQ_CLAUSES, key); }

// Stripe lifecycle stages: the Dispute object `status` enum (S2, 8 values, verbatim).
export const STRIPE_STAGES = [
  'warning_needs_response', 'warning_under_review', 'warning_closed',
  'needs_response', 'under_review', 'won', 'lost', 'prevented',
];
// Stripe inquiry stages (the warning_* family) carry the stated 120-day auto-close
// (S3 inquiry_close); the formal-dispute response stage is needs_response.
export const STRIPE_INQUIRY_CLOSE_DAYS = 120; // S3

// Adyen lifecycle stages: the core dispute-flow webhook eventCodes (A3/A6).
// Outcome-only event codes (e.g. PREARBITRATION_WON, SCHEME_ARBITRATION_LOST) carry
// no deadline rule and are refused by name below.
export const ADYEN_STAGES = [
  'NOTIFICATION_OF_FRAUD', 'REQUEST_FOR_INFORMATION', 'NOTIFICATION_OF_CHARGEBACK',
  'CHARGEBACK', 'INFORMATION_SUPPLIED', 'CHARGEBACK_REVERSED', 'SECOND_CHARGEBACK',
  'PREARBITRATION_OPEN', 'SCHEME_ARBITRATION',
];
// Adyen scheme keys = the A5 timeframe-matrix columns (normalized lowercase).
export const ADYEN_SCHEMES = [
  'visa', 'mastercard', 'amex', 'diners', 'discover', 'cup', 'jcb', 'affirm',
  'afterpay_clearpay', 'klarna', 'nyce', 'pulse', 'accel_star', 'twint',
];
// Card-network schemes (the CE3.0-shaped bundle's rail set; non-card schemes like
// TWINT, Affirm, Afterpay/Clearpay and Klarna are scheme rails but not card networks).
export const ADYEN_CARD_SCHEMES = ['visa', 'mastercard', 'amex', 'diners', 'discover', 'cup', 'jcb'];
// A5 matrix row "Your response (from RFI date)" — calendar days per scheme; null =
// the matrix cell is n/a or the cell carries multiple reason-dependent values.
export const ADYEN_RFI_RESPONSE_DAYS = {
  amex: 14, diners: 18, discover: 18, cup: 30, jcb: 18, afterpay_clearpay: 13,
};
// A5 matrix row "Your response to Chargeback (from NoC date)" — calendar days per
// scheme; visa is null because the snapshot states BOTH 9 and 18 days (two
// footnoted conditions this calculator cannot distinguish); klarna and
// afterpay_clearpay are n/a cells in that row.
export const ADYEN_NOC_RESPONSE_DAYS = {
  mastercard: 40, amex: 14, diners: 25, discover: 25, cup: 30, jcb: 40,
  affirm: 15, nyce: 30, pulse: 30, accel_star: 30, twint: 10,
};

// Square lifecycle states: the DisputeState enum (Q4, 8 values, verbatim).
export const SQUARE_STAGES = [
  'INQUIRY_EVIDENCE_REQUIRED', 'INQUIRY_PROCESSING', 'INQUIRY_CLOSED',
  'EVIDENCE_REQUIRED', 'PROCESSING', 'WON', 'LOST', 'ACCEPTED',
];

// Per-PSP table view (data only; the engine functions below read these).
export const PSP_TABLES = {
  paypal: {
    stages: LIFECYCLE_STAGES,
    network_chargeback_stages: ['CHARGEBACK'],
  },
  stripe: {
    stages: STRIPE_STAGES,
    // needs_response is the formal-dispute response stage (S2); warning_* are
    // inquiries and prevented never became a chargeback.
    network_chargeback_stages: ['needs_response'],
  },
  adyen: {
    stages: ADYEN_STAGES,
    // NoC opens the defense period (A1); the CHARGEBACK debit stage is the same
    // scheme chargeback. RFI/NOF are not disputes; post-defense stages carry no
    // response window.
    network_chargeback_stages: ['NOTIFICATION_OF_CHARGEBACK', 'CHARGEBACK'],
  },
  square: {
    stages: SQUARE_STAGES,
    // Every Square Dispute is a bank-initiated card chargeback (Q2); EVIDENCE_REQUIRED
    // is its response stage. INQUIRY_* states precede a formal dispute.
    network_chargeback_stages: ['EVIDENCE_REQUIRED'],
  },
};

// Reason -> evidence mapping, VERBATIM from paypal-agent-shop/lib/disputes.js
// (the lib's REASON_EVIDENCE map). Exactly the four lib reasons;
// the other six schema v1.12 enum values (SNAPSHOT.md section 3) are refused, never
// guessed, mirroring the lib's UnknownDisputeReasonError refusal.
export const REASON_EVIDENCE = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: {
    evidence_type: 'PROOF_OF_FULFILLMENT',
    required: ['carrier_name', 'tracking_number'],
    why: 'prove delivery: carrier name + tracking number for the shipment',
  },
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: {
    evidence_type: 'OTHER',
    required: ['notes'],
    why: 'product description proving as-described condition, or the return policy text',
  },
  // British spelling UNAUTHORISED is PayPal's exact enum spelling (SNAPSHOT.md section 3:
  // "UNAUTHORISED (British S; not UNAUTHORIZED)").
  UNAUTHORISED: {
    evidence_type: 'PROOF_OF_FULFILLMENT',
    required: ['carrier_name', 'tracking_number'],
    why: 'prove the goods reached the cardholder (or their address) with carrier + tracking',
  },
  CREDIT_NOT_PROCESSED: {
    evidence_type: 'PROOF_OF_REFUND',
    required: ['refund_id'],
    why: 'the refund transaction id showing the credit was issued',
  },
};

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_paypal_response',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// ISO-8601 UTC timestamp validation: YYYY-MM-DDTHH:MM:SS(.SSS)?Z only (the snapshot's
// seller_response_due_date format, S5: yyyy-MM-ddTHH:mm:ss.SSSZ). No local offsets.
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function parseIsoUtc(v) {
  if (typeof v !== 'string' || !ISO_UTC_RE.test(v)) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  // Reject rollover dates (e.g. 2026-02-30): re-serialize and compare against the
  // input with milliseconds normalized to .SSS form.
  const m = v.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d{1,3})?Z$/);
  const normalized = m[1] + (m[2] ? m[2].padEnd(4, '0') : '.000') + 'Z';
  if (new Date(ms).toISOString() !== normalized) return null;
  return ms;
}

function isoOf(ms) { return new Date(ms).toISOString(); }

function isBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

// jcsCanonical — byte-identical inline copy of _hash.mjs jcsStringify (RFC 8785-aligned
// recursive member sort by UTF-16 code unit). Inlined, like art-774's _hmacSha256,
// because the VM-1a QuickJS leg executes compute() standalone and cannot resolve the
// shared-module import; the proptest P4 differential pins this copy byte-for-byte
// against _hash.mjs's own jcsStringify, so it cannot drift.
export function jcsCanonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) {
    let s = '[';
    for (let i = 0; i < v.length; i++) {
      if (i) s += ',';
      const e = v[i];
      s += (e === undefined || typeof e === 'function' || typeof e === 'symbol') ? 'null' : jcsCanonical(e);
    }
    return s + ']';
  }
  const keys = Object.keys(v).sort();
  let s = '{', first = true;
  for (const k of keys) {
    const e = v[k];
    if (e === undefined || typeof e === 'function' || typeof e === 'symbol') continue;
    if (!first) s += ',';
    first = false;
    s += JSON.stringify(k) + ':' + jcsCanonical(e);
  }
  return s + '}';
}

// UTF-8 encoder as a plain loop (shape copied from art-774's _utf8Bytes): the zkVM
// guest has no TextEncoder, so the kernel must not call it.
function utf8Bytes(str) {
  const s = String(str);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const hi = c, lo = s.charCodeAt(++i);
      const cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

// Pure-JS SHA-256 (FIPS 180-4), sync leg for the delivery_proof element digest. This is
// a real SHA-256, not a stand-in; the proptest diffs it against node:crypto. The
// ARTIFACT execution_hash is NOT computed here, it stays on the shared WebCrypto
// executionHash path in buildArtifact.
const K256 = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];
function sha256HexSync(str) {
  const bytes = utf8Bytes(str);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const w = new Int32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getInt32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i-15]>>>7)|(w[i-15]<<25)) ^ ((w[i-15]>>>18)|(w[i-15]<<14)) ^ (w[i-15]>>>3);
      const s1 = ((w[i-2]>>>17)|(w[i-2]<<15)) ^ ((w[i-2]>>>19)|(w[i-2]<<13)) ^ (w[i-2]>>>10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K256[i] + w[i]) | 0;
      const S0 = ((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map((x)=>(x>>>0).toString(16).padStart(8,'0')).join('');
}

function refusedPayload(code, detail) {
  return {
    refused: code,
    detail,
    domain_errors: [{ code }],
    refusal_reason: code,
  };
}

function deadlineBlock(dueMs, asOfMs, source, basis) {
  if (dueMs === null) {
    return {
      due: null,
      source,
      basis,
      days_remaining: null,
      past_due: null,
    };
  }
  const days = Math.floor((dueMs - asOfMs) / DAY_MS);
  return {
    due: isoOf(dueMs),
    source,
    basis,
    days_remaining: days,
    past_due: days < 0,
  };
}

// ── Shared deadline engine over the per-PSP tables ────────────────────────────
// Same output envelope as the PayPal path (field names verbatim), same timestamp
// refusals, same CE3.0-shaped bundle (art-297's field names). Deadlines come from
// the selected PSP's table; every rule cites its own snapshot's clause; a window
// the snapshot states only as a range, a typical figure, or not at all returns
// due null with the reason quoted. The PayPal reason map and its evidence
// vocabulary do not apply here: required_evidence is null with a reason rather
// than guessed.
function computePspTable(pp, pspKey) {
  const table = PSP_TABLES[pspKey];

  const stage = pp.lifecycle_stage;
  if (typeof stage !== 'string' || !table.stages.includes(stage)) {
    return {
      output_payload: refusedPayload(
        'REFUSED_UNKNOWN_LIFECYCLE_STAGE',
        'lifecycle_stage for psp ' + pspKey + ' must be one of ' + table.stages.join(', ') +
          '; received ' + JSON.stringify(stage ?? null) +
          (pspKey === 'adyen' ? '. Outcome-only webhook event codes carry no deadline rule.' : '')
      ),
      compliance_flags: ['ART775_INPUT_REFUSED'],
    };
  }

  // funding_source is a PayPal-path input (PayPal's own funding enum). None of
  // these three tables has a funding dimension: Stripe's rail enters through
  // card_network (card vs local payment method), Adyen's through the scheme, and
  // Square's disputes are bank-initiated card chargebacks by definition.
  if (!isBlank(pp.funding_source)) {
    return {
      output_payload: refusedPayload(
        'REFUSED_FUNDING_SOURCE_NOT_APPLICABLE',
        'funding_source is a PayPal-path input and is not part of the ' + pspKey +
          ' deadline table; received ' + JSON.stringify(pp.funding_source) +
          '. The payment rail for this PSP enters through its own vocabulary (Stripe: card_network card vs local payment method; Adyen: the scheme in card_network; Square: bank-initiated card chargeback).'
      ),
      compliance_flags: ['ART775_INPUT_REFUSED'],
    };
  }

  const createMs = parseIsoUtc(pp.dispute_create_time);
  if (createMs === null) {
    return {
      output_payload: refusedPayload(
        'REFUSED_BAD_DISPUTE_CREATE_TIME',
        'dispute_create_time must be an ISO-8601 UTC timestamp YYYY-MM-DDTHH:MM:SS(.SSS)Z; received ' +
          JSON.stringify(pp.dispute_create_time ?? null)
      ),
      compliance_flags: ['ART775_INPUT_REFUSED'],
    };
  }

  const asOfMs = parseIsoUtc(pp.as_of);
  if (asOfMs === null) {
    return {
      output_payload: refusedPayload(
        'REFUSED_BAD_AS_OF',
        'as_of must be an ISO-8601 UTC timestamp YYYY-MM-DDTHH:MM:SS(.SSS)Z; the kernel never reads a wall clock; received ' +
          JSON.stringify(pp.as_of ?? null)
      ),
      compliance_flags: ['ART775_INPUT_REFUSED'],
    };
  }

  let passthroughMs = null;
  if (!isBlank(pp.seller_response_due_date)) {
    passthroughMs = parseIsoUtc(pp.seller_response_due_date);
    if (passthroughMs === null) {
      return {
        output_payload: refusedPayload(
          'REFUSED_BAD_SELLER_RESPONSE_DUE_DATE',
          'seller_response_due_date, when supplied, must be an ISO-8601 UTC timestamp YYYY-MM-DDTHH:MM:SS(.SSS)Z; received ' +
            JSON.stringify(pp.seller_response_due_date)
        ),
        compliance_flags: ['ART775_INPUT_REFUSED'],
      };
    }
  }

  const eh = (pp.evidence_on_hand && typeof pp.evidence_on_hand === 'object') ? pp.evidence_on_hand : {};
  const evidenceEcho = {
    carrier_name: typeof eh.carrier_name === 'string' && !isBlank(eh.carrier_name) ? eh.carrier_name : null,
    tracking_number: typeof eh.tracking_number === 'string' && !isBlank(eh.tracking_number) ? eh.tracking_number : null,
    refund_id: typeof eh.refund_id === 'string' && !isBlank(eh.refund_id) ? eh.refund_id : null,
    notes: typeof eh.notes === 'string' && !isBlank(eh.notes) ? eh.notes : null,
  };
  const fulfillmentComplete = evidenceEcho.carrier_name !== null && evidenceEcho.tracking_number !== null;

  const transactionRef = typeof pp.transaction_ref === 'string' && !isBlank(pp.transaction_ref) ? pp.transaction_ref : null;
  const cardNetwork = typeof pp.card_network === 'string' && !isBlank(pp.card_network) ? pp.card_network : null;
  const scheme = pspKey === 'adyen' && cardNetwork !== null ? cardNetwork.toLowerCase() : null;

  const reasonEcho = typeof pp.dispute_reason === 'string' && !isBlank(pp.dispute_reason) ? pp.dispute_reason : null;

  const citedClauses = [];
  let sellerResponse;
  let inquiryStage = null;

  if (pspKey === 'stripe') {
    if (passthroughMs !== null) {
      sellerResponse = deadlineBlock(
        passthroughMs, asOfMs, 'passthrough',
        'seller_response_due_date passthrough: Stripe evidence_details.due_by is "Date by which evidence must be submitted in order to successfully challenge dispute." (S2); "Will be 0 if the customer\'s bank or credit card company doesn\'t allow a response for this particular dispute." (S2); consequence "If you don\'t respond before the deadline, you automatically lose the dispute and can\'t retrieve the disputed funds." (S4)'
      );
      citedClauses.push(stClause('due_by_def'), stClause('due_by_zero'), stClause('miss_deadline'));
    } else if (stage === 'needs_response' || stage === 'warning_needs_response') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        'Stripe response window in days: NOT STATED as a single number. Stripe states "you have a limited window to respond (usually 7 to 21 days, depending on the card network)" (S4) — a card-network range — and the day-count formula behind evidence_details.due_by is not stated (S2 returns the timestamp only). Supply seller_response_due_date to pass Stripe\'s own due_by timestamp through.'
      );
      citedClauses.push(stClause('response_window'), stClause('due_by_def'));
    } else if (stage === 'under_review' || stage === 'warning_under_review') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        'Response already submitted; the response window is spent. Issuer decision window: "the issuer has a limited time to evaluate it and decide the outcome: usually 60-75 days, depending on the card network" (S3) — a range, not a computable date.'
      );
      citedClauses.push(stClause(stage === 'under_review' ? 'status_under_review' : 'status_warning_under_review'), stClause('issuer_decision'));
    } else if (stage === 'warning_closed') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        '"An inquiry closed without becoming a formal dispute." (S2): closed inquiry, no response deadline.'
      );
      citedClauses.push(stClause('status_warning_closed'));
    } else if (stage === 'prevented') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        '"A dispute that was prevented from becoming a formal chargeback." (S2): prevented dispute, no response deadline.'
      );
      citedClauses.push(stClause('status_prevented'));
    } else {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        (stage === 'won' ? '"A dispute resolved in the merchant\'s favor."' : '"A dispute resolved in the customer\'s favor."') +
          ' (S2): decided dispute, no response deadline.'
      );
      citedClauses.push(stClause(stage === 'won' ? 'status_won' : 'status_lost'));
    }
    if (stage === 'warning_needs_response' || stage === 'warning_under_review') {
      inquiryStage = deadlineBlock(
        createMs + STRIPE_INQUIRY_CLOSE_DAYS * DAY_MS, asOfMs, 'snapshot_rule_120_day',
        'Snapshot rule: "If an inquiry remains open for 120 days without escalating to a chargeback, Stripe marks it as closed in both the Dashboard and API." (S3); escalation consequence "If an inquiry escalates to a chargeback, you must submit another response for the dispute." (S4)'
      );
      citedClauses.push(stClause('inquiry_close'), stClause('escalate'));
    }
  } else if (pspKey === 'adyen') {
    if (passthroughMs !== null) {
      sellerResponse = deadlineBlock(
        passthroughMs, asOfMs, 'passthrough',
        'seller_response_due_date passthrough (caller-supplied due timestamp): Adyen\'s fetched pages state no deadline-date field on the dispute object (NOT STATED); the stated anchor is the Notification of Chargeback, which "marks the start of the defense period" (A1).'
      );
      citedClauses.push(adClause('noc_defense_start'));
    } else if (stage === 'NOTIFICATION_OF_CHARGEBACK') {
      if (scheme === null) {
        sellerResponse = deadlineBlock(
          null, asOfMs, 'not_stated',
          'Scheme not supplied. Adyen\'s timeframes are per scheme: "The following table shows the timeframe (in calendar days) to exercise and defend a chargeback for various schemes." (A5). Supply card_network (one of ' + ADYEN_SCHEMES.join(', ') + ') or seller_response_due_date.'
        );
        citedClauses.push(adClause('matrix_intro'));
      } else if (scheme === 'visa') {
        sellerResponse = deadlineBlock(
          null, asOfMs, 'not_stated',
          'Visa chargeback response window: NOT STATED as a single number. BOTH conditions are stated and this calculator cannot distinguish them. "From 21 July 2025, the response timeframe for disputes opened on payments processed locally in the United States and Canada is 9 days." (A5); "For disputes opened before this date in the United States or Canada, and for all other countries and regions, the response timeframe is 18 days." (A5). The payment\'s processing region is not an input, so no number is chosen. Supply seller_response_due_date.'
        );
        citedClauses.push(adClause('visa_9'), adClause('visa_18'));
      } else if (Object.prototype.hasOwnProperty.call(ADYEN_NOC_RESPONSE_DAYS, scheme)) {
        const n = ADYEN_NOC_RESPONSE_DAYS[scheme];
        sellerResponse = deadlineBlock(
          createMs + n * DAY_MS, asOfMs, 'snapshot_rule_matrix_noc',
          'Snapshot rule: Adyen timeframe-matrix row "Your response to Chargeback (from NoC date)", ' + scheme + ' column, ' + n + ' calendar days (A5); anchor: dispute_create_time as the NoC timestamp, which "marks the start of the defense period" (A1); "A chargeback has been initiated by the issuer, and can be defended." (A6).'
        );
        citedClauses.push(adClause('matrix_intro'), adClause('noc_defense_start'), adClause('noc_stage'));
      } else {
        sellerResponse = deadlineBlock(
          null, asOfMs, 'not_stated',
          'Response window for scheme ' + JSON.stringify(scheme) + ' at this stage: NOT STATED (the A5 matrix cell is n/a for this scheme in this row; columns: ' + ADYEN_SCHEMES.join(', ') + '). No number is stated for this scheme and stage. Supply seller_response_due_date.'
        );
        citedClauses.push(adClause('matrix_intro'));
      }
    } else if (stage === 'REQUEST_FOR_INFORMATION') {
      if (scheme === null) {
        sellerResponse = deadlineBlock(
          null, asOfMs, 'not_stated',
          'Scheme not supplied. Adyen\'s timeframes are per scheme: "The following table shows the timeframe (in calendar days) to exercise and defend a chargeback for various schemes." (A5). Supply card_network (one of ' + ADYEN_SCHEMES.join(', ') + ') or seller_response_due_date.'
        );
        citedClauses.push(adClause('matrix_intro'));
      } else if (scheme === 'klarna') {
        sellerResponse = deadlineBlock(
          null, asOfMs, 'not_stated',
          'Klarna RFI response window: NOT STATED as a single number. THREE reason-dependent values are stated and no reason code is an input. "14 days for consumer reason codes." (A5); "7 days for RFIs with reason code `unauthorized_purchase`." (A5); "96 hours for RFIs with reason code `high_risk_order`." (A5). No number is chosen. Supply seller_response_due_date.'
        );
        citedClauses.push(adClause('klarna_14'), adClause('klarna_7'), adClause('klarna_96h'));
      } else if (Object.prototype.hasOwnProperty.call(ADYEN_RFI_RESPONSE_DAYS, scheme)) {
        const n = ADYEN_RFI_RESPONSE_DAYS[scheme];
        sellerResponse = deadlineBlock(
          createMs + n * DAY_MS, asOfMs, 'snapshot_rule_matrix_rfi',
          'Snapshot rule: Adyen timeframe-matrix row "Your response (from RFI date)", ' + scheme + ' column, ' + n + ' calendar days (A5); anchor: dispute_create_time as the RFI timestamp; "The issuer requests more information about the transaction. At this stage, no money is withdrawn from your account." (A6).'
        );
        citedClauses.push(adClause('matrix_intro'), adClause('rfi_stage'));
      } else {
        sellerResponse = deadlineBlock(
          null, asOfMs, 'not_stated',
          'Response window for scheme ' + JSON.stringify(scheme) + ' at the RFI stage: NOT STATED (the A5 "Your response (from RFI date)" row lists n/a for this scheme; visa and mastercard are n/a cells there; columns: ' + ADYEN_SCHEMES.join(', ') + '). Supply seller_response_due_date.'
        );
        citedClauses.push(adClause('matrix_intro'));
      }
    } else if (stage === 'CHARGEBACK') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        'Deadline from this stage\'s own timestamp: NOT STATED. The A5 response row is anchored "from NoC date", and the NoC is what "marks the start of the defense period" (A1); "The disputed amount is withdrawn from your account." (A6) is the debit that follows. Supply the NoC timestamp as dispute_create_time with stage NOTIFICATION_OF_CHARGEBACK for the matrix rule, or pass seller_response_due_date.'
      );
      citedClauses.push(adClause('noc_defense_start'), adClause('chargeback_stage'));
    } else if (stage === 'PREARBITRATION_OPEN') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        'Pre-arbitration accept/decline window in days: NOT STATED. "The time you have to accept or decline a pre-arbitration case depends on the dispute reason code." (A5); no number.'
      );
      citedClauses.push(adClause('prearb_reason_code'));
    } else if (stage === 'SCHEME_ARBITRATION') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        'Scheme arbitration duration in days: NOT STATED. "The scheme arbitration process can take several months to complete." (A5); no number.'
      );
      citedClauses.push(adClause('arb_months'));
    } else if (stage === 'NOTIFICATION_OF_FRAUD') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        'NOF response window: NOT STATED. "This is not a dispute, and no money is withdrawn" (A6): a fraud notification carries no response deadline.'
      );
      citedClauses.push(adClause('nof_stage'));
    } else if (stage === 'INFORMATION_SUPPLIED') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        'Response window after defense: NOT STATED as a remaining deadline. "After you defend the dispute, you can no longer supply additional information." (A1): the response is made; the final-decision window runs from the defense date (A5 matrix), which this calculator does not take as an input.'
      );
      citedClauses.push(adClause('info_supplied'));
    } else if (stage === 'CHARGEBACK_REVERSED') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        'Merchant response window in this stage: NOT STATED. "The disputed amount is transferred back to your account." (A6): the issuer reviews the defense in this stage; no merchant response window is stated.'
      );
      citedClauses.push(adClause('cb_reversed'));
    } else {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        'Second-chargeback response window: NOT STATED. "A second chargeback occurs when the issuer declines your defense, when you or Adyen accept a pre-arbitration case…" (A6): the A5 matrix states no response window for second chargebacks.'
      );
      citedClauses.push(adClause('second_cb'));
    }
  } else {
    // square
    if (passthroughMs !== null) {
      sellerResponse = deadlineBlock(
        passthroughMs, asOfMs, 'passthrough',
        'seller_response_due_date passthrough: Square due_at is "The deadline by which the seller must respond to the dispute, in RFC 3339 format." (Q4); "the `due_at` deadline by which the seller must respond (by accepting or challenging the dispute)" (Q2); consequence "If the `due_at` deadline passes with no action from the seller, Square automatically challenges the dispute on the seller\'s behalf." (Q2)'
      );
      citedClauses.push(sqClause('due_at'), sqClause('due_at_def'), sqClause('due_at_expiry'));
    } else if (stage === 'EVIDENCE_REQUIRED' || stage === 'INQUIRY_EVIDENCE_REQUIRED') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        'Square response window in days: NOT STATED as a rule number. "A seller typically has 14 days or less to respond to a new dispute." (Q3) is a typical figure, not a stated window; the per-dispute deadline is due_at, "The deadline by which the seller must respond to the dispute, in RFC 3339 format." (Q4). Supply seller_response_due_date to pass Square\'s own due_at through.'
      );
      citedClauses.push(sqClause('typical'), sqClause('due_at'));
    } else if (stage === 'PROCESSING' || stage === 'INQUIRY_PROCESSING') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        (stage === 'PROCESSING' ? '"Dispute evidence has been submitted and the bank is processing the dispute"' : '"Inquiry evidence has been submitted and the bank is processing the inquiry"') +
          ' (Q4): evidence is in; the bank decision window in days is not stated on the fetched pages.'
      );
      citedClauses.push(sqClause(stage === 'PROCESSING' ? 'state_processing' : 'state_inquiry_proc'));
    } else if (stage === 'INQUIRY_CLOSED') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        '"The inquiry is complete" (Q4): closed inquiry, no response deadline.'
      );
      citedClauses.push(sqClause('state_inquiry_closed'));
    } else if (stage === 'ACCEPTED') {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        '"The seller has accepted the dispute" (Q4): accepted dispute, no response deadline.'
      );
      citedClauses.push(sqClause('state_accepted'));
    } else {
      sellerResponse = deadlineBlock(
        null, asOfMs, 'not_stated',
        (stage === 'WON' ? '"The bank has completed processing the dispute and the seller has won"' : '"The bank has completed processing the dispute and the seller has lost"') +
          ' (Q4): decided dispute, no response deadline.'
      );
      citedClauses.push(sqClause(stage === 'WON' ? 'state_won' : 'state_lost'));
    }
  }

  // Network-shaped evidence: only where this PSP's snapshot says the dispute is a
  // network chargeback (the table's network_chargeback_stages), on a card rail
  // where the PSP's own vocabulary carries one.
  const networkStage = table.network_chargeback_stages.includes(stage);
  let ce30Applicable = false;
  let bundleReason;
  if (!networkStage) {
    if (pspKey === 'stripe') {
      bundleReason = stage.startsWith('warning_')
        ? 'Inquiry stage: ' + (stage === 'warning_needs_response' ? '"An inquiry that requires a response."' : stage === 'warning_under_review' ? '"An inquiry under review after evidence submission."' : '"An inquiry closed without becoming a formal dispute."') + ' (S2) — not a formal dispute, so no network evidence bundle. ' + (stage === 'warning_needs_response' ? 'If it escalates, "If an inquiry escalates to a chargeback, you must submit another response for the dispute." (S4)' : '')
        : 'No network evidence bundle: ' + (stage === 'prevented' ? '"A dispute that was prevented from becoming a formal chargeback."' : stage === 'under_review' ? '"A dispute under review after evidence submission."' : 'the dispute is decided') + ' (S2) — no live network-chargeback response.';
    } else if (pspKey === 'adyen') {
      bundleReason = stage === 'NOTIFICATION_OF_FRAUD'
        ? '"This is not a dispute, and no money is withdrawn" (A6): informational fraud notification, no network evidence bundle.'
        : stage === 'REQUEST_FOR_INFORMATION'
          ? '"The issuer requests more information about the transaction. At this stage, no money is withdrawn from your account." (A6): information request, not a chargeback; no network evidence bundle.'
          : 'No network evidence bundle at this stage (' + stage + '): the snapshot places the defendable network chargeback at the Notification of Chargeback ("A chargeback has been initiated by the issuer, and can be defended." (A6)).';
    } else {
      bundleReason = stage.startsWith('INQUIRY_')
        ? 'Inquiry state (' + stage + ', Q4): not a formal dispute; no network evidence bundle.'
        : 'No network evidence bundle: ' + stage + ' (Q4) carries no live evidence submission.';
    }
  } else if (pspKey === 'stripe') {
    if (cardNetwork === null) {
      ce30Applicable = false;
      bundleReason = 'CE3.0-shaped bundle withheld: card_network not supplied. "A dispute that requires a response." (S2) is a formal dispute, but the status alone does not state the funding rail (card vs local payment method; Stripe states LPM disputes exist), and CE3.0 is a card-network program. Supply card_network to attest the card rail.';
    } else {
      ce30Applicable = true;
      bundleReason = 'Formal dispute at the response stage ("A dispute that requires a response." (S2)) on the card rail ' + JSON.stringify(cardNetwork) + '; Stripe itself runs the card-network program here: "Stripe automatically evaluates your transaction history to determine eligibility with Visa Compelling Evidence 3.0." (S4). CE3.0-shaped bundle emitted for consumption by art-297.';
    }
  } else if (pspKey === 'adyen') {
    if (scheme !== null && ADYEN_CARD_SCHEMES.includes(scheme)) {
      ce30Applicable = true;
      bundleReason = (stage === 'NOTIFICATION_OF_CHARGEBACK'
        ? '"A chargeback has been initiated by the issuer, and can be defended." (A6) at the stage that "marks the start of the defense period" (A1)'
        : '"The disputed amount is withdrawn from your account." (A6) — the scheme chargeback stage') +
        ', on card-network scheme ' + JSON.stringify(scheme) + '. CE3.0 is a card-network program; CE3.0-shaped bundle emitted for consumption by art-297.';
    } else {
      ce30Applicable = false;
      bundleReason = 'CE3.0-shaped bundle withheld: scheme ' + JSON.stringify(scheme) + ' is not a card-network scheme (card schemes: ' + ADYEN_CARD_SCHEMES.join(', ') + '); CE3.0 is a card-network program and Adyen\'s matrix rails include non-card schemes (A5).';
    }
  } else {
    ce30Applicable = true;
    bundleReason = '"Dispute objects are created by Square when a bank sends a notification that a cardholder is initiating a chargeback." (Q2) — every Square dispute is a bank-initiated card chargeback — at state EVIDENCE_REQUIRED ("The initial state of a dispute with evidence required" (Q4)). CE3.0-shaped bundle emitted for consumption by art-297.';
  }
  const bundleKind = ce30Applicable ? 'ce30_shaped' : null;

  let ce30Bundle = null;
  if (ce30Applicable) {
    const digestPreimage = {
      evidence_type: 'PROOF_OF_FULFILLMENT',
      carrier_name: evidenceEcho.carrier_name,
      tracking_number: evidenceEcho.tracking_number,
    };
    ce30Bundle = {
      label: 'CE3.0-shaped bundle for consumption by art-297 (mcp:lint_compelling_evidence_ce30_agentic); Visa CE3.0 is a card-network program, not a ' + pspKey + ' one',
      dispute: {
        network: cardNetwork,
        reason_code: null,
        transaction_ref: transactionRef,
      },
      evidence: {
        ap2_mandate: null,
        tap_signature: null,
        agentic_token: null,
        delivery_proof: fulfillmentComplete
          ? {
              digest: sha256HexSync(jcsCanonical(digestPreimage)),
              bound_transaction_ref: transactionRef,
            }
          : null,
        prior_transactions: null,
      },
      null_fields_note: 'ap2_mandate, tap_signature, agentic_token: no ' + pspKey + ' counterpart in its fetched snapshot (no such fields in ' + (pspKey === 'stripe' ? 'the dispute object\'s evidence object (S2)' : pspKey === 'adyen' ? 'the defense document types (A2)' : 'the Disputes API evidence types (Q4)') + '). reason_code: ' + (pspKey === 'stripe' ? 'Stripe exposes the network reason code as payment_method_details.card.network_reason_code (S2); this calculator takes no such input' : 'no ' + pspKey + '-to-network reason-code mapping is stated in the fetched snapshot') + '. prior_transactions: no separate prior-transaction element is stated for ' + pspKey + ' disputes in the fetched snapshot.',
    };
    if (pspKey === 'stripe') citedClauses.push(stClause('status_needs_response'), stClause('ce30'));
    else if (pspKey === 'adyen') citedClauses.push(adClause(stage === 'NOTIFICATION_OF_CHARGEBACK' ? 'noc_stage' : 'chargeback_stage'), adClause('noc_defense_start'));
    else citedClauses.push(sqClause('bank_initiated'), sqClause('state_ev_required'));
  }

  const pfx = pspKey.toUpperCase();
  const complianceFlags = [];
  if (bundleKind === 'ce30_shaped') complianceFlags.push('CE30_SHAPED_BUNDLE_PRODUCED');
  if (sellerResponse.due === null) complianceFlags.push(pfx + '_RESPONSE_DEADLINE_NOT_STATED');
  if (sellerResponse.past_due === true) complianceFlags.push(pfx + '_RESPONSE_PAST_DUE');
  if (inquiryStage !== null && inquiryStage.past_due === true) complianceFlags.push(pfx + '_INQUIRY_WINDOW_ELAPSED');

  const requiredEvidenceWhy = pspKey === 'square'
    ? 'Square\'s per-reason evidence types are suggestions ("These suggestions are based on card network rules to help the seller make their best case when challenging a dispute." (Q2)), not stated requirements; no required list is asserted here.'
    : pspKey === 'stripe'
      ? 'Stripe\'s per-category evidence guidance is preserved in its snapshot only as raw captures, not as a re-typed table; no evidence requirement is guessed here.'
      : 'Adyen\'s per-reason defense requirements are pinned as raw captures in its snapshot ("data too large to retype"); no evidence requirement is guessed here.';

  return {
    output_payload: {
      psp: pspKey,
      dispute_reason: reasonEcho,
      lifecycle_stage: stage,
      funding_source: null,
      dispute_create_time: isoOf(createMs),
      as_of: isoOf(asOfMs),
      deadlines: {
        seller_response: sellerResponse,
        inquiry_stage: inquiryStage,
        escalation_available_until: inquiryStage !== null ? inquiryStage.due : null,
      },
      required_evidence: {
        evidence_type: null,
        required: null,
        why: requiredEvidenceWhy,
      },
      evidence_on_hand: evidenceEcho,
      missing_evidence: null,
      bundle_decision: {
        ce30_applicable: ce30Applicable,
        bundle_kind: bundleKind,
        reason: bundleReason,
      },
      ce30_shaped_bundle: ce30Bundle,
      paypal_process_evidence: null,
      cited_clauses: citedClauses,
      domain_errors: [],
      refusal_reason: null,
    },
    compliance_flags: complianceFlags,
  };
}

/**
 * compute(pp) — pure function of the policy parameters.
 *
 * pp = {
 *   psp:               OPTIONAL 'paypal' (default when absent) | 'stripe' | 'adyen' |
 *                     'square' — selects the deadline table. The PayPal path below is
 *                     the original behavior; the other three run the shared table
 *                     engine (computePspTable) with each PSP's own stage vocabulary.
 *   dispute_reason:   one of the four lib reasons (disputes.js REASON_EVIDENCE keys)
 *                     on the PayPal path; on the other PSP paths an optional verbatim
 *                     echo (their per-reason evidence maps are not re-typed in their
 *                     snapshots, so no reason vocabulary is enforced there)
 *   lifecycle_stage:  PayPal path: 'INQUIRY' | 'CHARGEBACK' | 'PRE_ARBITRATION' | 'ARBITRATION'
 *                     (dispute_life_cycle_stage enum, schema v1.12); other PSP paths:
 *                     that PSP's own stage enum from its snapshot (Stripe `status`,
 *                     Adyen core webhook eventCodes, Square DisputeState)
 *   funding_source:   PayPal path only: 'card' | 'paypal_balance_or_bank' | 'unknown';
 *                     refused on the other PSP paths (no funding dimension there)
 *   dispute_create_time: ISO-8601 UTC timestamp of dispute creation
 *   as_of:            ISO-8601 UTC timestamp days remaining are measured against
 *                     (required; the kernel never reads a wall clock)
 *   seller_response_due_date: OPTIONAL ISO-8601 UTC passthrough. When present it IS the
 *                     seller response deadline (S5 definition); when absent the snapshot's
 *                     stated rule applies for the stage, or null with a reason when the
 *                     snapshot marks the window NOT STATED.
 *   transaction_ref:  OPTIONAL synthetic transaction reference; binds the CE3.0 bundle's
 *                     bound_transaction_ref exactly the way art-297 checks it.
 *   card_network:     OPTIONAL passthrough label (e.g. 'visa') into the CE3.0 bundle's
 *                     dispute.network; PayPal's snapshot states no network mapping.
 *   evidence_on_hand: OPTIONAL { carrier_name?, tracking_number?, refund_id?, notes? }
 *                     (the lib's required context fields, names verbatim).
 * }
 *
 * Returns { output_payload, compliance_flags }. Out-of-domain inputs yield a named
 * refusal payload, never a silent guess.
 */
export function compute(pp) {
  pp = pp || {};
  const pspKey = isBlank(pp.psp) ? 'paypal' : pp.psp;
  if (typeof pspKey !== 'string' || !PSPS.includes(pspKey)) {
    return {
      output_payload: refusedPayload(
        'REFUSED_UNKNOWN_PSP',
        'psp must be one of ' + PSPS.join(', ') +
          '; received ' + JSON.stringify(pp.psp ?? null)
      ),
      compliance_flags: ['ART775_INPUT_REFUSED'],
    };
  }
  if (pspKey !== 'paypal') {
    return computePspTable(pp, pspKey);
  }
  const reason = pp.dispute_reason;
  const spec = REASON_EVIDENCE[reason];
  if (!spec) {
    return {
      output_payload: refusedPayload(
        'REFUSED_UNKNOWN_DISPUTE_REASON',
        'dispute_reason must be one of ' + Object.keys(REASON_EVIDENCE).join(', ') +
          '; received ' + JSON.stringify(reason ?? null) +
          '. Refusing to guess evidence for an unmapped reason.'
      ),
      compliance_flags: ['ART775_INPUT_REFUSED'],
    };
  }

  const stage = pp.lifecycle_stage;
  if (!LIFECYCLE_STAGES.includes(stage)) {
    return {
      output_payload: refusedPayload(
        'REFUSED_UNKNOWN_LIFECYCLE_STAGE',
        'lifecycle_stage must be one of ' + LIFECYCLE_STAGES.join(', ') +
          '; received ' + JSON.stringify(stage ?? null)
      ),
      compliance_flags: ['ART775_INPUT_REFUSED'],
    };
  }

  const funding = pp.funding_source;
  if (!FUNDING_SOURCES.includes(funding)) {
    return {
      output_payload: refusedPayload(
        'REFUSED_UNKNOWN_FUNDING_SOURCE',
        'funding_source must be one of ' + FUNDING_SOURCES.join(', ') +
          '; received ' + JSON.stringify(funding ?? null)
      ),
      compliance_flags: ['ART775_INPUT_REFUSED'],
    };
  }

  const createMs = parseIsoUtc(pp.dispute_create_time);
  if (createMs === null) {
    return {
      output_payload: refusedPayload(
        'REFUSED_BAD_DISPUTE_CREATE_TIME',
        'dispute_create_time must be an ISO-8601 UTC timestamp YYYY-MM-DDTHH:MM:SS(.SSS)Z; received ' +
          JSON.stringify(pp.dispute_create_time ?? null)
      ),
      compliance_flags: ['ART775_INPUT_REFUSED'],
    };
  }

  const asOfMs = parseIsoUtc(pp.as_of);
  if (asOfMs === null) {
    return {
      output_payload: refusedPayload(
        'REFUSED_BAD_AS_OF',
        'as_of must be an ISO-8601 UTC timestamp YYYY-MM-DDTHH:MM:SS(.SSS)Z; the kernel never reads a wall clock; received ' +
          JSON.stringify(pp.as_of ?? null)
      ),
      compliance_flags: ['ART775_INPUT_REFUSED'],
    };
  }

  let passthroughMs = null;
  if (!isBlank(pp.seller_response_due_date)) {
    passthroughMs = parseIsoUtc(pp.seller_response_due_date);
    if (passthroughMs === null) {
      return {
        output_payload: refusedPayload(
          'REFUSED_BAD_SELLER_RESPONSE_DUE_DATE',
          'seller_response_due_date, when supplied, must be an ISO-8601 UTC timestamp YYYY-MM-DDTHH:MM:SS(.SSS)Z; received ' +
            JSON.stringify(pp.seller_response_due_date)
        ),
        compliance_flags: ['ART775_INPUT_REFUSED'],
      };
    }
  }

  const eh = (pp.evidence_on_hand && typeof pp.evidence_on_hand === 'object') ? pp.evidence_on_hand : {};
  const evidenceEcho = {
    carrier_name: typeof eh.carrier_name === 'string' && !isBlank(eh.carrier_name) ? eh.carrier_name : null,
    tracking_number: typeof eh.tracking_number === 'string' && !isBlank(eh.tracking_number) ? eh.tracking_number : null,
    refund_id: typeof eh.refund_id === 'string' && !isBlank(eh.refund_id) ? eh.refund_id : null,
    notes: typeof eh.notes === 'string' && !isBlank(eh.notes) ? eh.notes : null,
  };

  const missing = spec.required.filter((f) => evidenceEcho[f] === null);
  const fulfillmentComplete = evidenceEcho.carrier_name !== null && evidenceEcho.tracking_number !== null;
  const refundComplete = evidenceEcho.refund_id !== null;
  const notesComplete = evidenceEcho.notes !== null;

  const transactionRef = typeof pp.transaction_ref === 'string' && !isBlank(pp.transaction_ref) ? pp.transaction_ref : null;
  const cardNetwork = typeof pp.card_network === 'string' && !isBlank(pp.card_network) ? pp.card_network : null;

  // Deadlines. Exactly the snapshot's stated rules; everything else null with a reason.
  let sellerResponse;
  let inquiryStage = null;
  if (passthroughMs !== null) {
    sellerResponse = deadlineBlock(
      passthroughMs, asOfMs, 'passthrough',
      'seller_response_due_date passthrough: "The date and time by when the merchant must respond to the dispute, in Internet date and time format." (S5); consequence "If the merchant does not respond by this date and time, the dispute is closed in the customer\'s favor." (S5)'
    );
  } else if (stage === 'INQUIRY') {
    sellerResponse = deadlineBlock(
      createMs + INQUIRY_SELLER_RESPONSE_DAYS * DAY_MS, asOfMs, 'snapshot_rule_10_day',
      'Snapshot rule: "You must respond within the first 10 days following a dispute creation." (S8); "As a merchant, you can submit supporting documentation within 10 days after the inquiry starts." (S1)'
    );
  } else if (stage === 'CHARGEBACK') {
    sellerResponse = deadlineBlock(
      null, asOfMs, 'not_stated',
      'Chargeback-stage seller response window in days: NOT STATED. PayPal states deadlines exist: "please respond to us promptly as there are strict response deadlines required for chargebacks based on the issuer." (S9); no number on S1-S9. Supply seller_response_due_date to pass PayPal\'s own timestamp through.'
    );
  } else {
    sellerResponse = deadlineBlock(
      null, asOfMs, 'not_stated',
      'Appeal period length (pre-arbitration/arbitration): NOT STATED. PayPal states only "If the merchant does not appeal within the appeal period, the case is considered resolved." (S2); no number. Supply seller_response_due_date to pass PayPal\'s own timestamp through.'
    );
  }

  if (stage === 'INQUIRY') {
    inquiryStage = deadlineBlock(
      createMs + INQUIRY_STAGE_DAYS * DAY_MS, asOfMs, 'snapshot_rule_20_day',
      'Snapshot rule: "The inquiry stage lasts up to 20 days unless escalated to a claim." (S1); "Disputes are closed automatically after 20 days unless you or the buyer escalate it." (S8)'
    );
  }

  // Stage scoping (desk amendment 2026-10-25). CE3.0-shaped bundle ONLY for a
  // chargeback on a card-funded transaction.
  const ce30Applicable = stage === 'CHARGEBACK' && funding === 'card';
  let bundleKind;
  let bundleReason;
  if (ce30Applicable) {
    bundleKind = 'ce30_shaped';
    bundleReason = 'Chargeback on a card-funded transaction: the network dispute case. CE3.0-shaped bundle emitted for consumption by art-297 (mcp:lint_compelling_evidence_ce30_agentic).';
  } else if (funding === 'unknown') {
    bundleKind = null;
    bundleReason = 'CE3.0-shaped bundle withheld: funding_source is unknown. Only a chargeback on a card-funded transaction is a network dispute; the funding source must be known before a network evidence bundle can be produced.';
  } else {
    bundleKind = 'paypal_process_evidence';
    bundleReason = stage === 'CHARGEBACK'
      ? 'Chargeback on a non-card funding source: PayPal buyer-protection process evidence, explicitly not CE3.0.'
      : 'Inquiry or appeal stage: PayPal buyer-protection process evidence, explicitly not CE3.0. CE3.0 does not govern PayPal inquiries, claims or appeals.';
  }

  // CE3.0-shaped bundle: field names are exactly the set art-297 reads (its evalElement
  // walks evidence.ap2_mandate / tap_signature / agentic_token / delivery_proof /
  // prior_transactions, each {digest, bound_transaction_ref}; dispute.network /
  // reason_code / transaction_ref). PayPal has a counterpart ONLY for delivery
  // proof (fulfillment evidence); every other field is null, never renamed.
  let ce30Bundle = null;
  if (ce30Applicable) {
    const digestPreimage = {
      evidence_type: 'PROOF_OF_FULFILLMENT',
      carrier_name: evidenceEcho.carrier_name,
      tracking_number: evidenceEcho.tracking_number,
    };
    ce30Bundle = {
      label: 'CE3.0-shaped bundle for consumption by art-297 (mcp:lint_compelling_evidence_ce30_agentic); Visa CE3.0 is a card-network program, not a PayPal one',
      dispute: {
        network: cardNetwork,
        reason_code: null,
        transaction_ref: transactionRef,
      },
      evidence: {
        ap2_mandate: null,
        tap_signature: null,
        agentic_token: null,
        delivery_proof: fulfillmentComplete
          ? {
              digest: sha256HexSync(jcsCanonical(digestPreimage)),
              bound_transaction_ref: transactionRef,
            }
          : null,
        prior_transactions: null,
      },
      null_fields_note: 'ap2_mandate, tap_signature, agentic_token: no PayPal counterpart (PayPal produces no AP2 mandate, TAP signature or agentic token for a dispute). reason_code: PayPal-to-network reason-code mapping NOT STATED in the PayPal snapshot. prior_transactions: PayPal Disputes API states no prior-transaction linkage data.',
    };
  }

  // paypal_process_evidence: disputes.js evidence types on the schema v1.12
  // evidence_info shape (SNAPSHOT.md section 4: evidence_info has exactly tracking_info
  // and refund_ids; tracking_info -> tracking_info_list, each item carrier_name +
  // tracking_number; refund_ids -> refund_ids_list).
  let paypalBundle = null;
  if (bundleKind === 'paypal_process_evidence') {
    const ev = { evidence_type: spec.evidence_type, evidence_info: {} };
    if (spec.evidence_type === 'PROOF_OF_FULFILLMENT') {
      ev.evidence_info.tracking_info = fulfillmentComplete
        ? { tracking_info_list: [{ carrier_name: evidenceEcho.carrier_name, tracking_number: evidenceEcho.tracking_number }] }
        : {};
    } else if (spec.evidence_type === 'PROOF_OF_REFUND') {
      ev.evidence_info.refund_ids = refundComplete
        ? { refund_ids_list: [evidenceEcho.refund_id] }
        : {};
    }
    if (notesComplete) {
      ev.notes = evidenceEcho.notes;
    }
    paypalBundle = {
      label: 'paypal_process_evidence: PayPal buyer-protection process evidence, explicitly NOT CE3.0 (no card-network compelling-evidence program applies)',
      evidences: [ev],
      submittable: missing.length === 0,
    };
  }

  // Flags are conditional emissions only: each pushes behind
  // the branch that earns it; the payload itself attests the assessment.
  const complianceFlags = [];
  if (bundleKind === 'ce30_shaped') complianceFlags.push('CE30_SHAPED_BUNDLE_PRODUCED');
  if (bundleKind === 'paypal_process_evidence') complianceFlags.push('PAYPAL_PROCESS_EVIDENCE_PRODUCED');
  if (bundleKind === null) complianceFlags.push('CE30_BUNDLE_WITHHELD_UNKNOWN_FUNDING');
  if (sellerResponse.due === null) complianceFlags.push('PAYPAL_RESPONSE_DEADLINE_NOT_STATED');
  if (sellerResponse.past_due === true) complianceFlags.push('PAYPAL_RESPONSE_PAST_DUE');
  if (inquiryStage !== null && inquiryStage.past_due === true) complianceFlags.push('PAYPAL_INQUIRY_WINDOW_ELAPSED');
  if (missing.length > 0) complianceFlags.push('PAYPAL_EVIDENCE_INCOMPLETE');

  // Per-run citation set: only the clauses this output rests on.
  const citedClauses = [];
  if (passthroughMs !== null) {
    citedClauses.push(clause('due_date_definition'), clause('due_date_consequence'));
  } else if (stage === 'INQUIRY') {
    citedClauses.push(
      clause('seller_response_10_day_a'), clause('seller_response_10_day_b'),
      clause('miss_10_day_consequence'), clause('inquiry_20_day'), clause('inquiry_auto_close')
    );
  } else if (stage === 'CHARGEBACK') {
    citedClauses.push(clause('chargeback_is_claim'), clause('chargeback_no_number'));
  } else {
    citedClauses.push(clause('appeal_no_number'));
  }

  return {
    output_payload: {
      dispute_reason: reason,
      lifecycle_stage: stage,
      funding_source: funding,
      dispute_create_time: isoOf(createMs),
      as_of: isoOf(asOfMs),
      deadlines: {
        seller_response: sellerResponse,
        inquiry_stage: inquiryStage,
        escalation_available_until: inquiryStage !== null ? inquiryStage.due : null,
      },
      required_evidence: {
        evidence_type: spec.evidence_type,
        required: spec.required.slice(),
        why: spec.why,
      },
      evidence_on_hand: evidenceEcho,
      missing_evidence: missing,
      bundle_decision: {
        ce30_applicable: ce30Applicable,
        bundle_kind: bundleKind,
        reason: bundleReason,
      },
      ce30_shaped_bundle: ce30Bundle,
      paypal_process_evidence: paypalBundle,
      cited_clauses: citedClauses,
      domain_errors: [],
      refusal_reason: null,
    },
    compliance_flags: complianceFlags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
