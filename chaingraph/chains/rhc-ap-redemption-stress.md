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
