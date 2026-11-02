# PayPal Dispute Deadline & Evidence

Dispute deadline calculator and evidence-bundle producer across four payment service providers (PayPal default, plus Stripe, Adyen and Square via the psp input), the seller-side producer for the existing dispute-evidence chain. Each PSP contributes one deadline table as data, every rule citing its own snapshot clause, and a window the PSP does not state is returned as null with a reason, never guessed. PayPal inputs: one of the four dispute reasons in the estate's PayPal dispute-evidence map (MERCHANDISE_OR_SERVICE_NOT_RECEIVED, MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED, UNAUTHORISED, CREDIT_NOT_PROCESSED, reused verbatim from paypal-agent-shop/lib/disputes.js), a lifecycle stage from PayPal's dispute_life_cycle_stage enum (INQUIRY, CHARGEBACK, PRE_ARBITRATION, ARBITRATION), a funding source, ISO-8601 UTC timestamps (dispute creation, caller-supplied as_of, optional seller_response_due_date passthrough) and the evidence items on hand. The other PSPs take their own stage vocabulary from their snapshots (Stripe's Dispute object status enum, Adyen's dispute webhook event codes with the scheme as the table key, Square's DisputeState) instead of the PayPal reason and funding vocabulary. Outputs: the seller response deadline from the selected PSP's stated rules (PayPal: 10 days after dispute creation at the inquiry stage, and a 20-day inquiry window; Adyen: the scheme timeframe matrix, for example Mastercard 40 calendar days from the notification-of-chargeback date; Stripe: a 120-day inquiry auto-close; Square: no stated rule number) or the passthrough timestamp, with days remaining and past-due status; windows a PSP states only as a range (Stripe's usually 7 to 21 days depending on the card network), a typical figure (Square's typically 14 days or less), a reason-dependent ambiguity (Adyen's Visa 9-or-18-day response split by processing region, Klarna's 14-day / 7-day / 96-hour RFI split by reason code) or not at all are returned as null with the reason quoted. Also outputs required evidence and missing items per reason on the PayPal path, and the evidence bundle: for a card-network chargeback at its response stage only (PayPal chargeback on card funding; Stripe needs_response on a card rail; Adyen notification of chargeback or chargeback on a card-network scheme; Square evidence_required, bank-initiated by definition), a CE3.0-shaped bundle with art-297's field names kept verbatim (delivery proof from fulfillment evidence; null for ap2_mandate, tap_signature, agentic_token and prior_transactions where the PSP has no counterpart), consumable by art-297 (mcp:lint_compelling_evidence_ce30_agentic); for PayPal inquiry, claim and appeal stages, or non-card funding, a paypal_process_evidence bundle using the lib's evidence types on the Disputes API v1.12 evidence_info shape, explicitly labelled not CE3.0; for unknown PayPal funding, no CE3.0 bundle and a reason. Zero network, zero PII, synthetic values only. Clause authority: research/clause-snapshots/{paypal,stripe,adyen,square}-disputes-2026-10/SNAPSHOT.md (fetches 2026-10-25T03Z and 2026-10-26T12Z).

- Page: https://ainumbers.co/chaingraph/art-776-paypal-dispute-deadline-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/art-776-paypal-dispute-deadline-evidence.md
- MCP tool: compute_paypal_response (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- dispute_reason (string, required): One of the four disputes.js reasons; anything else is refused.
- lifecycle_stage (string, required): PayPal dispute_life_cycle_stage enum value.
- funding_source (string, required): card, paypal_balance_or_bank or unknown.
- dispute_create_time (string, required): ISO-8601 UTC timestamp of dispute creation.
- as_of (string, required): ISO-8601 UTC reference time; the kernel never reads a wall clock.
- seller_response_due_date (string, optional): Optional ISO-8601 UTC passthrough of PayPal's own deadline timestamp.
- transaction_ref (string, optional): Optional synthetic transaction reference for the CE3.0 bundle binding.
- card_network (string, optional): Optional card-network label passed through to the CE3.0 bundle.
- evidence_on_hand (object, optional): Optional { carrier_name, tracking_number, refund_id, notes } evidence items on hand.

## Sample

```json
{
  "dispute_reason": "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
  "lifecycle_stage": "INQUIRY",
  "funding_source": "paypal_balance_or_bank",
  "dispute_create_time": "2026-10-01T12:00:00Z",
  "as_of": "2026-10-05T12:00:00Z",
  "evidence_on_hand": {
    "carrier_name": "SyntheticCarrier",
    "tracking_number": "SYN-0001"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_paypal_response` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
