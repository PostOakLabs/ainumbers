# Agentic Dispute CE3.0 Evidence Linter

Deterministic lint of a supplied agentic-dispute evidence bundle against Visa CE3.0 compelling-evidence requirements, agentic-transaction profile: authorization-at-delegation (AP2 mandate), agent-identity (TAP signature + agentic token), fulfillment (delivery proof), plus the CE3.0 prior-transaction linkage test. Verify-side evidence assembly only - never a win/loss prediction or a claim of Visa/Mastercard acceptance. Terminal node of the assemble-agent-dispute-evidence chain. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-297-agentic-dispute-ce30-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-297-agentic-dispute-ce30-linter.md
- MCP tool: lint_compelling_evidence_ce30_agentic (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- dispute (unknown, required)
- evidence (unknown, required)

## Outputs

- ce30_prior_txn_test (string, optional)
- ce30_readiness (string, optional)
- insufficient_evidence (boolean, optional)
- missing_elements (array, optional)
- network (string, optional)
- not_a_win_prediction (string, optional)
- per_element (array, optional)
- reason_code (string, optional)

## Sample

```json
{
  "dispute": {
    "network": "visa",
    "reason_code": "10.4",
    "transaction_ref": "txn-001"
  },
  "evidence": {
    "ap2_mandate": {
      "digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "bound_transaction_ref": "txn-001"
    },
    "tap_signature": {
      "digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "bound_transaction_ref": "txn-001"
    },
    "agentic_token": {
      "digest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "bound_transaction_ref": "txn-001"
    },
    "delivery_proof": {
      "digest": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "bound_transaction_ref": "txn-001"
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_compelling_evidence_ce30_agentic` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
