# EU Green Bond Factsheet & Allocation Conformance

EuGB factsheet (Annex I) + allocation report (Annex II) completeness + proceeds-alignment validation (ART-75) -> use-of-proceeds Taxonomy alignment cross-check (ART-73) -> Merkle integrity over the bond evidence set (cry-04). The issuer-to-external-reviewer green-bond conformance pack. Decision-support draft, not a reviewer attestation.

- Page: https://ainumbers.co/chaingraph/chains/eugb-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/eugb-conformance.md

## Workflow chain: EU Green Bond Factsheet & Allocation Conformance

EuGB factsheet (Annex I) + allocation report (Annex II) completeness + proceeds-alignment validation (ART-75) -> use-of-proceeds Taxonomy alignment cross-check (ART-73) -> Merkle integrity over the bond evidence set (cry-04). The issuer-to-external-reviewer green-bond conformance pack. Decision-support draft, not a reviewer attestation.

Domain: Climate & Sustainable Finance

### Steps

1. art-75-eugb-factsheet-validator
   factsheet/allocation conformance + proceeds-aligned % (H1) feeds the alignment scorer
2. art-73-taxonomy-alignment-scorer
   use-of-proceeds alignment (H2) feeds the verifier
3. cry-04-merkle-batch-verifier
   Exports composite EuGB conformance artifact with Merkle-root execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
