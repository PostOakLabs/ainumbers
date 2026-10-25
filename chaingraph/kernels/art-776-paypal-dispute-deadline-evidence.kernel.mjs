// art-776-paypal-dispute-deadline-evidence — PayPal dispute deadline calculator and
// evidence-bundle PRODUCER (PAYPAL-DISPUTE-DEADLINE-NODE-1, built 2026-10-24).
//
// ROLE (hub proposal PAYPAL-HUB-PROPOSALS-2026-10-24.md row 9, as amended by the
// desk amendment of 2026-10-25): this is the PayPal-side PRODUCER that emits a
// CE3.0-shaped bundle consumable by art-297 (mcp:lint_compelling_evidence_ce30_agentic),
// NOT a second linter. art-297 is the Visa CE3.0 TERMINAL linter; it knows no PayPal
// reasons and no PayPal deadlines. This node supplies the PayPal side: deadlines and
// the evidence bundle, with art-297's field names kept verbatim.
//
// CLAUSE AUTHORITY: every clause below is quoted verbatim (each under 25 words) from
// research/clause-snapshots/paypal-disputes-2026-10/SNAPSHOT.md (row
// PAYPAL-DISPUTES-PRIMARY-TEXT-1, fetch 2026-10-25T03Z). A deadline the snapshot marks
// NOT STATED is returned as null with a reason, never guessed. Sources S1-S9 are the
// snapshot's nine PayPal pages; source ids in comments refer to that table.
//
// VOCABULARY: dispute reasons and evidence types are reused VERBATIM from
// paypal-agent-shop/lib/disputes.js (PAYPAL-E6-DISPUTE-EVIDENCE-1). No new reason or
// evidence vocabulary is invented here. An unknown reason is refused, mirroring the
// lib's UnknownDisputeReasonError.
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

// Reason -> evidence mapping, VERBATIM from paypal-agent-shop/lib/disputes.js
// (PAYPAL-E6-DISPUTE-EVIDENCE-1, REASON_EVIDENCE). Exactly the four lib reasons;
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

/**
 * compute(pp) — pure function of the policy parameters.
 *
 * pp = {
 *   dispute_reason:   one of the four lib reasons (disputes.js REASON_EVIDENCE keys)
 *   lifecycle_stage:  'INQUIRY' | 'CHARGEBACK' | 'PRE_ARBITRATION' | 'ARBITRATION'
 *                     (dispute_life_cycle_stage enum, schema v1.12, SNAPSHOT.md section 1)
 *   funding_source:   'card' | 'paypal_balance_or_bank' | 'unknown' (desk amendment 2026-10-25)
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

  // Flags are conditional emissions only (FLAGS-COMPUTED-LINT-1): each pushes behind
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
