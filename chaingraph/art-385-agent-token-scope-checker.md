# Agent Token Scope Checker

Compares a requested agent action (amount, currency, merchant category, timestamp) against an agent token or mandate's declared scope: spend cap, currency, MCC allow-list, and expiry. If an attenuation chain of ancestor tokens is supplied, also checks that each delegation link narrows - never widens - the parent's bounds. Returns an in-scope or out-of-scope verdict and receipt. Pure evaluation only - never authorizes, blocks, or executes a payment. Consumes the same mandate-chain vocabulary as art-01; distinct job - one requested action against one token's bounds, not full mandate-chain structural validation.

- Page: https://ainumbers.co/chaingraph/art-385-agent-token-scope-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-385-agent-token-scope-checker.md
- MCP tool: check_agent_token_scope (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- attenuation_chain (array, required)
- requested_action (unknown, optional)
- token (unknown, optional)

## Outputs

- attenuation_depth (integer, optional)
- checks_run (integer, optional)
- enforcement (string, optional)
- failing_checks (array, optional)
- token_id (string, optional)
- verdict (string, optional)

## Sample

```json
{
  "requested_action": {
    "amount": 50,
    "currency": "USD",
    "mcc": "5411",
    "requested_at": "2026-07-18T12:00:00Z"
  },
  "token": {
    "token_id": "tok_leaf_1",
    "max_amount": 100,
    "currency": "USD",
    "allowed_mccs": [
      "5411",
      "5412"
    ],
    "expires_at": "2026-08-01T00:00:00Z"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_agent_token_scope` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
