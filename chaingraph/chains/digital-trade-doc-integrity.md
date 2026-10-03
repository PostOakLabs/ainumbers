# Trade Document-Set Integrity & Consistency

W-C. Cross-document consistency + Merkle provenance (ART-55) -> independent Merkle re-verification (cry-04) -> invoicing/volume anomaly monitoring (ml-03). Detects inconsistent or tampered trade-document sets.

- Page: https://ainumbers.co/chaingraph/chains/digital-trade-doc-integrity.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/digital-trade-doc-integrity.md

## Workflow chain: Trade Document-Set Integrity & Consistency

W-C. Cross-document consistency + Merkle provenance (ART-55) -> independent Merkle re-verification (cry-04) -> invoicing/volume anomaly monitoring (ml-03). Detects inconsistent or tampered trade-document sets.

Domain: Digital Trade

### Steps

1. art-55-trade-document-provenance-verifier
   merkle_root and mismatches (H1) feed the batch verifier
2. cry-04-merkle-batch-verifier
   verified integrity (H2) feeds the anomaly detector
3. ml-03-timeseries-anomaly-detector
   Exports composite integrity artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our trade doc set runs through a money-laundering red-flag screen. Which periods get flagged as outliers, and what does tightening the z threshold do to that count?
Run the AINumbers MCP tool `run_chain` with {"chain":"digital-trade-doc-integrity"} and read `ml-03-timeseries-anomaly-detector.anomalies_flagged`.
Re-run with `inputs` for `ml-03-timeseries-anomaly-detector`, reusing the values that result echoed, with `zThreshold` set to 1. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/digital-trade-doc-integrity.html
