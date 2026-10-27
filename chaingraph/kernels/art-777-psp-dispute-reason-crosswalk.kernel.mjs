// art-777-psp-dispute-reason-crosswalk — dispute reason-code crosswalk across
// PayPal, Stripe, Adyen and Square (PSP-DISPUTE-CROSSWALK-NODE-1, built
// 2026-10-26). Static, credential-free: a pure data module plus lookup, no
// network, no PII, no live PSP API. The shape follows the estate's crosswalk
// exemplar art-133 (crosswalk_agent_payment_rail_trust).
//
// SPEC: PAYPAL-HUB-PROPOSALS-2026-10-24.md §10.3(2) as narrowed by the desk
// (2026-10-25): static and credential-free; no competitor live demo or adapter.
//
// CLAUSE AUTHORITY: every mapping cell below cites a clause from one of the four
// primary-text snapshots (row PSP-DISPUTES-PRIMARY-TEXT-1):
//   research/clause-snapshots/paypal-disputes-2026-10/SNAPSHOT.md  (S1-S9)
//   research/clause-snapshots/stripe-disputes-2026-10/SNAPSHOT.md  (S1-S6)
//   research/clause-snapshots/adyen-disputes-2026-10/SNAPSHOT.md   (A1-A6)
//   research/clause-snapshots/square-disputes-2026-10/SNAPSHOT.md  (Q1-Q5)
// Quotes are verbatim and each under 25 words. Enum and reason-code tables are
// reproduced as data (each snapshot's own method). A mapping no snapshot
// supports is `none`, never inferred: a `none` cell carries no value and no
// invented clause. Where a snapshot itself states an absence (Stripe S5 Visa
// table "Unrecognized | None"; Square Q1-Q5 publish no network mapping), that
// stated absence is cited, not guessed.
//
// MATCH GRADES, per cell, each justified by that cell's own clauses:
//   exact   — the PSP's own published buyer-condition sentence, reason enum or
//             category table names the same condition as the concept.
//   partial — the PSP's own published mapping places the condition inside a
//             broader category (e.g. Stripe S5's Fraudulent row spans 10.1-10.5;
//             Square Q4's CANCELLED sentence spans returns AND cancellations),
//             or supports it only via a card-network code landing in an
//             aggregate category.
//   none    — no snapshot support at that PSP.
//
// VOCABULARY: each PSP's reason values are its own exact enum spellings,
// reproduced verbatim from the snapshot tables (PayPal S5 schema v1.12
// dispute_reason including the British "UNAUTHORISED"; Stripe S2 reason;
// Adyen A4 Visa scheme codes; Square Q4 DisputeReason). Nothing renamed.
//
// ADYEN NAMESPACE NOTE: Adyen's published reason codes are scheme codes per
// scheme (A4). The Adyen snapshot reproduces exactly one scheme table as data —
// Visa (A4) — so the Adyen leg of this crosswalk is scoped to Adyen's Visa
// codes; Mastercard/Amex/other scheme tabs are pinned in that snapshot's raw/
// captures and are out of scope here, never guessed.
//
// HASHING: the artifact execution_hash is produced only by the shared
// chaingraph/kernels/_hash.mjs (executionHash over the RFC 8785/JCS canonical
// {policy_parameters, output_payload}) inside buildArtifact. The kernel itself
// hashes nothing.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-777-psp-dispute-reason-crosswalk';
const TOOL_VERSION = '1.0.0';

// Source ids -> URLs, one table per snapshot, exactly the "Sources" tables in
// each SNAPSHOT.md. Only the sources this kernel cites are listed.
const SNAPSHOT_SOURCES = {
  paypal: {
    S3: 'https://developer.paypal.com/disputes/reasons-evidence',
    S5: 'https://developer.paypal.com/api/customer-disputes/v1/schema.json',
  },
  stripe: {
    S2: 'https://docs.stripe.com/api/disputes/object',
    S5: 'https://docs.stripe.com/disputes/categories',
  },
  adyen: {
    A1: 'https://docs.adyen.com/risk-management/disputes-api',
    A2: 'https://docs.adyen.com/risk-management/disputes-api/disputes-api-reference',
    A4: 'https://docs.adyen.com/risk-management/understanding-disputes/dispute-reason-codes',
  },
  square: {
    Q2: 'https://developer.squareup.com/docs/disputes-api/process-disputes',
    Q4: 'https://github.com/square/connect-api-specification',
  },
};

