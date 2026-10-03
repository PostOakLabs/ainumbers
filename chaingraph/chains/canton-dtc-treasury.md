# Canton DTC Tokenized Treasury Issuance & Settlement

Validate a DTCC/ComposerX tokenized U.S. Treasury for issuance and atomic settlement. Regulatory/asset classification (510) → DTC-custody link, Fed-eligibility, ComposerX DAML lifecycle and programmable-collateral-at-issuance (art-109) → PFMI P12 atomic DvP (507) → tokenized-collateral eligibility for reuse (505). Treasury/DTC-custody-specific; not generic securities lifecycle, not FICC clearing economics.

- Page: https://ainumbers.co/chaingraph/chains/canton-dtc-treasury.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-dtc-treasury.md

## Workflow chain: Canton DTC Tokenized Treasury Issuance & Settlement

Validate a DTCC/ComposerX tokenized U.S. Treasury for issuance and atomic settlement. Regulatory/asset classification (510) → DTC-custody link, Fed-eligibility, ComposerX DAML lifecycle and programmable-collateral-at-issuance (art-109) → PFMI P12 atomic DvP (507) → tokenized-collateral eligibility for reuse (505). Treasury/DTC-custody-specific; not generic securities lifecycle, not FICC clearing economics.

Domain: Digital-Asset Rails

### Steps

1. 510-digital-asset-regulatory-classifier
   instrument class and DLT-pilot eligibility feed Stage 2 DTC-treasury validation
2. art-109-dtc-tokenized-treasury
   custody link, Fed-eligibility, DAML lifecycle gaps feed Stage 3 DvP atomicity
3. 507-canton-dvp-atomicity-validator
   atomic DvP verdict feeds Stage 4 collateral eligibility
4. 505-tokenized-collateral-eligibility-checker
   Exports composite tokenized-treasury artifact with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Before we tokenize this Treasury CUSIP class, is the DTC custody and Fed eligibility pack ready for issuance, or are there gaps?
Run the AINumbers MCP tool `run_chain` with {"chain":"canton-dtc-treasury"} and read `art-109-dtc-tokenized-treasury.verdict`.
Re-run with `inputs` for `art-109-dtc-tokenized-treasury`, reusing the values that result echoed, with `tokenized_ust_config` changed so fed_eligible is false. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/canton-dtc-treasury.html
