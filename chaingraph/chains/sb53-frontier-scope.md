# SB 53 Frontier Scope

Single-step obligation router for the California SB 53 Transparency in Frontier Artificial Intelligence Act (eff. 2026-01-01). Kept as its own composer rather than folded into the CAIA/TRAIGA/AB2013 chains - SB 53 serves a narrow frontier-lab audience, distinct from the general deployer/developer compliance-owner persona of the other state-AI chains.

- Page: https://ainumbers.co/chaingraph/chains/sb53-frontier-scope.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sb53-frontier-scope.md

## Workflow chain: SB 53 Frontier Scope

Single-step obligation router for the California SB 53 Transparency in Frontier Artificial Intelligence Act (eff. 2026-01-01). Kept as its own composer rather than folded into the CAIA/TRAIGA/AB2013 chains - SB 53 serves a narrow frontier-lab audience, distinct from the general deployer/developer compliance-owner persona of the other state-AI chains.

Domain: AI & Agent Governance

### Steps

1. art-316-sb53-frontier-scope-checker
   is_frontier_model, is_large_frontier_developer, and obligation_set complete the scope determination - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A developer trains to 1e27 FLOPs and books 600 million dollars a year. Which SB 53 duties attach before deployment?
Run the AINumbers MCP tool `run_chain` with {"chain":"sb53-frontier-scope"} and read `art-316-sb53-frontier-scope-checker.is_frontier_model`.
Re-run with `inputs` for `art-316-sb53-frontier-scope-checker`, reusing the values that result echoed, with `compute_flops` set to "1e27". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/sb53-frontier-scope.html
