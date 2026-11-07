# Stablecoin Refund Dispute Check

Recomputes the expected refund and dispute outcome of stablecoin payments held under an escrowed refund protocol and flags every break between the merchant reported state or amounts and the recomputation. Inputs are aggregate values only, keyed by opaque synthetic payment labels: per payment an integer minor-unit amount, a paid-at second, optional refund requests, optional arbiter decisions with refunded minor amounts, an optional early-withdrawal second, and the merchant reported terminal state and reported refunded and released minor amounts; the caller declares the rule set through a profile (the pinned Circle Refund Protocol snapshot at commit a7ae494, Apache-2.0, re-implemented in plain arithmetic, or generic with every rule caller-declared) plus a lock period in seconds, an early-withdrawal fee in basis points, an arbiter role label, whether partial refunds are allowed, and an optional audit clock second. Rules: a payment sits HELD until paid-at plus the lock period and releases in full after the lock; an arbiter refund is all-or-nothing unless partial refunds are declared; a decision below the full amount with partials disallowed is treated as the full refund and the break is named; an early withdrawal inside the lock carries fee = floor(amount times fee_bp over 10000) in integer minor units, round-down, the node's single documented rounding rule; a partial refund with partials allowed leaves the remainder to release (or still held at the audit clock). Output: per payment the expected terminal state (HELD, RELEASED, REFUNDED, PARTIALLY_REFUNDED, EARLY_WITHDRAWN) with refunded, released, fee and held minor amounts; breaks with a named rule for every reported-versus-expected difference; the conservation identity paid = refunded + released + fee + held per payment and in total; and a CONSISTENT, CONSISTENT_WITH_BREAKS or INCONSISTENT verdict. Declared domain exclusions: aggregate-only, no payer or merchant data, payment labels resembling an address, transaction hash or long identifier-like blob are refused with no echo, no fiat chargeback networks, no FX or token-price effects, no legal-outcome prediction, synthetic data only. Payment settlement evidence lives in the estate's x402 and CCTP nodes; this node consumes none of their outputs. The pinned-profile re-implementation implies no endorsement by, affiliation with, or warranty from Circle.

- Page: https://ainumbers.co/chaingraph/795-stablecoin-refund-dispute.html
- Markdown twin: https://ainumbers.co/chaingraph/795-stablecoin-refund-dispute.md
- MCP tool: check_stablecoin_refund_dispute (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, required)
- params (object, required)
- payments (array, required)

## Outputs

- refused (boolean, optional)
- profile (string,null, optional)
- rules_basis (string, optional)
- fee_rounding (string, optional)
- arbiter_role (string,null, optional)
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
      "payment_ref": "syn-pay-001",
      "amount_minor": 500000,
      "paid_at": 0,
      "refund_requests": [],
      "arbiter_decisions": [],
      "reported_state": "RELEASED",
      "reported_refunded_minor": 0,
      "reported_released_minor": 500000
    }
  ]
}
```

All values are synthetic. No real payment data is accepted or echoed.

## Scope

- Rules for the pinned profile follow the Circle Refund Protocol (Apache-2.0) at pinned commit a7ae494: escrow with a lock period, post-lock release, all-or-nothing refunds by recipient or arbiter, and arbiter-authorised early withdrawal carrying an explicit fee. The pin note with sha256 for every pinned file is `research/STABLECOIN-REFUND-DISPUTE-PIN-2026-10-30.md`.
- The on-chain protocol declares the early-withdrawal fee per withdrawal; this node recomputes the expected fee from the declared basis-point parameter with the documented round-down rule, so a merchant's fee expectation can be checked before and after the fact.
- Zero network, zero PII, aggregate values only.

ART-795 · OpenChainGraph Suite · Post Oak Labs · CC BY 4.0