// Verbatim clause quotes (each under 25 words), keyed for per-cell citation.
const CLAUSES = {
  // PayPal (S3 = dispute reasons and evidence page; S5 = OpenAPI schema v1.12)
  pp_enum: { psp: 'paypal', id: 'S5', quote: 'The reason for the item-level dispute.' },
  pp_inr: { psp: 'paypal', id: 'S3', quote: 'The buyer did not receive the merchandise or service.' },
  pp_snad: { psp: 'paypal', id: 'S3', quote: 'The buyer reports that the merchandise or service was not as described.' },
  pp_unauth: { psp: 'paypal', id: 'S3', quote: 'The buyer did not authorize purchase of the merchandise or service.' },
  pp_credit: { psp: 'paypal', id: 'S3', quote: 'The refund or credit transaction was not processed for the buyer.' },
  pp_dup: { psp: 'paypal', id: 'S3', quote: 'The transaction was a duplicate.' },
  pp_amt: { psp: 'paypal', id: 'S3', quote: 'The buyer was charged an incorrect amount.' },
  pp_pom: { psp: 'paypal', id: 'S3', quote: 'The buyer paid for the transaction through other means.' },
  pp_crb: { psp: 'paypal', id: 'S3', quote: 'The buyer was incorrectly charged after canceling the subscription or recurring billing.' },
  // Stripe (S2 = Dispute object; S5 = categories page with the network code map)
  st_reason: { psp: 'stripe', id: 'S2', quote: 'Reason given by cardholder for dispute.' },
  st_netmap: { psp: 'stripe', id: 'S5', quote: 'The following tables show the Stripe categories for each payment method\'s dispute reason codes.' },
  st_105: { psp: 'stripe', id: 'S5', quote: 'Visa disputes with reason code 10.5 are extremely rare and have no recourse to remedy the dispute.' },
  st_debit: { psp: 'stripe', id: 'S5', quote: 'Every dispute for Instant Bank Payments uses the same dispute reason, debit_not_authorized, with the underlying ACH return code shown as the network reason code.' },
  // Adyen (A1 = Disputes API workflow; A2 = defense reason & document codes; A4 = scheme reason codes)
  ad_defense: { psp: 'adyen', id: 'A1', quote: 'Required: You must and can only supply a single document of this defense document type.' },
  ad_codes: { psp: 'adyen', id: 'A2', quote: 'Defense reason codes' },
  // Square (Q2 = Process Disputes evidence suggestions; Q4 = published OpenAPI spec)
  sq_amt: { psp: 'square', id: 'Q4', quote: 'The cardholder claims that they were charged the wrong amount for the purchase.' },
  sq_cancel: { psp: 'square', id: 'Q4', quote: 'The cardholder claims that they attempted to return the goods or cancel the service.' },
  sq_dup: { psp: 'square', id: 'Q4', quote: 'The cardholder claims that they were charged twice for the same purchase.' },
  sq_nok: { psp: 'square', id: 'Q4', quote: 'The cardholder claims that they did not make this purchase nor authorized the charge.' },
  sq_nad: { psp: 'square', id: 'Q4', quote: 'the quality of the deliverable did not align with the expectations' },
  sq_inr: { psp: 'square', id: 'Q4', quote: 'The cardholder claims the product or service was not received by the cardholder within the stated time frame.' },
  sq_pom: { psp: 'square', id: 'Q4', quote: 'The cardholder claims that they previously paid for this purchase.' },
  sq_credit: { psp: 'square', id: 'Q4', quote: 'The cardholder claims that the purchase was canceled or returned, but they have not yet received the credit.' },
  sq_emv: { psp: 'square', id: 'Q4', quote: 'A chip-enabled card was not processed through a compliant chip-card reader (for example, it was swiped instead of dipped into a chip-card reader).' },
  sq_ev_note: { psp: 'square', id: 'Q2', quote: 'These suggestions are based on card network rules to help the seller make their best case when challenging a dispute.' },
  sq_no_netmap: { psp: 'square', id: 'Q4', quote: 'The ID of the dispute in the card brand system, generated by the card brand.' },
};

function clause(key) {
  const c = CLAUSES[key];
  return { id: c.id, quote: c.quote, url: SNAPSHOT_SOURCES[c.psp][c.id] };
}
function clauses(...keys) { return keys.map(clause); }

export const PSPS = ['paypal', 'stripe', 'adyen', 'square'];

// Card-network codes, reproduced as data from Stripe S5's own network code map
// (Visa and Mastercard tables) and Adyen A4's Visa table. Labels verbatim.
const NETWORK_CODES = {
  visa: {
    '10.1': '10.1 EMV Liability Shift Counterfeit Fraud',
    '10.2': '10.2 EMV Liability Shift Non-Counterfeit Fraud',
    '10.4': '10.4 Other Fraud - Card Absent Environment',
    '12.5': '12.5 Incorrect Amount',
    '12.6.1': '12.6.1 Duplicate processing',
    '12.6.2': '12.6.2 Paid by other means',
    '13.1': '13.1 Merchandise/Services Not Received',
    '13.2': '13.2 Canceled Recurring',
    '13.3': '13.3 Not as Described or Defective Merchandise/Services',
    '13.6': '13.6 Credit not processed',
    '13.7': '13.7 Canceled Merchandise/Services',
  },
  mastercard: {
    '4834': '4834 Transaction Amount Differs',
    '4841': '4841 Digital Goods Purchase of USD 25 or Less',
    '4853': '4853 General Defective/Not as Described',
    '4855': '4855 Transaction Did Not Complete',
    '4860': '4860 Credit Not Processed',
    '6305': '6305 Cardholder does not agree with amount billed',
    '6321': '6321 Cardholder does not recognize transaction',
    '6341': '6341 Fraud investigation',
  },
};

// Stripe S5 category membership for Visa codes that have no crosswalk concept
// (data, verbatim rows): the aggregate category each code lands in per S5.
const S5_VISA_CATEGORY_ROWS = {
  fraudulent: ['33 Fraud analysis request', '10.1 EMV Liability Shift Counterfeit Fraud', '10.2 EMV Liability Shift Non-Counterfeit Fraud', '10.3 Other Fraud - Card Present Environment', '10.4 Other Fraud - Card Absent Environment', '10.5 Visa Fraud Monitoring Program'],
  general: ['28', '30', '34', '11.1', '11.2', '11.3', '12.1', '12.2', '12.3', '12.4', '12.5', '12.7', '13.8'],
};

function noneCell(psp, basis) {
  return { psp, value: null, match: 'none', basis, evidence_categories: null, clauses: [] };
}

// Square publishes no reason-to-network mapping (Q1-Q5): one stated-absence
// clause reused wherever a Square network mapping would otherwise be invented.
const SQ_NO_NETMAP_BASIS =
  'Q1-Q5 publish no mapping from Square reasons to card-network reason codes; the Dispute object carries brand_dispute_id ("The ID of the dispute in the card brand system, generated by the card brand." (Q4)) and card_brand but no network reason-code field.';

