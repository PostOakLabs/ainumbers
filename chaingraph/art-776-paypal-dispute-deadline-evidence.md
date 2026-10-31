# PayPal Dispute Deadline & Evidence

PayPal dispute deadline calculator and evidence-bundle producer, the PayPal-side PRODUCER for the existing dispute-evidence chain (hub proposal PAYPAL-HUB-PROPOSALS-2026-10-24 row 9). Inputs: one of the four dispute reasons in the estate's PayPal dispute-evidence map (MERCHANDISE_OR_SERVICE_NOT_RECEIVED, MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED, UNAUTHORISED, CREDIT_NOT_PROCESSED, reused verbatim from paypal-agent-shop/lib/disputes.js), a lifecycle stage from PayPal's dispute_life_cycle_stage enum (INQUIRY, CHARGEBACK, PRE_ARBITRATION, ARBITRATION), a funding source, ISO-8601 UTC timestamps (dispute creation, caller-supplied as_of, optional seller_response_due_date passthrough) and the evidence items on hand. Outputs: the seller response deadline from PayPal's stated rules (10 days after dispute creation at the inquiry stage; 20-day inquiry window) or the passthrough timestamp, with days remaining and past-due status; windows PayPal does not state (chargeback-stage response, appeal period) are returned as null with a reason, never guessed. Also outputs required evidence and missing items per reason, and the evidence bundle: for a chargeback on a card-funded transaction only, a CE3.0-shaped bundle with art-297's field names kept verbatim (delivery proof from fulfillment evidence; null for ap2_mandate, tap_signature, agentic_token and prior_transactions where PayPal has no counterpart), consumable by art-297 (mcp:lint_compelling_evidence_ce30_agentic); for inquiry, claim and appeal stages, or non-card funding, a paypal_process_evidence bundle using the lib's evidence types on the Disputes API v1.12 evidence_info shape, explicitly labelled not CE3.0; for unknown funding, no CE3.0 bundle and a reason. Zero network, zero PII, synthetic values only. Clause authority: research/clause-snapshots/paypal-disputes-2026-10/SNAPSHOT.md (fetch 2026-10-25T03Z). Per-PSP deadline tables: a psp input (default paypal) also selects the Stripe, Adyen or Square table (snapshots stripe-disputes-2026-10, adyen-disputes-2026-10, square-disputes-2026-10, each fetch 2026-10-26T12Z), each with its own stage vocabulary and stated numbers, every rule citing its own snapshot's clause; on those paths funding_source is refused (a PayPal-path input) and required_evidence is null with a reason (those snapshots publish no re-typed per-reason evidence table).

- Page: https://ainumbers.co/chaingraph/art-776-paypal-dispute-deadline-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/art-776-paypal-dispute-deadline-evidence.md
- MCP tool: compute_paypal_response (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- psp (string, optional): paypal (default), stripe, adyen or square; selects the deadline table. funding_source applies on the paypal path only and is refused on the others.
- dispute_reason (string, required): One of the four disputes.js reasons; anything else is refused. On the other PSP paths an optional verbatim echo.
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
