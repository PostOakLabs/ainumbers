# Stablecoin Refund Dispute Check

Recomputes the expected refund and dispute outcome of stablecoin payments held under an escrowed refund protocol (lock period, refund request, arbiter decision, early-withdrawal fee, partial refunds) from aggregate, synthetic-label payment records only, and flags each break between the merchant reported state or amounts and the recomputation with a named rule: payments held for the caller-declared lock period are released in full after the lock, an arbiter refund is all-or-nothing unless the caller declares partial refunds allowed, an early withdrawal inside the lock carries a fee recomputed as floor(amount times fee_bp over 10000) in integer minor units (round-down, the node single documented rounding rule), and paid equals refunded plus released plus fee plus still held per payment and in total with a CONSISTENT, CONSISTENT_WITH_BREAKS or INCONSISTENT verdict. Aggregate-only: payment_ref values are opaque synthetic labels; any label resembling an address, transaction hash or long identifier-like blob is refused with no echo, and no payer or merchant data is accepted. Rules for the pinned profile re-implement the Circle Refund Protocol (Apache-2.0) escrow, refund, arbiter and early-withdrawal behaviour from a pinned source snapshot cited in cited_clause_digest; the generic profile takes every rule caller-declared. Payment settlement evidence lives in the x402 and CCTP nodes; this node consumes none of their outputs. Declared domain exclusions: no fiat chargeback networks, no FX or token-price effects, no legal-outcome prediction, values only, synthetic data only.

- Page: https://ainumbers.co/chaingraph/795-stablecoin-refund-dispute.html
- Markdown twin: https://ainumbers.co/chaingraph/795-stablecoin-refund-dispute.md
- MCP tool: check_stablecoin_refunds (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, required)
- params (object, required)
- payments (array, required)

## Outputs

- refused (boolean, optional)
- profile (string,null, optional)
- expected (array, optional)
- breaks (array, optional)
- conservation (object, optional)
- verdict (string, optional)

## Sample

```json
{
  "profile": "refund_protocol_a7ae494",
  "params": {
    "lock_period_seconds": 86400,
    "early_withdrawal_fee_bp": 100,
    "arbiter_role": "arbiter",
    "partial_refunds_allowed": true
  },
  "payments": [
    {
      "refund_requests": [],
      "arbiter_decisions": [],
      "payment_ref": "syn-pay-001",
      "amount_minor": 500000,
      "paid_at": 0,
      "reported_state": "RELEASED",
      "reported_refunded_minor": 0,
      "reported_released_minor": 500000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_stablecoin_refunds` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
