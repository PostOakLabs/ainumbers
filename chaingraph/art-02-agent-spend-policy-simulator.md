# Agent Spend-Policy Simulator

Simulates thousands of synthetic agent transactions against a user-authored spend policy (per-merchant caps, category allow/deny, velocity limits, cumulative ceilings). Flags scope creep and AP2 v0.2 Human-Not-Present policy-bypass paths.

- Page: https://ainumbers.co/chaingraph/art-02-agent-spend-policy-simulator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-02-agent-spend-policy-simulator.md
- MCP tool: simulate_spend_policy (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- allowed_methods (unknown, optional)
- blocked_categories (unknown, required)
- blocked_merchants (unknown, required)
- chaos (unknown, optional)
- daily_limit (unknown, optional)
- drip_freq (unknown, optional)
- hnp_ratio (unknown, optional)
- hour_restriction (unknown, optional)
- monthly_limit (unknown, optional)
- n_txns (number, optional)
- per_tx_limit (unknown, optional)
- seed (unknown, optional)

## Outputs

- bypass_paths_detected (array, optional)
- compliance_flags (array, optional)
- fail_count (integer, optional)
- fail_rate_pct (number, optional)
- pass_count (integer, optional)
- top_fail_reasons (object, optional)
- total_approved_spend (number, optional)
- total_transactions (integer, optional)
- verdict (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_spend_policy` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
