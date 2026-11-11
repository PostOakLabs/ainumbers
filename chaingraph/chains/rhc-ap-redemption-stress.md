# Robinhood Chain AP Redemption Stress

Single-step chain stress-testing the economic-exposure claim for Robinhood Chain stock tokens against Authorised Participant concentration and redemption-path reachability.

- Page: https://ainumbers.co/chaingraph/chains/rhc-ap-redemption-stress.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/rhc-ap-redemption-stress.md

## Workflow chain: Robinhood Chain AP Redemption Stress

Single-step chain stress-testing the economic-exposure claim for Robinhood Chain stock tokens against Authorised Participant concentration and redemption-path reachability.

Domain: Digital-Asset Rails

### Steps

1. art-322-rhc-ap-redemption-stress
   concentration_risk, redemption_path, and structural_dependencies feed the stress record.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Only one authorised participant currently makes markets in the token. What does the redemption stress test say about that concentration?
Run the AINumbers MCP tool `run_chain` with {"chain":"rhc-ap-redemption-stress"} and read `art-322-rhc-ap-redemption-stress.concentration_risk`.
Re-run with `inputs` for `art-322-rhc-ap-redemption-stress`, reusing the values that result echoed, with `authorised_participants` changed so four entries are active, so ap_count is 4. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/rhc-ap-redemption-stress.html
