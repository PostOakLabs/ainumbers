# Claim Dispute Bundle Assembly

Two-step agent-insurability evidence flow: score an agent execution evidence bundle for underwriter-facing evidence completeness, then build a two-sided replay-challenge dossier for a disputed execution_claim, optionally testing a warranty KPI breach.

- Page: https://ainumbers.co/chaingraph/chains/claim-dispute-bundle-assembly.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/claim-dispute-bundle-assembly.md

## Workflow chain: Claim Dispute Bundle Assembly

Two-step agent-insurability evidence flow: score an agent execution evidence bundle for underwriter-facing evidence completeness, then build a two-sided replay-challenge dossier for a disputed execution_claim, optionally testing a warranty KPI breach.

Domain: Insurance & Reinsurance

### Steps

1. art-306-agent-insurability-evidence-scorer
   composite and dims feed Stage 2 as evidence-completeness context for the dispute bundle
2. art-307-claim-dispute-bundle-builder
   Builds the replay-challenge dossier, optionally testing a warranty_kpi_breach - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A policyholder disputes our denial and points at the uptime warranty. Does the assembled bundle prove a KPI breach?
Run the AINumbers MCP tool `run_chain` with {"chain":"claim-dispute-bundle-assembly"} and read `art-307-claim-dispute-bundle-builder.kpi_breach.breached`.
Re-run with `inputs` for `art-307-claim-dispute-bundle-builder`, reusing the values that result echoed, with `warranty_kpi_breach` changed so measured_metric is 99.9, above the 99.5 threshold. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/claim-dispute-bundle-assembly.html