// Adyen evidence leg, identical for every Adyen cell: the defense workflow is
// per dispute, not per concept, and is pinned by A1/A2.
function adyenEvidenceCell(value, gradeBasis, clauseKeys) {
  return {
    psp: 'adyen',
    value,
    match: null, // set by caller: exact/partial for the pairing, never none-with-value
    basis: gradeBasis,
    evidence_categories: [
      'defense reason codes via retrieveApplicableDefenseReasons (A1)',
      'defense document types via supplyDefenseDocument (A1)',
    ],
    clauses: clauses('ad_defense', 'ad_codes', ...clauseKeys),
  };
}

// The concept lattice. Per PSP: value (the PSP's own spelling), match grade vs
// the concept, basis prose naming the clause ids, evidence_categories (the
// PSP's own evidence vocabulary for that condition), clauses.
export const CONCEPTS = {
  merchandise_or_service_not_received: {
    label: 'Buyer did not receive the merchandise or service',
    paypal: {
      value: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', match: 'exact',
      basis: 'PayPal dispute_reason enum value (S5) with S3 naming the buyer condition verbatim.',
      evidence_categories: ['PROOF_OF_FULFILLMENT (S3)', 'PROOF_OF_REFUND (S3)', 'notes/documents (S3)'],
      clauses: clauses('pp_inr', 'pp_enum'),
    },
    stripe: {
      value: 'product_not_received', match: 'exact',
      basis: 'Stripe reason enum value (S2); S5 category "Product not received" carries Visa 13.1 and 13.9.',
      evidence_categories: ['S5 category: Product not received'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    adyen: adyenEvidenceCell(['13.1'], 'Adyen reason codes are scheme codes; A4\'s Visa consumer-disputes table lists 13.1 Merchandise/Services Not Received.', []),
    square: {
      value: 'NOT_RECEIVED', match: 'exact',
      basis: 'Square DisputeReason value (Q4); Q4 sentence names the not-received condition verbatim.',
      evidence_categories: ['AUTHORIZATION_DOCUMENTATION (Q2)', 'ONLINE_OR_APP_ACCESS_LOG (Q2)', 'RELATED_TRANSACTION_DOCUMENTATION (Q2)'],
      clauses: clauses('sq_inr', 'sq_ev_note'),
    },
    network: {
      visa: [{ code: '13.1', basis: 'S5 Visa row "Product not received"; A4 Visa table.' }],
      mastercard: [{ code: '4855', basis: 'S5: Product not received from 4855 Transaction Did Not Complete.' }],
    },
  },
  merchandise_or_service_not_as_described: {
    label: 'Merchandise or service not as described / defective',
    paypal: {
      value: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED', match: 'exact',
      basis: 'PayPal dispute_reason enum value (S5) with S3 naming the buyer condition verbatim.',
      evidence_categories: ['OTHER (S3)', 'PROOF_OF_REFUND (S3)'],
      clauses: clauses('pp_snad', 'pp_enum'),
    },
    stripe: {
      value: 'product_unacceptable', match: 'exact',
      basis: 'Stripe reason enum value (S2); S5 category "Product unacceptable" carries Visa 13.3, 13.4, 13.5.',
      evidence_categories: ['S5 category: Product unacceptable'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    adyen: adyenEvidenceCell(['13.3', '13.4', '13.5'], 'A4\'s Visa consumer-disputes table lists 13.3 Not as Described or Defective Merchandise/Services, 13.4 Counterfeit Merchandise, 13.5 Misrepresentation.', []),
    square: {
      value: 'NOT_AS_DESCRIBED', match: 'partial',
      basis: 'Square DisputeReason value (Q4) whose field description covers quality-vs-description expectations; the snapshot records its sentence exceeds 25 words and cites it as a field description, and Q4\'s own challenge sentence is possession/as-described proof — narrower than counterfeit (13.4) or misrepresentation (13.5), so the pairing is partial.',
      evidence_categories: ['CANCELLATION_OR_REFUND_DOCUMENTATION (Q2)', 'SERVICE_RECEIVED_DOCUMENTATION (Q2)', 'PROOF_OF_DELIVERY_DOCUMENTATION (Q2)', 'TRACKING_NUMBER (Q2)'],
      clauses: clauses('sq_nad', 'sq_ev_note'),
    },
    network: {
      visa: [{ code: '13.3', basis: 'S5 Visa row "Product unacceptable"; A4 Visa table.' }],
      mastercard: [{ code: '4853', basis: 'S5: Product unacceptable from 4853 General Defective/Not as Described.' }],
    },
  },
  unauthorized_or_fraud: {
    label: 'Buyer did not authorize the purchase / card fraud',
    paypal: {
      value: 'UNAUTHORISED', match: 'exact',
      basis: 'PayPal dispute_reason enum value (S5, British spelling verbatim) with S3 naming the buyer condition verbatim.',
      evidence_categories: ['PROOF_OF_FULFILLMENT (S3)', 'PROOF_OF_REFUND (S3)', 'OTHER (S3)'],
      clauses: clauses('pp_unauth', 'pp_enum'),
    },
    stripe: {
      value: 'fraudulent', match: 'partial',
      basis: 'Stripe reason enum value (S2), but S5\'s own Visa row makes "Fraudulent" broader than a buyer unauthorized claim: it spans 33, 10.1, 10.2, 10.3, 10.4 and 10.5 (card-present, card-absent and monitoring-program fraud).',
      evidence_categories: ['S5 category: Fraudulent'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    adyen: adyenEvidenceCell(['10.4'], 'A4\'s Visa fraud section spans 10.1-10.5; 10.4 Other Fraud - Card Absent Environment is the card-absent unauthorized member, so the pairing is partial against a PayPal/Square-style buyer unauthorized claim.', []),
    square: {
      value: 'NO_KNOWLEDGE', match: 'exact',
      basis: 'Square DisputeReason value (Q4); Q4 sentence names not-made / not-authorized verbatim.',
      evidence_categories: ['AUTHORIZATION_DOCUMENTATION (Q2)', 'ONLINE_OR_APP_ACCESS_LOG (Q2)', 'RELATED_TRANSACTION_DOCUMENTATION (Q2)'],
      clauses: clauses('sq_nok', 'sq_ev_note'),
    },
    network: {
      visa: [{ code: '10.4', basis: 'S5 Visa row "Fraudulent"; A4 Visa fraud section.' }],
      mastercard: [{ code: '6341', basis: 'S5: Fraudulent from 6341 Fraud investigation.' }],
    },
  },
  unrecognized_transaction: {
    label: 'Cardholder does not recognize the transaction',
    paypal: noneCell('paypal', 'No PayPal dispute_reason enum value (S5, 10 values) names a cardholder-does-not-recognize condition; S3 lists no such buyer condition. none, never inferred.'),
    stripe: {
      value: 'unrecognized', match: 'exact',
      basis: 'Stripe reason enum value (S2); S5\'s Mastercard row maps Unrecognized from 6321 Cardholder does not recognize transaction, and S5\'s Visa table states "Unrecognized | None" — an explicit published absence for Visa.',
      evidence_categories: ['S5 category: Unrecognized'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    adyen: noneCell('adyen', 'The Adyen snapshot reproduces only A4\'s Visa table as data; no Adyen-published clause maps a cardholder-does-not-recognize condition. none, never inferred.'),
    square: noneCell('square', 'No Square DisputeReason value (Q4, 9 values) names a cardholder-does-not-recognize condition. none, never inferred.'),
    network: {
      visa: [],
      mastercard: [{ code: '6321', basis: 'S5: Unrecognized from 6321 Cardholder does not recognize transaction.' }],
      visa_note: 'S5 Visa table states "Unrecognized | None" — no Visa code maps to the category.',
    },
  },
  credit_not_processed: {
    label: 'Refund or credit not processed',
    paypal: {
      value: 'CREDIT_NOT_PROCESSED', match: 'exact',
      basis: 'PayPal dispute_reason enum value (S5) with S3 naming the buyer condition verbatim.',
      evidence_categories: ['PROOF_OF_REFUND (S3)', 'OTHER (S3)'],
      clauses: clauses('pp_credit', 'pp_enum'),
    },
    stripe: {
      value: 'credit_not_processed', match: 'exact',
      basis: 'Stripe reason enum value (S2); S5\'s Visa row carries "13.6 Credit not processed; 13.7 Canceled Merchandise/Services".',
      evidence_categories: ['S5 category: Credit not processed'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    adyen: adyenEvidenceCell(['13.6', '13.7'], 'A4\'s Visa consumer-disputes table lists 13.6 Credit not Processed and 13.7 Canceled Merchandise/Services.', []),
    square: {
      value: 'CUSTOMER_REQUESTS_CREDIT', match: 'exact',
      basis: 'Square DisputeReason value (Q4); Q4 sentence names canceled-or-returned without the credit verbatim.',
      evidence_categories: ['CANCELLATION_OR_REFUND_DOCUMENTATION (Q2)', 'SERVICE_RECEIVED_DOCUMENTATION (Q2)', 'PROOF_OF_DELIVERY_DOCUMENTATION (Q2)', 'TRACKING_NUMBER (Q2)'],
      clauses: clauses('sq_credit', 'sq_ev_note'),
    },
    network: {
      visa: [{ code: '13.6', basis: 'S5 Visa row "Credit not processed"; A4 Visa table.' }, { code: '13.7', basis: 'S5 Visa row "Credit not processed" carries 13.7 Canceled Merchandise/Services; A4 Visa table.' }],
      mastercard: [{ code: '4860', basis: 'S5: Credit not processed from 4860 Credit Not Processed.' }],
    },
  },
  duplicate_charge: {
    label: 'Duplicate charge',
    paypal: {
      value: 'DUPLICATE_TRANSACTION', match: 'exact',
      basis: 'PayPal dispute_reason enum value (S5) with S3 naming the buyer condition verbatim.',
      evidence_categories: ['PROOF_OF_REFUND (S3)', 'OTHER (S3)'],
      clauses: clauses('pp_dup', 'pp_enum'),
    },
    stripe: {
      value: 'duplicate', match: 'exact',
      basis: 'Stripe reason enum value (S2); S5\'s Visa row carries 12.6.1 Duplicate processing, and S5\'s Mastercard row maps Duplicate from 4834 Transaction Amount Differs (Stripe\'s own published grouping, kept verbatim).',
      evidence_categories: ['S5 category: Duplicate'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    adyen: adyenEvidenceCell(['12.6.1'], 'A4\'s Visa processing-errors table lists 12.6.1 Duplicate Processing.', []),
    square: {
      value: 'DUPLICATE', match: 'exact',
      basis: 'Square DisputeReason value (Q4); Q4 sentence names charged-twice verbatim.',
      evidence_categories: ['DUPLICATE_CHARGE_DOCUMENTATION (Q2)', 'RELATED_TRANSACTION_DOCUMENTATION (Q2)'],
      clauses: clauses('sq_dup', 'sq_ev_note'),
    },
    network: {
      visa: [{ code: '12.6.1', basis: 'S5 Visa row "Duplicate"; A4 Visa table.' }],
      mastercard: [{ code: '4834', basis: 'S5: Duplicate from 4834 Transaction Amount Differs.' }],
    },
  },
  incorrect_amount: {
    label: 'Buyer charged an incorrect amount',
    paypal: {
      value: 'INCORRECT_AMOUNT', match: 'exact',
      basis: 'PayPal dispute_reason enum value (S5) with S3 naming the buyer condition verbatim.',
      evidence_categories: ['PROOF_OF_REFUND (S3)', 'OTHER (S3)'],
      clauses: clauses('pp_amt', 'pp_enum'),
    },
    stripe: {
      value: 'general', match: 'partial',
      basis: 'Stripe\'s 15-value reason enum (S2) has no amount value; S5\'s Mastercard row maps General from 6305 Cardholder does not agree with amount billed and S5\'s Visa General row aggregates 12.5 Incorrect Amount among others — the condition lands in the aggregate "General" category, so partial.',
      evidence_categories: ['S5 category: General'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    adyen: adyenEvidenceCell(['12.5'], 'A4\'s Visa processing-errors table lists 12.5 Incorrect Amount.', []),
    square: {
      value: 'AMOUNT_DIFFERS', match: 'exact',
      basis: 'Square DisputeReason value (Q4); Q4 sentence names wrong-amount verbatim.',
      evidence_categories: ['AUTHORIZATION_DOCUMENTATION (Q2)'],
      clauses: clauses('sq_amt', 'sq_ev_note'),
    },
    network: {
      visa: [{ code: '12.5', basis: 'A4 Visa table (12.5 Incorrect Amount); S5\'s Visa General row aggregates 12.5.' }],
      mastercard: [{ code: '6305', basis: 'S5: General from 6305 Cardholder does not agree with amount billed.' }],
    },
  },
  paid_by_other_means: {
    label: 'Buyer paid by other means',
    paypal: {
      value: 'PAYMENT_BY_OTHER_MEANS', match: 'exact',
      basis: 'PayPal dispute_reason enum value (S5) with S3 naming the buyer condition verbatim.',
      evidence_categories: ['PROOF_OF_REFUND (S3)', 'OTHER (S3)'],
      clauses: clauses('pp_pom', 'pp_enum'),
    },
    stripe: {
      value: 'duplicate', match: 'partial',
      basis: 'Stripe\'s reason enum (S2) has no paid-by-other-means value; S5\'s Visa row places "12.6.2 Paid by other means" inside the Duplicate category — the condition surfaces only via the network code, so partial.',
      evidence_categories: ['S5 category: Duplicate'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    adyen: adyenEvidenceCell(['12.6.2'], 'A4\'s Visa processing-errors table lists 12.6.2 Paid by Other Means.', []),
    square: {
      value: 'PAID_BY_OTHER_MEANS', match: 'exact',
      basis: 'Square DisputeReason value (Q4); Q4 sentence names previously-paid verbatim.',
      evidence_categories: ['CANCELLATION_OR_REFUND_DOCUMENTATION (Q2)', 'SERVICE_RECEIVED_DOCUMENTATION (Q2)', 'PROOF_OF_DELIVERY_DOCUMENTATION (Q2)', 'TRACKING_NUMBER (Q2)'],
      clauses: clauses('sq_pom', 'sq_ev_note'),
    },
    network: {
      visa: [{ code: '12.6.2', basis: 'S5 Visa row "Duplicate" carries 12.6.2 Paid by other means; A4 Visa table.' }],
      mastercard: [],
    },
  },
  canceled_recurring_billing: {
    label: 'Charged after canceling subscription or recurring billing',
    paypal: {
      value: 'CANCELED_RECURRING_BILLING', match: 'exact',
      basis: 'PayPal dispute_reason enum value (S5) with S3 naming the buyer condition verbatim.',
      evidence_categories: ['PROOF_OF_REFUND (S3)', 'OTHER (S3)'],
      clauses: clauses('pp_crb', 'pp_enum'),
    },
    stripe: {
      value: 'subscription_canceled', match: 'exact',
      basis: 'Stripe reason enum value (S2); S5\'s Visa row carries "13.2 Canceled Recurring". S5\'s Mastercard row maps Subscription canceled from 4841 Digital Goods Purchase of USD 25 or Less (Stripe\'s own published grouping, kept verbatim).',
      evidence_categories: ['S5 category: Subscription canceled'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    adyen: adyenEvidenceCell(['13.2'], 'A4\'s Visa consumer-disputes table lists 13.2 Canceled Recurring.', []),
    square: {
      value: 'CANCELLED', match: 'partial',
      basis: 'Square DisputeReason value (Q4) whose sentence spans returns AND cancellations ("attempted to return the goods or cancel the service") — broader than charged-after-cancellation, so partial.',
      evidence_categories: ['CANCELLATION_OR_REFUND_DOCUMENTATION (Q2)', 'SERVICE_RECEIVED_DOCUMENTATION (Q2)', 'PROOF_OF_DELIVERY_DOCUMENTATION (Q2)', 'TRACKING_NUMBER (Q2)'],
      clauses: clauses('sq_cancel', 'sq_ev_note'),
    },
    network: {
      visa: [{ code: '13.2', basis: 'S5 Visa row "Subscription canceled"; A4 Visa table.' }],
      mastercard: [{ code: '4841', basis: 'S5: Subscription canceled from 4841 Digital Goods Purchase of USD 25 or Less.' }],
    },
  },
  emv_liability_shift: {
    label: 'EMV liability shift (non-compliant chip-card read)',
    paypal: noneCell('paypal', 'No PayPal dispute_reason enum value (S5) names an EMV or chip-liability condition; S3 lists no such buyer condition. none, never inferred.'),
    stripe: {
      value: 'fraudulent', match: 'partial',
      basis: 'S5\'s Visa row places "10.1 EMV Liability Shift Counterfeit Fraud" and "10.2 EMV Liability Shift Non-Counterfeit Fraud" inside the Fraudulent category — an aggregate, not a dedicated reason, so partial.',
      evidence_categories: ['S5 category: Fraudulent'],
      clauses: clauses('st_netmap'),
    },
    adyen: adyenEvidenceCell(['10.1', '10.2'], 'A4\'s Visa fraud section lists 10.1 EMV Liability Shift Counterfeit Fraud and 10.2 EMV Liability Shift Non-Counterfeit Fraud.', []),
    square: {
      value: 'EMV_LIABILITY_SHIFT', match: 'exact',
      basis: 'Square DisputeReason value (Q4); Q4 names the non-compliant chip-reader condition and states the dispute cannot be challenged ("You cannot challenge this dispute because the payment did not comply with EMV security requirements." (Q4)).',
      evidence_categories: ['No challengeable evidence path: Q4 states this dispute cannot be challenged.'],
      clauses: clauses('sq_emv'),
    },
    network: {
      visa: [{ code: '10.1', basis: 'S5 Visa row "Fraudulent"; A4 Visa fraud section.' }, { code: '10.2', basis: 'S5 Visa row "Fraudulent"; A4 Visa fraud section.' }],
      mastercard: [],
    },
  },
};

// Adyen evidence cells carry their own grade via basis prose; stamp it here so
// the emitted cell always has an explicit match grade.
for (const c of Object.values(CONCEPTS)) {
  if (c.adyen && c.adyen.match === null) {
    c.adyen.match = /broader|aggregate|partial|card-absent unauthorized member/.test(c.adyen.basis) ? 'partial' : 'exact';
  }
}

// Reason values with a valid lookup but NO crosswalk concept (no second PSP
// clause anywhere in the four snapshots). Each keeps its source-side citation;
// every other-PSP cell is none. Adyen entries additionally carry the S5 Visa
// category row that code lands in, where S5 lists one (cited, partial).
export const SINGLETONS = {
  paypal: {
    PROBLEM_WITH_REMITTANCE: {
      basis: 'PayPal dispute_reason enum value (S5); S3 states no buyer condition for it ("NOT STATED on S3").',
      evidence_categories: ['Not stated by PayPal (S3: absent from the reasons-evidence page)'],
      clauses: clauses('pp_enum'),
    },
    OTHER: {
      basis: 'PayPal dispute_reason enum value (S5); S3 gives no buyer-condition sentence.',
      evidence_categories: ['PROOF_OF_REFUND (S3)', 'OTHER (S3)'],
      clauses: clauses('pp_enum'),
    },
  },
  stripe: {
    general: {
      basis: 'Stripe reason enum value (S2); S5\'s Visa General row aggregates 28, 30, 34, 11.1-11.3, 12.1-12.5, 12.7, 13.8 — a residual aggregate, not a single crosswalkable condition.',
      evidence_categories: ['S5 category: General'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    noncompliant: {
      basis: 'Stripe reason enum value (S2); S5\'s Visa row maps Noncompliant from C028, C030, C031, C034, C035, C036, C038, C045, C048, C050, C071, C081, C0135.',
      evidence_categories: ['S5 category: Noncompliant'],
      clauses: clauses('st_reason', 'st_netmap'),
    },
    debit_not_authorized: {
      basis: 'Stripe reason enum value (S2); S5 states it is the single reason for Instant Bank Payments disputes, with the ACH return code as the network reason code.',
      evidence_categories: ['S5: Instant Bank Payments disputes'],
      clauses: clauses('st_reason', 'st_debit'),
    },
    bank_cannot_process: { basis: 'Stripe reason enum value (S2).', evidence_categories: null, clauses: clauses('st_reason') },
    check_returned: { basis: 'Stripe reason enum value (S2).', evidence_categories: null, clauses: clauses('st_reason') },
    customer_initiated: { basis: 'Stripe reason enum value (S2).', evidence_categories: null, clauses: clauses('st_reason') },
    incorrect_account_details: { basis: 'Stripe reason enum value (S2).', evidence_categories: null, clauses: clauses('st_reason') },
    insufficient_funds: { basis: 'Stripe reason enum value (S2).', evidence_categories: null, clauses: clauses('st_reason') },
  },
  square: {},
  adyen: {
    '10.3': { s5_category: 'fraudulent' },
    '10.5': { s5_category: 'fraudulent', note: 'S5: "Visa disputes with reason code 10.5 are extremely rare and have no recourse to remedy the dispute."' },
    '11.1': { s5_category: 'general' },
    '11.2': { s5_category: 'general' },
    '11.3': { s5_category: 'general' },
    '12.1': { s5_category: 'general' },
    '12.2': { s5_category: 'general' },
    '12.3': { s5_category: 'general' },
    '12.4': { s5_category: 'general' },
    '12.7': { s5_category: 'general' },
  },
};

// Lookup indexes: PSP reason value -> concept key (or singleton marker).
function buildIndex() {
  const idx = { paypal: {}, stripe: {}, adyen: {}, square: {} };
  for (const [key, c] of Object.entries(CONCEPTS)) {
    if (c.paypal && c.paypal.value) idx.paypal[c.paypal.value] = key;
    if (c.stripe && c.stripe.value && !(c.stripe.value in idx.stripe)) idx.stripe[c.stripe.value] = key;
    if (c.adyen && Array.isArray(c.adyen.value)) for (const v of c.adyen.value) idx.adyen[v] = key;
    if (c.square && c.square.value) idx.square[c.square.value] = key;
  }
  for (const v of Object.keys(SINGLETONS.paypal)) idx.paypal[v] = null;
  for (const v of Object.keys(SINGLETONS.stripe)) if (!(v in idx.stripe)) idx.stripe[v] = null;
  for (const v of Object.keys(SINGLETONS.adyen)) idx.adyen[v] = null;
  // Adyen singleton codes still cite A4's Visa table (the codes themselves).
  return idx;
}
export const LOOKUP = buildIndex();

// Valid vocabularies, exported for the proptest and manifest.
export const PAYPAL_REASONS = [
  'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED', 'UNAUTHORISED',
  'CREDIT_NOT_PROCESSED', 'DUPLICATE_TRANSACTION', 'INCORRECT_AMOUNT', 'PAYMENT_BY_OTHER_MEANS',
  'CANCELED_RECURRING_BILLING', 'PROBLEM_WITH_REMITTANCE', 'OTHER',
];
export const STRIPE_REASONS = [
  'bank_cannot_process', 'check_returned', 'credit_not_processed', 'customer_initiated', 'debit_not_authorized',
  'duplicate', 'fraudulent', 'general', 'incorrect_account_details', 'insufficient_funds', 'noncompliant',
  'product_not_received', 'product_unacceptable', 'subscription_canceled', 'unrecognized',
];
export const ADYEN_VISA_CODES = [
  '10.1', '10.2', '10.3', '10.4', '10.5', '11.1', '11.2', '11.3', '12.1', '12.2', '12.3', '12.4', '12.5',
  '12.6.1', '12.6.2', '12.7', '13.1', '13.2', '13.3', '13.4', '13.5', '13.6', '13.7',
];
export const SQUARE_REASONS = [
  'AMOUNT_DIFFERS', 'CANCELLED', 'CUSTOMER_REQUESTS_CREDIT', 'DUPLICATE', 'EMV_LIABILITY_SHIFT',
  'NO_KNOWLEDGE', 'NOT_AS_DESCRIBED', 'NOT_RECEIVED', 'PAID_BY_OTHER_MEANS',
];

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'crosswalk_psp_dispute_reasons',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

function refusedPayload(code, detail) {
  return {
    refused: code,
    detail,
    domain_errors: [{ code }],
    refusal_reason: code,
  };
}

function cellFor(concept, psp) {
  const c = concept[psp];
  if (!c || c.value === null) {
    return { psp, value: null, match: 'none', basis: c ? c.basis : 'No snapshot support at this PSP. none, never inferred.', evidence_categories: null, clauses: [] };
  }
  return {
    psp,
    value: c.value,
    match: c.match,
    basis: c.basis,
    evidence_categories: c.evidence_categories,
    clauses: c.clauses,
  };
}

function conceptOutput(conceptKey, inputEcho) {
  const concept = CONCEPTS[conceptKey];
  const crosswalk = {};
  for (const psp of PSPS) crosswalk[psp] = cellFor(concept, psp);
  const network = { visa: [], mastercard: [] };
  for (const n of concept.network.visa || []) network.visa.push({ code: n.code, label: NETWORK_CODES.visa[n.code] || null, basis: n.basis, clauses: clauses('st_netmap') });
  for (const n of concept.network.mastercard || []) network.mastercard.push({ code: n.code, label: NETWORK_CODES.mastercard[n.code] || null, basis: n.basis, clauses: clauses('st_netmap') });
  const netNote = { square: SQ_NO_NETMAP_BASIS, clauses: clauses('sq_no_netmap') };
  if (concept.network.visa_note) netNote.visa = concept.network.visa_note;
  const cited = [];
  const seen = new Set();
  for (const psp of PSPS) for (const cl of crosswalk[psp].clauses) {
    const k = cl.id + '|' + cl.quote;
    if (!seen.has(k)) { seen.add(k); cited.push(cl); }
  }
  const grades = PSPS.map((p) => crosswalk[p].match);
  return {
    input: inputEcho,
    concept: conceptKey,
    concept_label: concept.label,
    match: grades.includes('exact') || grades.includes('partial') ? 'exact_or_partial' : 'none',
    per_psp_match: Object.fromEntries(PSPS.map((p) => [p, crosswalk[p].match])),
    crosswalk,
    network_codes: network,
    network_codes_note: netNote,
    cited_clauses: cited,
    domain_errors: [],
    refusal_reason: null,
  };
}

function singletonOutput(psp, value, inputEcho) {
  const single = SINGLETONS[psp][value];
  const crosswalk = {};
  for (const other of PSPS) {
    if (other === psp) {
      crosswalk[other] = psp === 'adyen'
        ? {
            psp, value, match: 'exact',
            basis: 'Adyen Visa scheme code from A4\'s Visa table (reproduced as data in the Adyen snapshot).',
            evidence_categories: [
              'defense reason codes via retrieveApplicableDefenseReasons (A1)',
              'defense document types via supplyDefenseDocument (A1)',
            ],
            clauses: clauses('ad_defense', 'ad_codes'),
          }
        : {
            psp, value, match: 'exact',
            basis: single.basis,
            evidence_categories: single.evidence_categories || null,
            clauses: single.clauses,
          };
    } else {
      crosswalk[other] = noneCell(other, 'No clause in the four snapshots supports an equivalent at this PSP for ' + psp + ' ' + value + '. none, never inferred.');
    }
  }
  // Adyen singletons: cite A4 (the Visa table carrying the code) and, where
  // S5's Visa table places the code in a category, add that cited mapping.
  const cited = [];
  if (psp === 'adyen') {
    cited.push({ id: 'A4', quote: '(A4 Visa table, reproduced as data: ' + value + ')', url: SNAPSHOT_SOURCES.adyen.A4 });
    if (single.s5_category) {
      const row = S5_VISA_CATEGORY_ROWS[single.s5_category].find((r) => r.startsWith(value + ' ')) || S5_VISA_CATEGORY_ROWS[single.s5_category].join('; ');
      crosswalk.stripe = {
        psp: 'stripe', value: single.s5_category, match: 'partial',
        basis: 'S5\'s Visa row places ' + value + ' inside the ' + single.s5_category + ' category: ' + row + '.',
        evidence_categories: ['S5 category: ' + single.s5_category],
        clauses: clauses('st_netmap'),
      };
      cited.push(clause('st_netmap'));
    }
    if (single.note) cited.push({ id: 'S5', quote: single.note.replace(/^S5: /, '').replace(/"([^"]*)"$/, '$1'), url: SNAPSHOT_SOURCES.stripe.S5 });
  }
  for (const p of PSPS) for (const cl of crosswalk[p].clauses) cited.push(cl);
  return {
    input: inputEcho,
    concept: null,
    concept_label: null,
    match: 'none',
    per_psp_match: Object.fromEntries(PSPS.map((p) => [p, crosswalk[p].match])),
    crosswalk,
    network_codes: { visa: [], mastercard: [] },
    network_codes_note: { square: SQ_NO_NETMAP_BASIS, clauses: clauses('sq_no_netmap') },
    cited_clauses: cited,
    domain_errors: [],
    refusal_reason: null,
  };
}

function networkCodeOutput(network, code, inputEcho) {
  // Find the concept whose published network mapping carries this code.
  let found = null;
  for (const [key, c] of Object.entries(CONCEPTS)) {
    if ((c.network[network] || []).some((n) => n.code === code)) { found = key; break; }
  }
  if (found) {
    const out = conceptOutput(found, inputEcho);
    out.network_input = { network, code, label: NETWORK_CODES[network][code] || null, basis: 'S5 network code map (Visa/Mastercard tables) and/or A4 Visa table, as cited per concept.' };
    return out;
  }
  // Known code, no concept: refuse to invent one.
  return null;
}

/**
 * compute(pp) — pure function of the policy parameters.
 *
 * pp = {
 *   psp:    'paypal' | 'stripe' | 'adyen' | 'square'
 *   reason: the PSP's own reason value — PayPal dispute_reason (schema v1.12,
 *           British UNAUTHORISED), Stripe reason, Square DisputeReason, or for
 *           adyen the Adyen Visa scheme code from A4 (e.g. '13.1')
 *   -- or, for a network-code lookup --
 *   network_code: { network: 'visa' | 'mastercard', code: '<code>' }
 * }
 *
 * Returns { output_payload, compliance_flags }. Out-of-domain inputs yield a
 * named refusal, never a silent guess.
 */
export function compute(pp) {
  pp = pp || {};
  const psp = pp.psp;
  const hasReason = Object.prototype.hasOwnProperty.call(pp, 'reason') && pp.reason !== undefined && pp.reason !== null && typeof pp.reason === 'string' && pp.reason.trim() !== '';
  const hasNet = pp.network_code && typeof pp.network_code === 'object';

  if (hasReason === hasNet) {
    return {
      output_payload: refusedPayload(
        'REFUSED_INPUT_SHAPE',
        'Provide exactly one of: {psp, reason} or {network_code: {network, code}}. Received ' +
          (hasReason ? 'both' : 'neither') + '.'
      ),
      compliance_flags: ['ART777_INPUT_REFUSED'],
    };
  }

  if (hasNet) {
    const network = pp.network_code.network;
    const code = pp.network_code.code;
    if (network !== 'visa' && network !== 'mastercard') {
      return {
        output_payload: refusedPayload('REFUSED_UNKNOWN_NETWORK', 'network_code.network must be visa or mastercard; received ' + JSON.stringify(network ?? null) + '. Only Visa (S5/A4) and Mastercard (S5) network maps are snapshot-supported.'),
        compliance_flags: ['ART777_INPUT_REFUSED'],
      };
    }
    if (typeof code !== 'string' || !(code in NETWORK_CODES[network])) {
      return {
        output_payload: refusedPayload('REFUSED_UNKNOWN_NETWORK_CODE', 'network_code.code must be one of the snapshot-published ' + network + ' codes: ' + Object.keys(NETWORK_CODES[network]).join(', ') + '; received ' + JSON.stringify(code ?? null)),
        compliance_flags: ['ART777_INPUT_REFUSED'],
      };
    }
    const out = networkCodeOutput(network, code, { network, code });
    if (out === null) {
      return {
        output_payload: refusedPayload('REFUSED_NETWORK_CODE_NO_CONCEPT', 'Code ' + code + ' is published in a network map (S5/A4) but no crosswalk concept is supported for it; refusing to infer one.'),
        compliance_flags: ['ART777_INPUT_REFUSED'],
      };
    }
    return { output_payload: out, compliance_flags: flagsFor(out) };
  }

  if (!PSPS.includes(psp)) {
    return {
      output_payload: refusedPayload('REFUSED_UNKNOWN_PSP', 'psp must be one of ' + PSPS.join(', ') + '; received ' + JSON.stringify(psp ?? null)),
      compliance_flags: ['ART777_INPUT_REFUSED'],
    };
  }
  const reason = pp.reason.trim();
  const vocab = { paypal: PAYPAL_REASONS, stripe: STRIPE_REASONS, adyen: ADYEN_VISA_CODES, square: SQUARE_REASONS }[psp];
  if (!vocab.includes(reason)) {
    return {
      output_payload: refusedPayload('REFUSED_UNKNOWN_REASON', 'For psp=' + psp + ', reason must be one of the snapshot-published values: ' + vocab.join(', ') + '; received ' + JSON.stringify(pp.reason) + '. (PayPal spellings are schema v1.12 verbatim, including UNAUTHORISED.)'),
      compliance_flags: ['ART777_INPUT_REFUSED'],
    };
  }
  const conceptKey = LOOKUP[psp][reason];
  const out = conceptKey === null || conceptKey === undefined
    ? singletonOutput(psp, reason, { psp, reason })
    : conceptOutput(conceptKey, { psp, reason });
  return { output_payload: out, compliance_flags: flagsFor(out) };
}

function flagsFor(out) {
  const flags = [];
  const grades = Object.values(out.per_psp_match);
  if (grades.includes('exact')) flags.push('CROSSWALK_HAS_EXACT_CELL');
  if (grades.includes('partial')) flags.push('CROSSWALK_HAS_PARTIAL_CELL');
  if (out.concept === null) flags.push('CROSSWALK_NO_CONCEPT');
  return flags;
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
