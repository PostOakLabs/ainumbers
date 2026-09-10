# Anti-Circumvention Diligence & No-Russia Clause

ECCN classification (ART-94) -> circumvention due-diligence + liability-allocation assessment vs the EU 20th-package no-Russia clause (ART-95) -> no-Russia-clause + DD-evidence pack (ART-96). The export-control diligence lifecycle. Decision-support draft.

- Page: https://ainumbers.co/chaingraph/chains/export-control-circumvention.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/export-control-circumvention.md

## Workflow chain: Anti-Circumvention Diligence & No-Russia Clause

ECCN classification (ART-94) -> circumvention due-diligence + liability-allocation assessment vs the EU 20th-package no-Russia clause (ART-95) -> no-Russia-clause + DD-evidence pack (ART-96). The export-control diligence lifecycle. Decision-support draft.

Domain: Export Control

### Steps

1. art-94-eccn-dual-use-classifier
   classification (H1) feeds the diligence assessor
2. art-95-circumvention-diligence-assessor
   diligence grade + liability allocation (H2) feeds the pack builder
3. art-96-no-russia-clause-pack-builder
   Exports composite circumvention pack with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
