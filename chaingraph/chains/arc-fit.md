# Arc Fit Diagnostic

D0 entry chain. 12-question diagnostic scoring CPN, StableFX, DvP, and agentic commerce fit for Circle Arc L1.

- Page: https://ainumbers.co/chaingraph/chains/arc-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/arc-fit.md

## Workflow chain: Arc Fit Diagnostic

D0 entry chain. 12-question diagnostic scoring CPN, StableFX, DvP, and agentic commerce fit for Circle Arc L1.

Domain: Digital-Asset Rails

### Steps

1. art-42-arc-fit-diagnostic
   arc_score, dimension scores, and cctp_routing_flag route to appropriate Arc chain

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A payments team answered the twelve screening questions. Which Arc workflow should they adopt first, and how strong is the case?
Run the AINumbers MCP tool `run_chain` with {"chain":"arc-fit"} and read `art-42-arc-fit-diagnostic.primary_chain`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/arc-fit.html
