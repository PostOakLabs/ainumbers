# Assemble AIUC-1 Evidence Pack

Three-step AIUC-1 evidence pipeline: lint a control-evidence bundle against the 23 automatable AIUC-1 v2026-Q1 controls, assemble a signed control-keyed evidence pack with an OSCAL export, then lint the pack for evidence freshness against the AIUC-1 quarterly re-test cadence and cert expiry.

- Page: https://ainumbers.co/chaingraph/chains/assemble-aiuc1-evidence-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/assemble-aiuc1-evidence-pack.md

## Workflow chain: Assemble AIUC-1 Evidence Pack

Three-step AIUC-1 evidence pipeline: lint a control-evidence bundle against the 23 automatable AIUC-1 v2026-Q1 controls, assemble a signed control-keyed evidence pack with an OSCAL export, then lint the pack for evidence freshness against the AIUC-1 quarterly re-test cadence and cert expiry.

Domain: AI & Agent Governance

### Steps

1. art-303-aiuc1-control-evidence-linter
   per_control status feeds Stage 2 pack assembly as the control_mapping evidence basis
2. art-304-aiuc1-evidence-pack-assembler
   controls[] and pack_claim_strength feed Stage 3 freshness lint against the assembled pack
3. art-305-aiuc1-evidence-freshness-lint
   Computes stale_controls and cert_expiry over the assembled pack - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
