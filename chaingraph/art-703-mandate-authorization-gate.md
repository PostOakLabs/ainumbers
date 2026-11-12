# Mandate Authorization Gate

Automated payment approval gate with no human step, in two modes. In authorize mode a caller-supplied mandate, caller-supplied budget and rail state, and a proposed payment request go through a fixed ten-rule order: amount validity, mandate revocation, not-yet-valid, expired (the exact expiry boundary included), currency mismatch, payer mismatch (when the mandate names a payer), payee coverage (mandate payee and verified-payee list), the per-payment cap, the budget, and the rail allowlist. Every failing rule is listed with a named reason and the first failure is the primary reason. On no failure the node issues a one-use authorization bound to the exact request digest and mandate digest, with a validity window that starts at as_of and closes at as_of plus a ttl of 1 to 900 seconds clipped to the mandate's own expiry; the authorization_id is the digest of the operation, both digests and the window, and doubles as the rail's single-use nonce as 0x-prefixed 32-byte hex. In verify_commit mode the node recomputes the authorization_id from the presented authorization's own fields, re-digests the committed request, and checks the window, refusing with AUTHORIZATION_ID_MISMATCH, DIGEST_MISMATCH, OPERATION_MISMATCH, NOT_YET_VALID or AUTHORIZATION_EXPIRED. Amounts are integers in minor units; the mandate cap is a decimal major-unit string converted by pure integer string arithmetic through a curated minor-unit exponent table, refusing an unknown currency and refusing over-precise caps instead of rounding, with no float anywhere. Timestamps are UTC strings only, parsed to integer epoch seconds, no Date object. Declared exclusions: single use is enforced by the payment rail through the nonce, not by this stateless node; budget state is caller-supplied (spent_minor); the mandate signature is not verified here, that is art-01 or art-31's job; an absent rail allowlist allows no rail (fail closed). Consumes the canonical mandate pivot of art-476, so mandates declared under any of the protocols art-476 translates reach this gate through that one edge.

- Page: https://ainumbers.co/chaingraph/art-703-mandate-authorization-gate.html
- Markdown twin: https://ainumbers.co/chaingraph/art-703-mandate-authorization-gate.md
- MCP tool: authorize_payment_against_mandate (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- mode (string, required): authorize evaluates the mandate and request; verify_commit re-verifies a presented authorization.
- as_of (string, required): Decision time as a UTC timestamp, YYYY-MM-DDTHH:MM:SS ending in Z. The node reads no clock.
- ttl_seconds (integer, optional): authorize only: window seconds, clipped into 1 to 900 and to the mandate expiry.
- mandate (object, optional): authorize only: the mandate drawn on; commonly the canonical pivot from art-476.
- extensions (object, optional): authorize only, optional: revoked_at, budget minor integers, allowed_rails, verified_payees.
- request (object, optional): authorize: the proposed payment. verify_commit: the request being committed, as presented.
- authorization (object, optional): verify_commit only: the authorization this node issued, presented back for commit.

## Outputs

- authorization (object,null, optional)
- authorization_id (string, optional)
- decision (string, required)
- domain_errors (array, required)
- mode (string, required)
- primary_reason (null,string, optional)
- reasons (array, required)
- remaining_budget_minor (number,null, optional)
- scope_note (string, optional)

## Sample

```json
{
  "mode": "authorize",
  "as_of": "2026-10-01T15:00:00Z",
  "ttl_seconds": 60,
  "mandate": {
    "mandate_id": "m-1",
    "payer_ref": "acct:alice",
    "payee_ref": "merchant:42",
    "currency": "USD",
    "max_amount": "250.00",
    "issued_at": "2026-10-01T00:00:00Z",
    "expires_at": "2026-10-08T00:00:00Z",
    "purpose": "groceries"
  },
  "extensions": {
    "total_budget_minor": 100000,
    "spent_minor": 72000,
    "allowed_rails": [
      "x402-exact-evm"
    ],
    "verified_payees": [
      "merchant:42"
    ],
    "revoked_at": null
  },
  "request": {
    "payer_ref": "acct:alice",
    "payee_ref": "merchant:42",
    "amount_minor": 24999,
    "currency": "USD",
    "rail": "x402-exact-evm",
    "purpose": "groceries"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `authorize_payment_against_mandate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
