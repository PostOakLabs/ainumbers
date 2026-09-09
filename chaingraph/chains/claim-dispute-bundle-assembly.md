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
