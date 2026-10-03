# eBL Exclusive-Control Evidence Chain

Check a supplied electronic bill of lading's control-transfer event log against UNCITRAL MLETR Art. 10/11 singularity and exclusive-control elements (art-352), then bind the same event log into a hash-chained possession-receipt evidence pack with a Merkle root a holder can present to a bank or court (art-353). A jurisdiction-adoption lookup runs on its own branch (art-354) to answer whether the eBL is legally effective end-to-end for the corridor in question. Zero network, no PII, not a title registry or legal opinion.

- Page: https://ainumbers.co/chaingraph/chains/ebl-control-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ebl-control-evidence.md

## Workflow chain: eBL Exclusive-Control Evidence Chain

Check a supplied electronic bill of lading's control-transfer event log against UNCITRAL MLETR Art. 10/11 singularity and exclusive-control elements (art-352), then bind the same event log into a hash-chained possession-receipt evidence pack with a Merkle root a holder can present to a bank or court (art-353). A jurisdiction-adoption lookup runs on its own branch (art-354) to answer whether the eBL is legally effective end-to-end for the corridor in question. Zero network, no PII, not a title registry or legal opinion.

Domain: Digital Trade

### Steps

1. art-352-etr-control-evidence-checker
   Control-transfer event log and verdict feed the possession-chain receipt builder
2. art-353-etr-possession-chain-builder
   Hash-chained possession receipts and Merkle root - final stage of the main chain (jurisdiction branch runs independently over the same corridor)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The eBL changed hands twice before presentation. Does the possession chain show one unbroken line of control, and who holds it now?
Run the AINumbers MCP tool `run_chain` with {"chain":"ebl-control-evidence"} and read `art-353-etr-possession-chain-builder.chain_continuous`.
Re-run with `inputs` for `art-353-etr-possession-chain-builder`, reusing the values that result echoed, with `control_transfer_events` changed so the second transfer starts from a party that never held the record. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ebl-control-evidence.html
