# Large Exposures Limit Check (Basel III / Regulation YY)

Single-node check aggregating each counterparty group's exposure against the Basel III / Regulation YY 25% (general) or 15% (GSIB-to-GSIB) single-counterparty limit, emitting a breach-list artifact. Carries a terminal §27 escalate accountability gate: a non-empty /breach_list routes to the reserved escalate target; a clean run ends normally.

- Page: https://ainumbers.co/chaingraph/chains/large-exposures-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/large-exposures-check.md

## Workflow chain: Large Exposures Limit Check (Basel III / Regulation YY)

Single-node check aggregating each counterparty group's exposure against the Basel III / Regulation YY 25% (general) or 15% (GSIB-to-GSIB) single-counterparty limit, emitting a breach-list artifact. Carries a terminal §27 escalate accountability gate: a non-empty /breach_list routes to the reserved escalate target; a clean run ends normally.

Domain: Bank Capital & Credit Risk

### Steps

1. art-425-large-exposures-limit-check
   breach-list artifact feeds Basel III / Regulation YY large-exposures reporting and routes any breaching group to the terminal §27 escalate gate; standalone recurring check per reporting date

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The quarter-end exposure file is loaded. Does any connected group pass a quarter of our tier 1 capital?
Run the AINumbers MCP tool `run_chain` with {"chain":"large-exposures-check"} and read `art-425-large-exposures-limit-check.breach_list`.
Re-run with `inputs` for `art-425-large-exposures-limit-check`, reusing the values that result echoed, with `counterparties` changed so the cp-A term loan gross is 3000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/large-exposures-check.html
