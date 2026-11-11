# PSP Dispute Reason Crosswalk

Dispute reason-code crosswalk across PayPal, Stripe, Adyen and Square (static and credential-free: the mapping tables ship with the kernel, so no live PSP API is called). Inputs: either {psp, reason} (one PSP's own dispute-reason value in that PSP's exact enum spelling: PayPal dispute_reason schema v1.12 including the British UNAUTHORISED; Stripe reason; Adyen Visa scheme reason codes, the one scheme table the Adyen snapshot reproduces; Square DisputeReason) or {network_code: {network, code}} for a card-network reason code where the snapshots publish a mapping (Visa, Mastercard). Outputs: the equivalent reason values at the other three PSPs with a per-cell match grade (exact / partial / none), each cell justified by the snapshot clause ids and verbatim quotes that support it, plus the evidence categories per PSP where a snapshot states them, the network codes where any snapshot states a mapping, the concept and concept label, the per-PSP match, cited clauses, domain errors and refusal_reason. Every mapping cell cites a clause from the four primary-text snapshots: research/clause-snapshots/paypal-disputes-2026-10/SNAPSHOT.md (S1-S9, fetch 2026-10-25T03Z), stripe-disputes-2026-10 (S1-S6, fetch 2026-10-26T12Z), adyen-disputes-2026-10 (A1-A6, fetch 2026-10-26T12Z) and square-disputes-2026-10 (Q1-Q5, fetch 2026-10-26T12Z). A mapping no snapshot supports is none, never inferred: a none cell carries no value and no invented clause, and a snapshot-stated absence (e.g. Stripe S5's Visa row mapping Unrecognized to None; Square publishing no network mapping) is cited as stated, not guessed. Unknown PSP, unknown reason, non-string reason, both-or-neither input shape and unknown network or network code are refused by name. Singleton reasons no other PSP supports cross to none rather than inferring an equivalent. Shape follows the estate's crosswalk exemplar art-133. Zero network, zero PII, no credentials.

- Page: https://ainumbers.co/chaingraph/art-777-psp-dispute-reason-crosswalk.html
- Markdown twin: https://ainumbers.co/chaingraph/art-777-psp-dispute-reason-crosswalk.md
- MCP tool: crosswalk_psp_dispute_reasons (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- psp (string, optional): PSP whose vocabulary the reason value belongs to.
- reason (string, optional): Dispute-reason value in that PSP's exact enum spelling.
- network_code (object, optional): {network: visa|mastercard, code} card-network reason-code lookup, alternative to psp+reason.

## Sample

```json
{
  "psp": "paypal",
  "reason": "UNAUTHORISED"
}
```

## Verify

Run the sample policy_parameters through MCP tool `crosswalk_psp_dispute_reasons` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
